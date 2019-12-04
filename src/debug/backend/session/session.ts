import { existsSync, mkdirSync, unlink } from 'fs'
import { createServer, Server } from 'net'
import { tmpdir } from 'os'
import * as systemPath from 'path'
import { BreakpointEvent, ContinuedEvent, TerminatedEvent, ThreadEvent } from 'vscode-debugadapter'
import { DebugProtocol } from 'vscode-debugprotocol'
import { IMyLogger } from '@utils/baseLogger'
import { createGdbProcess, IChildProcess, waitProcess } from '@debug/common/createGdbProcess'
import { DeferredPromise, sleep } from '@debug/common/deferredPromise'
import { Emitter } from '@debug/common/event'
import { errorMessage, padPercent } from '@debug/common/library/strings'
import { BreakPointController, IBreakpointDiff } from '@debug/common/mi2/breakPointController'
import { IRunStateEvent, IThreadEvent, Mi2AutomaticResponder, ThreadNotify } from '@debug/common/mi2/mi2AutomaticResponder'
import { createStopEvent, StopReason } from '@debug/common/mi2/pause'
import { BreakpointType, IMyStack, IMyThread, IMyVariable, MyBreakpoint } from '@debug/common/mi2/types'
import { MESSAGE_LOADING_PROGRAM } from '@debug/messages'
import { IGDBStack } from '@debug/backend/gdbDataStructs/stack'
import { IGDBThread } from '@debug/backend/gdbDataStructs/thread'
import { IGDBVariable } from '@debug/backend/gdbDataStructs/variable'
import { IDebugConsole } from '@debug/backend/lib/duplexDebugConsole'
import { AttachRequestArguments, LaunchRequestArguments, VariableObject } from '@debug/backend/type'
import split2 = require('split2')


export class DebuggingSession {
	private readonly handler: Mi2AutomaticResponder

	private readonly processToExit: Promise<void>
	private readonly connectReady: DeferredPromise<void>

	private readonly _onEvent = new Emitter<DebugProtocol.Event>()
	public readonly onEvent = this._onEvent.event
	private readonly commandServer: Server
	private readonly commandPath: string
	private readonly breakpoints = new BreakPointController()
	private readonly process: IChildProcess

	constructor(
		private readonly config: AttachRequestArguments | LaunchRequestArguments,
		private readonly logger: IMyLogger,
		private readonly debugConsole: IDebugConsole,
	) {
		this.connectReady = new DeferredPromise<void>()

		/* PROCESS */
		const process = this.process = createGdbProcess({
			gdb: config.gdbpath,
			app: config.executable,
			args: config.debuggerArgs,
			env: config.env,
			logger: this.logger,
		})
		this.processToExit = waitProcess(process).catch((e) => {
			this.debugConsole.errorUser('process return error: ' + e.toString())
			this.debugConsole.errorUser('ignore this process.')
		}).finally(() => {
			this.debugConsole.logUser('debug session finished.')
			this.triggerEvent(new TerminatedEvent())
		})

		process.stderr.pipe(split2()).on('data', (line: Buffer) => {
			this.debugConsole.errorUser(line.toString('utf8'))
		})

		/* COMMAND SERVER */
		const tempPath = systemPath.join(tmpdir(), 'kendryte-debug-sockets')
		this.commandPath = systemPath.join(tempPath, 'debug-' + Math.floor(Math.random() * 36 * 36 * 36 * 36).toString(36))

		const commandServer = createServer(c => {
			c.on('data', data => {
				const rawCmd = data.toString()
				const spaceIndex = rawCmd.indexOf(' ')
				let func = rawCmd
				let args = []
				if (spaceIndex != -1) {
					func = rawCmd.substr(0, spaceIndex)
					args = JSON.parse(rawCmd.substr(spaceIndex + 1))
				}
				interface IParams {
					[propName: string]: any
				}
				Promise.resolve((<IParams>this)[func].apply(this, args)).then(data => {
					c.write(data.toString())
				})
			})
		})
		commandServer.on('error', err => {
			this.logger.error('Kendryte-Debug WARNING: Utility Command Server: Error in command socket ' + err.toString())
		})
		if (!existsSync(tempPath)) {
			mkdirSync(tempPath)
		}
		commandServer.listen()

		this.commandServer = commandServer

		/* FINAL */
		this.handler = new Mi2AutomaticResponder(process, this.logger)

		this.registerMi2EventHandlers()
	}

	get isRunning() {
		return this.handler.isRunning
	}

	async dispose() {
		const proc = this.process
		if (!proc) {
			return
		}

		this.handler.commandEnsure('gdb-exit')

		const to = setTimeout(() => {
			this.logger.error('exit timeout, force kill.')
			proc.kill('SIGKILL')
		}, 4000)

		await this.disconnected
		clearTimeout(to)

		this._onEvent.dispose()
		this.handler.dispose()

		await new Promise((resolve) => {
			this.commandServer.close(() => {
				unlink(this.commandPath, (err) => {
					if (err) {
						console.error(err)
					}
					resolve()
				})
			})
		})
	}

	async load() {
		this.debugConsole.logUser(MESSAGE_LOADING_PROGRAM)
		// await this.handler.command('exec-interrupt')
		let totalSent = 0, totalSize = NaN
		await this.handler.commandEnsure('target-download').progress((node) => {
			const section = node.result('section')
			const sectionSize = parseInt(node.result('section-size'))
			const sectionSent = parseInt(node.result('section-sent'))
			let sectionProgress = '.'
			if (!isNaN(sectionSize)) {
				if (!isNaN(sectionSent)) {
					const percent = ((100 * sectionSent / sectionSize).toFixed(0))
					sectionProgress = `: (${percent}%) ${sectionSent}/${sectionSize} ...`
				} else {
					sectionProgress = ': size = ' + sectionSize
				}
			}

			totalSent = parseInt(node.result('total-sent')) || totalSent
			totalSize = parseInt(node.result('total-size')) || totalSize

			const percent = padPercent(100 * totalSent / totalSize)

			this.debugConsole.logUser(`[${percent}] ${totalSent}/${totalSize}, Section "${section}" ${sectionProgress}`)
		})
		this.debugConsole.logUser('program loaded.')
	}

	async examineMemory(from: number, length: number) {
		const result = await this.handler.commandEnsure('data-read-memory-bytes', '0x' + from.toString(16), length.toString(10))
		// this.logger.info('request: examineMemory(%s, %s)', from, length, result)
		return result.result('memory[0].contents')
	}

	setBreakPointCondition(bkptNum: string, condition: string) {
		// this.logger.debug('request: setBreakPointCondition()')
		return this.handler.commandEnsure('break-condition', bkptNum, condition)
	}

	async removeBreakPoint(file: string, breakpoint: MyBreakpoint) {		
		if (!breakpoint.gdbBreakNum) {
			throw new Error('removing non-exists breakpoint.')
		}
		const result = await this.handler.commandEnsure('break-delete', breakpoint.gdbBreakNum.toString())

		if (result.className !== 'done') {
			throw new Error('cannot remove breakpoint ' + breakpoint.gdbBreakNum)
		}

		this.debugConsole.errorUser(`Delete breakpoint: ${breakpoint.gdbBreakNum || '<invalid>'}`)
		this.breakpoints.removeExists(file, breakpoint)

		delete breakpoint.gdbBreakNum
		return breakpoint
	}

	private triggerEvent(e: DebugProtocol.Event) {
		delete e.seq
		this._onEvent.fire(e)
	}

	private async addBreakPoint(file: string, breakpoint: MyBreakpoint): Promise<MyBreakpoint> {
		if (breakpoint.gdbBreakNum) {
			throw new Error('adding registered breakpoint.')
		}

		let special: string[] = []
		if (breakpoint.type === BreakpointType.Line && breakpoint.logMessage) {
			special.push('-a')
		}
		if (breakpoint.condition) {
			special.push('-c', JSON.stringify(breakpoint.condition))
		}

		breakpoint.tried = true
		const result = breakpoint.type === BreakpointType.Line ?
			await this.handler.commandEnsure('break-insert', '--source', JSON.stringify(breakpoint.file), '--line', breakpoint.line.toString(), ...special) :
			await this.handler.commandEnsure('break-insert', '--function', breakpoint.name, ...special)

		breakpoint.gdbBreakNum = parseInt(result.result('bkpt.number') || result.result('bkpt.MI2ChildValues.0.number'))

		let resultFile: string
		let line: number
		breakpoint.addr = result.result('bkpt.addr')
		if (breakpoint.addr === '<MULTIPLE>') {
			breakpoint.addr = result.result('bkpt.MI2ChildValues.0.addr')
			resultFile = result.result('bkpt.MI2ChildValues.0.file')
			line = parseInt(result.result('bkpt.MI2ChildValues.0.line'))
		} else {
			resultFile = result.result('bkpt.file')
			line = parseInt(result.result('bkpt.line'))
		}

		const sameAddress = this.breakpoints.conflictsAddress(breakpoint.addr || '')
		if (sameAddress) {
			this.logger.info('add more breakpoints on same address: a1: %s, a2:%s , id=%s', sameAddress.addr, breakpoint.addr, breakpoint.gdbBreakNum)
			this.triggerEvent(new BreakpointEvent('removed', { id: breakpoint.gdbBreakNum } as any))
			return sameAddress
		}

		if (breakpoint.type === BreakpointType.Line) {
			breakpoint.file = resultFile
			breakpoint.line = line
		}

		const base = systemPath.basename(resultFile)
		this.debugConsole.errorUser(`New breakpoint: ${breakpoint.gdbBreakNum} (${result.result('bkpt.func')} in ${base}:${line})`)
		this.breakpoints.registerNew(file, breakpoint)
		return breakpoint
	}

	private async modifyBreakPoint(breakpoint: MyBreakpoint, change: IBreakpointDiff) {
		if (change.condition) {
			await this.handler.commandEnsure('break-condition', breakpoint.gdbBreakNum ? breakpoint.gdbBreakNum.toString() : '', breakpoint.condition)
		}
		return breakpoint
	}

	/* EVENTS */
	private registerMi2EventHandlers() {
		this.handler.onSimpleLine(({ error, message }) => {
			if (error) {
				this.debugConsole.error(message)
			} else {
				this.debugConsole.log(message)
			}
		})
		this.handler.onThreadNotify(this.threadEvent.bind(this))
		this.handler.onTargetRunStateChange(this.handleStopResume.bind(this))
	}

	private handleStopResume(status: IRunStateEvent) {
		if (status.realChange) {
			this.debugConsole.errorUser(status.running ? '> continue' : '> interrupt by ' + status.reasonString)

			if (status.running) {
				const event = new ContinuedEvent(status.threadId, status.allThreads)
				this.triggerEvent(event)
			} else {
				const event = createStopEvent(status.reason, status.threadId)
				event.body.allThreadsStopped = status.allThreads
				event.body.preserveFocusHint = false
				this.triggerEvent(event)
			}
		}
	}

	private threadEvent(event: IThreadEvent) {
		if (event.type === ThreadNotify.Created) {
			this.triggerEvent(new ThreadEvent('started', event.id))
		} else {
			this.triggerEvent(new ThreadEvent('exited', event.id))
		}
	}

	private forceStatusEvent(reason: StopReason = StopReason.UnknownReason) {
		if (this.handler.isRunning) {
			this.triggerEvent(new ContinuedEvent(0, true))
		} else {
			this.triggerEvent(createStopEvent(reason, undefined, 'force refresh status'))
		}
	}

	get connected() {
		return this.connectReady.p
	}

	get disconnected() {
		return this.processToExit.catch(() => {
		}).then(() => {
			return this
		})
	}

	public async connect(load: boolean) {
		if (this.connectReady.isFired()) {
			throw new Error('Already connected')
		}

		this.debugConsole.logUser('[kendryte debug] debugger starting...')
		this.logger.info(`[kendryte debug] debugger starting: test log.`)

		await this.handler.commandSequence([
			['gdb-set', 'target-async', 'on'],
			['target-select', 'remote', this.config.target],
		]).then(() => {
			this.connectReady.complete()
		}, (e: Error) => {
			this.connectReady.error(e)
			throw e
		})
		this.debugConsole.logUser('connected to: ' + this.config.target)

		if (load) {
			await this.load()
		}
	}

	/* REQUESTS */
	async reload() {
		await this.interrupt()
		return this.load()
	}

	detach(): Promise<any> {
		const proc = this.process
		const [to, dispose] = sleep(3000)
		to.then(() => {
			this.logger.warning('detach timeout, force kill.')
			proc.kill('SIGKILL')
		})
		this.process.on('exit', function () {
			dispose()
		})
		return Promise.race<any>([
			this.handler.commandEnsure('target-detach'),
			to,
		])
	}

	public async terminate() {
		this.debugConsole.logUser('[kendryte debug] debugger stopping.')
		await this.dispose()
		await this.processToExit
		this.debugConsole.logUser('ok.')
	}

	async interrupt() {
		this.logger.info('request interrupt, current state is: %s', this.handler.isRunning)

		await this.handler.execInterrupt()
		await this.handler.waitInterrupt()
	}

	async continue() {
		await this.handler.commandEnsure('exec-continue')
		if (!this.handler.isRunning) {
			this.forceStatusEvent()
			throw new Error('request continue, but program not run.')
		}
	}

	async next() {
		await this.handler.commandEnsure('exec-next')
		await this.handler.waitInterrupt()
	}

	async step() {
		await this.handler.commandEnsure('exec-step')
		await this.handler.waitInterrupt()
	}

	async stepOut() {
		await this.handler.commandEnsure('exec-finish')
		await this.handler.waitInterrupt()
	}

	async updateBreakPoints(file: string, breakpoints: MyBreakpoint[]) {
		const ret: MyBreakpoint[] = []
		for (const breakpoint of breakpoints) {
			let exists = this.breakpoints.isExists(file, breakpoint)
			if (exists) {
				const diff = this.breakpoints.compareBreakpoint(exists, breakpoint)

				if (!diff) {
					this.logger.info('breakpoint %s is not change.', exists.gdbBreakNum)
					ret.push(exists)
					continue
				} else {
					this.logger.info('breakpoint %s is change: %s', exists.gdbBreakNum, JSON.stringify(breakpoint))
					const newBreak = await this.modifyBreakPoint(breakpoint, diff as IBreakpointDiff)
					ret.push(newBreak)
					continue
				}
			}

			this.logger.info('will create breakpoint: %s', JSON.stringify(breakpoint))
			// const newBreaks = await
			const newBreak = await this.addBreakPoint(file, breakpoint).catch((err) => {
				breakpoint.errorMessage = 'Cannot add breakpoint! // TODO'
				this.debugConsole.errorUser('Add breakpoint failed: ' + errorMessage(err))

				return breakpoint
			})

			ret.push(newBreak)
		}

		const willDelete = this.breakpoints.filterOthers(file, ret)
		this.logger.warning('will delete %s breakpoints: %s', willDelete.length, willDelete.map(i => i.gdbBreakNum).join(', '))
		for (const oldBreak of willDelete) {
			await this.removeBreakPoint(file, oldBreak)
		}

		const dump = this.breakpoints.dump(file)
		this.logger.warning('current file %s has %s breakpoints:\n%s', file, dump.length, dump.map((b) => {
			return `    #${b.gdbBreakNum} - address:${b.addr}`
		}))

		return ret
	}

	async getThreads(required: boolean = true): Promise<IMyThread[]> {
		const result = required ?
			await this.handler.commandEnsure('thread-info') :
			await this.handler.command('thread-info')
		const threads = result.result<IGDBThread[]>('threads')
		return threads.map(element => {
			const ret: IMyThread = {
				id: parseInt(element.id),
				targetId: element['target-id'],
			}

			const name = element.name
			if (name) {
				ret.name = name
			}

			return ret
		})
	}

	async getStack(maxLevels: number, thread: number): Promise<IMyStack[]> {
		let command = 'stack-list-frames'
		if (thread != 0) {
			command += ` --thread ${thread}`
		}
		if (maxLevels) {
			command += ' 0 ' + maxLevels
		}
		const result = await this.handler.commandEnsure(command)
		const stacks = result.result<IGDBStack[]>('stack')

		return stacks.map(({ frame }) => {
			return <IMyStack>{
				address: frame.addr,
				fileName: frame.file,
				file: frame.fullname,
				function: frame.func || frame.from,
				level: parseInt(frame.level),
				line: parseInt(frame.line || '0'),
			}
		})
	}

	async getStackVariables(thread: number, frame: number): Promise<IMyVariable[]> {
		const result = await this.handler.commandEnsure('stack-list-variables', '--thread', thread.toString(), '--frame', frame.toString(), '--simple-values')

		const variables = result.result<IGDBVariable[]>('variables')
		return variables.map((element) => {
			return {
				name: element.name,
				valueStr: element.value,
				type: element.type,
				raw: element,
			}
		})
	}

	async varAssign(name: string, rawValue: string) {
		const res = await this.handler.commandEnsure('var-assign', name, rawValue)
		// this.logger.debug('request: varAssign(%s,%s)', name, rawValue, res)
		return res.result<string>('value')
	}

	varUpdate(varObjName: string) {
		return this.handler.commandEnsure('var-list-children', '--all-values', varObjName)
	}

	async varCreate(expression: string, name: string = '-'): Promise<VariableObject> {
		const res = await this.handler.commandEnsure('var-create', name, '@', JSON.stringify(expression))
		return new VariableObject(res.result(''))
	}

	async varListChildren(name: string): Promise<VariableObject[]> {
		// this.logger.debug('request: varListChildren()')
		//TODO: add `from` and `to` arguments
		const res = await this.handler.commandEnsure('var-list-children', '--all-values', name)
		const children = res.result('children') || []
		return children.map((child: any[]) => new VariableObject(child[1]))
	}

	async changeVariable(name: string, rawValue: string) {
		await this.handler.commandEnsure('gdb-set', 'var', name + '=' + rawValue)
		// this.logger.debug('request: changeVariable(%s, %s)', name, rawValue)
		return rawValue
	}

	public sendUserInput(expression: string, threadId: number, frameLevel: number) {
		switch (expression) {
			case '!fe':
				this.forceStatusEvent()
				return
		}
		if (expression.startsWith('-')) {
			return this.handler.command(expression.substr(1))
		} else {
			return this.handler.cliCommand(expression, threadId, frameLevel)
		}
	}

	evalExpression(name: string, thread: number, frame: number) {
		// this.logger.debug('request: evalExpression(%s, %d, %d)', name, thread, frame)

		const args = []
		if (thread != 0) {
			args.push('--thread', thread.toString(), '--frame', frame.toString())
		}
		args.push(name)

		return this.handler.commandEnsure('data-evaluate-expression', ...args)
	}
}
