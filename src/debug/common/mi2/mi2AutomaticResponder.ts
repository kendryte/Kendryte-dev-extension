import { ErrorMi2 } from '@debug/backend/lib/handleMethodPromise'
import { IMyLogger } from '@utils/baseLogger'
import { IChildProcess } from '../createGdbProcess'
import { DeferredPromise, isCancel, sleep, timeout } from '../deferredPromise'
import { Emitter, EventRegister } from '../event'
import { dumpJson } from '../library/strings'
import { ISimpleOutput, Mi2CommandController } from './mi2CommandController'
import { IAsyncNode, IResultNode, MINode, OneOfMiNodeType } from './mi2Node'
import { MiOutputType } from './mi2Parser'
import { StopReason } from './pause'

const numRegex = /\d+/
const interruptedRegex = /Interrupt./

export enum ThreadNotify {
	Created,
	Exited,
	GroupAdd,
	GroupStarted,
	GroupExited,
}

export interface IThreadEvent {
	type: ThreadNotify
	id: number
}

export interface IRunStateEvent {
	realChange: boolean
	running: boolean
	reason: StopReason
	reasonString?: string
	allThreads: boolean
	threadId: number
}

const stateErr = /Cannot execute this command while the selected thread is running|Cannot execute this command while the target is running/

export function isCommandIssueWhenRunning(err: Error) {
	return err instanceof ErrorMi2 && stateErr.test(err.message)
}

/**
 * 调试器抽象层，不要依赖【任何】vscode相关的东西，尤其是debug session
 */
export class Mi2AutomaticResponder {
	public readonly onSimpleLine: EventRegister<ISimpleOutput>
	private controller: Mi2CommandController
	private readonly _onTargetRunStateChange = new Emitter<IRunStateEvent>()
	public readonly onTargetRunStateChange = this._onTargetRunStateChange.event
	private readonly _onThreadNotify = new Emitter<IThreadEvent>()
	public readonly onThreadNotify = this._onThreadNotify.event
	private firstTimeStop: boolean = true

	private _isRunning!: boolean
	private awaitingInterrupt?: DeferredPromise<void>
	private awaitingContinue?: DeferredPromise<void>

	constructor(
		private readonly process: IChildProcess,
		private readonly logger: IMyLogger,
	) {
		this.controller = new Mi2CommandController(process.stdin, process.stdout, logger)

		this.onSimpleLine = this.controller.onSimpleLine
		this.controller.onSimpleLine(({ error, message }) => {
			logger.writeln('simpleOut: ' + message.trim())
		})
		this.controller.onReceiveMi2((node) => {
			node.handled = this.handleMI(node)
		})
	}

	get isRunning() {
		return this._isRunning
	}

	dispose() {
		this.controller.dispose()
		this._onTargetRunStateChange.dispose()
		this._onThreadNotify.dispose()
	}

	public waitContinue(): Promise<void> {
		if (this._isRunning) {
			return Promise.resolve()
		}

		if (!this.awaitingContinue) {
			this.awaitingContinue = new DeferredPromise()
			const [to, cancel] = sleep(6000)

			this.awaitingContinue.p.finally(() => {
				cancel()
				delete this.awaitingContinue
			})

			to.then(() => {
				(this.awaitingContinue || new DeferredPromise<void, void>()).error(new Error('cannot continue program in 5s'))
			}).catch(() => undefined)
		}

		return this.awaitingContinue.p
	}

	public waitInterrupt(): Promise<void> {
		if (!this._isRunning) {
			return Promise.resolve()
		}

		if (!this.awaitingInterrupt) {
			this.awaitingInterrupt = new DeferredPromise()
			const [to, cancel] = sleep(6000)

			this.awaitingInterrupt.p.finally(() => {
				cancel()
				delete this.awaitingInterrupt
			})

			to.then(() => {
				(this.awaitingInterrupt || new DeferredPromise<void, void>()).error(new Error('cannot interrupt program in 5s'))
			}).catch(() => undefined)
		}

		return this.awaitingInterrupt.p
	}

	public async execInterrupt() {
		return Promise.race([
			this.command('exec-interrupt').then(() => {
				return timeout(4000)[0]
			}),
			this.waitInterrupt(),
		]).catch((e) => {
			if (isCancel(e)) {
				throw new Error('cannot x after 4s')
			} else {
				throw e
			}
		})
	}

	public async execContinue() {
		return Promise.race([
			this.command('exec-continue').then(() => {
				return timeout(4000)[0]
			}),
			this.waitContinue(),
		]).catch((e) => {
			if (isCancel(e)) {
				throw new Error('cannot x after 4s')
			} else {
				throw e
			}
		})
	}

	commandEnsure(command: string, ...args: string[]) {
		const dfd = new DeferredPromise<IResultNode, IResultNode | IAsyncNode>()

		this.command(command, ...args)
		    .progress((n) => dfd.notify(n))
		    .catch((err) => {
			    if (isCommandIssueWhenRunning(err)) {
				    this.logger.info('retry after interrupt...')

				    dfd.notify(err.node)

				    this._onTargetRunStateChange.pause()
				    return this.execInterrupt().then((result) => {
					    const p = this.command(command, ...args)
					    p.progress((n) => dfd.notify(n))
					    return p.finally(() => {
						    return this.execContinue()
					    })
				    }, (err) => {
					    err.message += ' (when running command ' + command + ')'
					    throw err
				    }).finally(() => {
					    this._onTargetRunStateChange.resume()
				    })
			    } else {
				    this.logger.info('error not cause by busy, no retry...')
				    throw err
			    }
		    })
		    .then((data) => {
			    dfd.complete(data)
		    }, (err) => {
			    dfd.error(err)
		    })

		return dfd.p
	}

	command(command: string, ...args: string[]) {
		const ret = this.controller.send([command, ...args].join(' '))

		this.logger.info(`send command: ${ret.token} - ${command}`)

		ret.promise.then(() => {
			this.logger.info(`command return: ${command}`)
		}, (err) => {
			this.logger.error(`command return: ${command} (with error)`)
		})

		return ret.promise
	}

	async commandSequence(commandsArgs: [string, ...string[]][]): Promise<MINode | undefined> {
		const promise = commandsArgs.map(async ([command, ...args]) => {
			return await this.command(command, ...args)
		})
		const rets = await Promise.all(promise)
		return rets[rets.length - 1]
	}

	cliCommand(expression: string, threadId: number = 0, frameLevel: number = 0) {
		const params: never[] = []
		const tParams = []
		if (threadId !== 0) {
			tParams.push('--thread', threadId, '--frame', frameLevel)
		}
		const args: any[] = [...tParams, 'console', JSON.stringify(expression), ...params]
		this.logger.info(`user command: interpreter-exec ${args.join(' ')}`)
		return this.command('interpreter-exec', ...args)
	}

	private handleMI(node: OneOfMiNodeType): boolean {
		switch (node.type) {
			case MiOutputType.asyncExec:
				return this.handleExec(node)
			case MiOutputType.asyncStatus:
				return this.handleStatus(node) || false
			case MiOutputType.asyncNotify:
				return this.handleNotify(node)
			case MiOutputType.result:
				this.logger.debug('mi2 result message:', JSON.stringify(node, null, 2))
				return true
			default:
				return false
		}
	}

	private handleNotify(node: IAsyncNode) {
		if (node.className === 'thread-created') {
			this._onThreadNotify.fire({ type: ThreadNotify.Created, id: node.result('id') })
		} else if (node.className === 'thread-exited') {
			this._onThreadNotify.fire({ type: ThreadNotify.Exited, id: node.result('id') })
		} else if (node.className === 'thread-group-added') {
			this._onThreadNotify.fire({ type: ThreadNotify.GroupAdd, id: node.result('id') })
		} else if (node.className === 'thread-group-started') {
			this._onThreadNotify.fire({ type: ThreadNotify.GroupStarted, id: node.result('id') })
		} else if (node.className === 'thread-group-exited') {
			this._onThreadNotify.fire({ type: ThreadNotify.GroupExited, id: node.result('id') })
		} else if (node.className === 'breakpoint-modified') {
			this.logger.warning(`// TODO notify: ${node.className}`)
		} else if (node.className === 'memory-changed') {
			this.logger.warning(`// TODO notify: ${node.className}`)
		} else {
			this.logger.warning(`missing notify: ${node.className}`)
			return false
		}
		return true
	}

	private handleStatus(node: IAsyncNode) {
		if (node.isUnhandled() && node.className === 'download') {
			this.logger.writeln('unhandled download: ' + JSON.stringify(node))
			return true
		}
	}

	private handleExec(node: IAsyncNode) {
		this.logger.warning('MI2Node: ', node)
		const event: IRunStateEvent = {
			allThreads: node.result('stopped-threads') === 'all',
			threadId: parseInt(node.result('thread-id')),
		} as IRunStateEvent
		if (node.className === 'stopped') {
			event.running = false
			const reason = node.result('reason')

			if (reason === undefined) {
				event.reason = StopReason.UnknownReason
				if (this.firstTimeStop) {
					event.reason = StopReason.Startup
				}
			} else if (reason === 'breakpoint-hit') {
				event.reason = StopReason.Breakpoint
			} else if (reason === 'end-stepping-range') {
				event.reason = StopReason.StepComplete
			} else if (reason === 'function-finished') {
				event.reason = StopReason.StepComplete
			} else if (reason === 'signal-received') {
				event.reason = StopReason.SignalStop
			} else if (reason === 'exited-normally') { // this never run, we are running on chip
				this.logger.error('Program exited normally')
				setImmediate(() => {this.dispose()})
			} else if (reason === 'exited') { // this never run, we are running on chip
				this.logger.error('Program exited with code ' + node.result('exit-code'))
				setImmediate(() => {this.dispose()})
			} else {
				this.logger.error('Not implemented stop reason (assuming exception): ' + reason)
				return false
			}

			event.reasonString = `${reason} @ ${node.result('frame.addr')} (${node.result('frame.func')})`
			this.firstTimeStop = false
		} else if (node.className === 'running') {
			event.running = true
			event.reason = StopReason.UnknownReason
		} else {
			return false
		}
		this.logger.debug(`exec event dump: ${dumpJson(node)}`)

		const stateChanged = this._isRunning !== event.running
		this._isRunning = !!event.running

		if (event.running) {
			if (this.awaitingInterrupt) {
				this.awaitingInterrupt.error(new Error('program is not interrupt, but continue.'))
			}
			if (this.awaitingContinue) {
				this.awaitingContinue.complete()
			}
		} else {
			if (this.awaitingInterrupt) {
				this.awaitingInterrupt.complete()
			}
			if (this.awaitingContinue) {
				this.awaitingContinue.error(new Error('program is not interrupt, but continue.'))
			}
		}

		this.logger.writeln(`exec change [fire=${stateChanged}]: ${node.className}: ${StopReason[event.reason]} = ${event.reasonString}`)
		event.realChange = stateChanged
		this._onTargetRunStateChange.fire(event)
		return true
	}
}