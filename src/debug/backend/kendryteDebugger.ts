import { posix } from 'path'
import { DebugSession, Handles, InitializedEvent, Scope, Source, StackFrame, Thread } from 'vscode-debugadapter'
import { DebugProtocol } from 'vscode-debugprotocol'
import { IMyLogger } from '@utils/baseLogger'
import { objectPath } from '../common/library/objectPath'
import { errorMessage, errorStack } from '../common/library/strings'
import { isCommandIssueWhenRunning } from '../common/mi2/mi2AutomaticResponder'
import { createStopEvent, StopReason } from '../common/mi2/pause'
import { BreakpointType, MyBreakpointFunc, MyBreakpointLine } from '../common/mi2/types'
import { toProtocolBreakpoint } from '../common/mi2/types.convert'
import { BackendLogger } from './lib/backendLogger'
import { IDebugConsole, wrapDebugConsole } from './lib/duplexDebugConsole'
import { ErrorCode, ErrorMi2, handleMethodPromise } from './lib/handleMethodPromise'
import { expandValue } from './session/gdb_expansion'
import { DebuggingSession } from './session/session'
import { AttachRequestArguments, LaunchRequestArguments, ValuesFormattingMode, VariableObject } from './type'

const resolve = posix.resolve
const relative = posix.relative

class ExtendedVariable {
	constructor(public name: VariableId, public options: any) {
	}
}

type VariableId = number | string | VariableObject | ExtendedVariable

enum ErrorCodeValue {
	Unknown = 1,
	Restart,
	Initialize,
	Evaluate,
	Attach,
	Launch,
	Disconnect,
	SetVariable,
	Breakpoints,
	Threads,
	StackTrace,
	init,
	Scopes,
	VariableNumber,
	VariableString,
	ExpandVariable,
	VariableObject,
	VariableExtend,
	Continue,
	Pause,
	StepIn,
	StepOut,
	StepNext,
}

const STACK_HANDLES_START = 1000
const VAR_HANDLES_START = 512 * 256 + 1000

export class KendryteDebugger extends DebugSession {
	protected variableHandles = new Handles<VariableId>(VAR_HANDLES_START)
	protected variableHandlesReverse: { [id: string]: number } = {}
	protected useVarObjects!: boolean
	protected debugInstance!: DebuggingSession

	protected readonly debugLogger: IMyLogger
	protected readonly vscodeProtocolLogger: IMyLogger
	private readonly debugConsole: IDebugConsole

	private initComplete: boolean = false
	private autoContinue: boolean = true
	private firstThreadRequest: boolean = true

	public constructor(debuggerLinesStartAt1: boolean, isServer: boolean = false) {
		super(debuggerLinesStartAt1, isServer)

		this.vscodeProtocolLogger = new BackendLogger('protocol', this)
		this.debugLogger = new BackendLogger('gdb', this)

		this.debugConsole = wrapDebugConsole(this, this.vscodeProtocolLogger)

		process.on('unhandledRejection', (reason, p) => {
			p.catch((e) => {
				if (e instanceof ErrorMi2) {
					this.debugLogger.error('Unhandled Mi2 Rejection: ' + (e.node.token ? 'token=' + e.node.token : 'result=' + e.node.rawLine))
					this.debugLogger.error(errorStack(e))
				} else {
					this.debugLogger.error('Unhandled Rejection: ' + errorStack(e))
				}
				this.debugConsole.errorUser('[kendryte debug] Unhandled Rejection: ' + errorMessage(e))
			})
		})

		process.on('uncaughtException', (err) => {
			console.error(err)
			this.debugLogger.error('uncaughtException: ' + errorStack(err))
			this.debugConsole.errorUser('[kendryte debug] Fatal error during debugging session. Catched unhandled exception.\n' + errorStack(err))
			setTimeout(() => {
				process.exit(1)
			}, 2000)
		})
	}

	private fireEvent(ev: DebugProtocol.Event) {
		if (this.autoContinue && !this.initComplete && (ev.event === 'stopped' || ev.event === 'continued')) {
			this.vscodeProtocolLogger.info('initialize not complete, event muted:', JSON.stringify(ev))
			return
		}
		this.vscodeProtocolLogger.info('fireEvent: [%s]%s', ev.event, JSON.stringify(ev.body))
		this.sendEvent(ev)
	}

	private resetStatus() {
		delete this.debugInstance
		this.initComplete = false
		this.autoContinue = true
	}

	private async attachOrLaunch(args: AttachRequestArguments | LaunchRequestArguments, load: boolean) {
		if (this.debugInstance) {
			await this.debugInstance.terminate()
		}

		const logger = new BackendLogger(args.id ? 'gdb-' + args.id : 'gdb-main', this)
		const debugConsole = wrapDebugConsole(this, logger)
		this.debugInstance = new DebuggingSession(args, logger, debugConsole)
		this.debugInstance.onEvent((ev) => this.fireEvent(ev))

		await this.debugInstance.connect(load)
		this.setValuesFormattingMode(args.valuesFormatting)

		this.debugInstance.disconnected.then((self) => {
			if (self === this.debugInstance) {
				this.resetStatus()
			}
		})

		this.sendEvent(new InitializedEvent())
		this.initComplete = true
	}

	protected setValuesFormattingMode(mode: ValuesFormattingMode) {
		switch (mode) {
			case 'disabled':
				this.useVarObjects = true
				// this.debugInstance.prettyPrint = false
				break
			case 'prettyPrinters':
				this.useVarObjects = true
				// this.debugInstance.prettyPrint = true
				break
			case 'parseText':
			default:
				this.useVarObjects = false
			// this.debugInstance.prettyPrint = false
		}
	}

	// Supports 256 threads.
	protected threadAndLevelToFrameId(threadId: number, level: number) {
		return level << 8 | threadId
	}

	protected frameIdToThreadAndLevel(frameId: number) {
		return [frameId & 0xff, frameId >> 8]
	}

	private _createVariable(arg: VariableId, options?: any) {
		if (options) {
			return this.variableHandles.create(new ExtendedVariable(arg, options))
		} else {
			return this.variableHandles.create(arg)
		}
	}

	private _findOrCreateVariable(varObj: VariableObject): number {
		let id: number
		if (this.variableHandlesReverse.hasOwnProperty(varObj.name)) {
			id = this.variableHandlesReverse[varObj.name]
		} else {
			id = this._createVariable(varObj)
			this.variableHandlesReverse[varObj.name] = id
		}
		return varObj.isCompound() ? id : 0
	}

	@handleMethodPromise(ErrorCodeValue.VariableNumber)
	private async variableNumber(response: DebugProtocol.VariablesResponse, id: number): Promise<void> {
		const variables: DebugProtocol.Variable[] = []
		const [threadId, level] = this.frameIdToThreadAndLevel(id)
		const stack = await this.debugInstance.getStackVariables(threadId, level)
		for (const variable of stack) {
			if (this.useVarObjects) {
				try {
					const varObjName = `var_${id}_${variable.name}`
					let varObj: VariableObject
					try {
						const changes = await this.debugInstance.varUpdate(varObjName)
						const changelist = changes.result('changelist')
						changelist.forEach((change: any) => {
							const name = objectPath(change, 'name')
							const vId = this.variableHandlesReverse[name]
							const v = this.variableHandles.get(vId) as any
							v.applyChanges(change)
						})
						const varId = this.variableHandlesReverse[varObjName]
						varObj = this.variableHandles.get(varId) as any
					} catch (err) {
						if (err.message.includes('Variable object not found')) {
							varObj = await this.debugInstance.varCreate(variable.name, varObjName)
							const varId = this._findOrCreateVariable(varObj)
							varObj.exp = variable.name
							varObj.id = varId
						} else {
							return Promise.reject(err)
						}
					}
					variables.push(varObj.toProtocolVariable())
				} catch (err) {
					variables.push({
						name: variable.name,
						value: `<${err}>`,
						variablesReference: 0,
					})
				}
			} else {
				if (variable.valueStr !== undefined) {
					let expanded = expandValue(this._createVariable.bind(this), `{${variable.name}=${variable.valueStr})`, '', variable.raw)
					if (expanded) {
						if (typeof expanded[0] == 'string') {
							expanded = [
								{
									name: '<value>',
									value: prettyStringArray(expanded),
									variablesReference: 0,
								},
							]
						}
						variables.push(expanded[0])
					}
				} else {
					variables.push({
						name: variable.name,
						type: variable.type,
						value: '<unknown>',
						variablesReference: this._createVariable(variable.name),
					})
				}
			}
		}
		response.body = { variables }
	}

	@handleMethodPromise(ErrorCodeValue.VariableString)
	private async variableString(response: DebugProtocol.VariablesResponse, id: string) {
		// Variable members
		// TODO: this evals on an (effectively) unknown thread for multithreaded programs.
		const variable = await this.debugInstance.evalExpression(JSON.stringify(id), 0, 0)
		let expanded = expandValue(this._createVariable.bind(this), variable.result('value'), id, variable)
		if (!expanded) {
			throw new ErrorCode(ErrorCodeValue.ExpandVariable, `Could not expand variable`)
		} else {
			if (typeof expanded[0] == 'string') {
				expanded = [
					{
						name: '<value>',
						value: prettyStringArray(expanded),
						variablesReference: 0,
					},
				]
			}
			response.body = { variables: expanded }
		}
	}

	@handleMethodPromise(ErrorCodeValue.VariableObject)
	private async variableObject(response: DebugProtocol.VariablesResponse, id: VariableObject) {
		// Variable members
		const children: VariableObject[] = await this.debugInstance.varListChildren(id.name)
		const vars = children.map(child => {
			child.id = this._findOrCreateVariable(child)
			return child.toProtocolVariable()
		})

		response.body = { variables: vars }
	}

	@handleMethodPromise(ErrorCodeValue.VariableExtend)
	private async variableExtended(response: DebugProtocol.VariablesResponse, varReq: ExtendedVariable) {
		response.body = { variables: [] }

		if (varReq.options.arg) {
			let argsPart = true
			let arrIndex = 0
			const addOne = async () => {
				// TODO: this evals on an (effectively) unknown thread for multithreaded programs.
				const variable = await this.debugInstance.evalExpression(JSON.stringify(`${varReq.name}+${arrIndex})`), 0, 0)
				const expanded = expandValue(this._createVariable.bind(this), variable.result('value'), '' + varReq.name, variable)
				if (!expanded) {
					throw new ErrorCode(ErrorCodeValue.ExpandVariable, `Could not expand variable`)
				}
				try {
					if (typeof expanded == 'string') {
						if (expanded == '<nullptr>') {
							if (argsPart) {
								argsPart = false
							} else {
								return
							}
						} else if (expanded[0] != '"') {
							response.body.variables.push({
								name: '[err]',
								value: expanded,
								variablesReference: 0,
							})
							return
						}
						response.body.variables.push({
							name: `[${(arrIndex++)}]`,
							value: expanded,
							variablesReference: 0,
						})
						await addOne()
					} else {
						response.body.variables.push({
							name: '[err]',
							value: expanded,
							variablesReference: 0,
						})
						return
					}
				} catch (e) {
					throw new ErrorCode(ErrorCodeValue.ExpandVariable, `Could not expand variable: ${e}`)
				}
			}
			await addOne()
		} else {
			throw new ErrorCode(13, `Unimplemented variable request options: ${JSON.stringify(varReq.options)}`)
		}
	}

	@handleMethodPromise(ErrorCodeValue.Initialize)
	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
		this.vscodeProtocolLogger.info('initializeRequest: ')
		if (response.body) {
			response.body.supportsConfigurationDoneRequest = true
			response.body.supportsConditionalBreakpoints = true
			response.body.supportsFunctionBreakpoints = true
			response.body.supportsEvaluateForHovers = true
			response.body.supportsSetVariable = true
			response.body.supportsRestartRequest = true
			response.body.supportsLogPoints = true
		}
	}

	@handleMethodPromise(ErrorCodeValue.Disconnect)
	disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments) {
		return this.debugInstance.terminate()
	}

	@handleMethodPromise(ErrorCodeValue.Launch)
	protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments) {
		return this.attachOrLaunch(args, true)
	}

	@handleMethodPromise(ErrorCodeValue.Attach)
	protected async attachRequest(response: DebugProtocol.AttachResponse, args: AttachRequestArguments) {
		return this.attachOrLaunch(args, false)
	}

	@handleMethodPromise(ErrorCodeValue.Restart)
	async restartRequest(response: DebugProtocol.RestartResponse, args: DebugProtocol.RestartArguments) {
		return this.debugInstance.reload()
	}

	@handleMethodPromise(ErrorCodeValue.Breakpoints)
	async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments) {
		await this.debugInstance.connected

		const myBreaks: MyBreakpointLine[] = args.breakpoints ? args.breakpoints.map((bk) => {
			return <MyBreakpointLine>{
				type: BreakpointType.Line,
				file: args.source.path,
				line: bk.line,
				condition: bk.condition,
				logMessage: bk.logMessage,
			}
		}) : []

		const resultBreaks = await this.debugInstance.updateBreakPoints(args.source.path || '', myBreaks)

		if (!response.body) {
			response.body = { breakpoints: [] }
		}
		if (!response.body.breakpoints) {
			response.body.breakpoints = []
		}
		for (const newBreak of resultBreaks) {
			response.body.breakpoints.push(toProtocolBreakpoint(newBreak))
		}
	}

	@handleMethodPromise(ErrorCodeValue.Breakpoints)
	async setFunctionBreakPointsRequest(response: DebugProtocol.SetFunctionBreakpointsResponse, args: DebugProtocol.SetFunctionBreakpointsArguments) {
		await this.debugInstance.connected

		const myBreaks: MyBreakpointFunc[] = args.breakpoints.map((bk) => {
			return <MyBreakpointFunc>{
				type: BreakpointType.Function,
				name: bk.name,
				condition: bk.condition,
			}
		})
		const resultBreaks = await this.debugInstance.updateBreakPoints('', myBreaks)

		if (!response.body) {
			response.body = { breakpoints: [] }
		}
		if (!response.body.breakpoints) {
			response.body.breakpoints = []
		}
		for (const newBreak of resultBreaks) {
			response.body.breakpoints.push(toProtocolBreakpoint(newBreak))
		}
	}

	@handleMethodPromise(ErrorCodeValue.init)
	protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
		this.debugConsole.logUser('Configuration done!')

		setImmediate(() => {
			if (this.autoContinue && !this.debugInstance.isRunning) {
				this.debugInstance.continue().finally(() => {
					this.debugLogger.writeln('')
				})
			} else if (!this.autoContinue && this.debugInstance.isRunning) {
				this.debugInstance.interrupt().finally(() => {
					this.debugLogger.writeln('')
				})
			}
		})
	}

	@handleMethodPromise(ErrorCodeValue.Continue)
	continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments) {
		console.log('get continue')
		return this.debugInstance.continue()
	}

	@handleMethodPromise(ErrorCodeValue.StepNext)
	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments) {
		console.log('get next')
		return this.debugInstance.next()
	}

	@handleMethodPromise(ErrorCodeValue.StepIn)
	stepInRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments) {
		return this.debugInstance.step()
	}

	@handleMethodPromise(ErrorCodeValue.StepOut)
	stepOutRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments) {
		return this.debugInstance.stepOut()
	}

	@handleMethodPromise(ErrorCodeValue.Pause)
	async pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments) {
		await this.debugInstance.interrupt()
		setTimeout(() => {
			this.fireEvent(createStopEvent(StopReason.Pausing, undefined, 'pause button clicked'))
		}, 500)
	}

	@handleMethodPromise(ErrorCodeValue.Threads)
	async threadsRequest(response: DebugProtocol.ThreadsResponse) {
		if (!this.debugInstance) {
			return
		}
		const threads = await this.debugInstance.getThreads(this.firstThreadRequest).catch((e) => {
			if (isCommandIssueWhenRunning(e)) {
				return []
			} else {
				throw e
			}
		})

		this.firstThreadRequest = false

		response.body = {
			threads: [],
		}
		for (const thread of threads) {
			let threadName = thread.name
			// TODO: Thread names are undefined on LLDB
			if (threadName === undefined) {
				threadName = thread.targetId
			}
			if (threadName === undefined) {
				threadName = '<unnamed>'
			}
			response.body.threads.push(new Thread(thread.id, thread.id + ':' + threadName))
		}
	}

	@handleMethodPromise(ErrorCodeValue.StackTrace)
	protected async stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments) {
		const stack = await this.debugInstance.getStack(args.levels || 0, args.threadId)
		const ret: StackFrame[] = []
		stack.forEach(element => {
			let source = undefined
			let file = element.file
			if (file) {
				if (process.platform === 'win32') {
					if (file.startsWith('\\cygdrive\\') || file.startsWith('/cygdrive/')) {
						file = file[10] + ':' + file.substr(11) // replaces /cygdrive/c/foo/bar.txt with c:/foo/bar.txt
					}
				}
				source = new Source(element.fileName, file)
			}

			ret.push(new StackFrame(
				this.threadAndLevelToFrameId(args.threadId, element.level),
				element.function + '@' + element.address,
				source,
				element.line,
				0,
			))
		})
		response.body = {
			stackFrames: ret,
		}
	}

	/*
	@handleMethodPromise(4, 'Could not step back: %s - Try running \'target record-full\' before stepping back')
	protected stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments): void {
		return this.debugInstance.step()
	}
	*/

	@handleMethodPromise(ErrorCodeValue.Scopes)
	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments) {
		const scopes: Scope[] = []
		scopes.push(new Scope('Local', STACK_HANDLES_START + (parseInt(args.frameId as any) || 0), false))

		response.body = {
			scopes: scopes,
		}
	}

	protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): Promise<void> | undefined {
		let id: VariableId
		if (args.variablesReference < VAR_HANDLES_START) {
			id = args.variablesReference - STACK_HANDLES_START
		} else {
			id = this.variableHandles.get(args.variablesReference)
		}

		if (typeof id == 'number') {
			return this.variableNumber(response, id)
		} else if (typeof id == 'string') {
			return this.variableString(response, id)
		} else if (id && id instanceof VariableObject) {
			return this.variableObject(response, id)
		} else if (id && id instanceof ExtendedVariable) {
			return this.variableExtended(response, id)
			// } else if (typeof id === 'object') {
			// 	response.body = {
			// 		variables: id as any,
			// 	}
			// 	this.sendResponse(response)
		} else {
			response.body = { variables: [] }
			this.sendResponse(response)
		}
	}

	@handleMethodPromise(ErrorCodeValue.SetVariable)
	async setVariableRequest(response: DebugProtocol.SetVariableResponse, args: DebugProtocol.SetVariableArguments): Promise<void> {
		if (this.useVarObjects) {
			let name = args.name
			if (args.variablesReference >= VAR_HANDLES_START) {
				const parent = this.variableHandles.get(args.variablesReference) as VariableObject
				name = `${parent.name}.${name}`
			}

			const newValue = await this.debugInstance.varAssign(name, args.value)
			response.body = { value: newValue }
		} else {
			const value = await this.debugInstance.changeVariable(args.name, args.value)
			response.body = { value }
		}
	}

	@handleMethodPromise(ErrorCodeValue.Evaluate)
	async evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments) {
		const [threadId, level] = this.frameIdToThreadAndLevel(args.frameId || 0)
		if (args.context == 'watch' || args.context == 'hover') {
			const res = await this.debugInstance.evalExpression(args.expression, threadId, level)
			response.body = {
				variablesReference: 0,
				result: res.result('value'),
			}
		} else {
			const output = await this.debugInstance.sendUserInput(args.expression, threadId, level)
			if (typeof output == 'undefined') {
				response.body = {
					result: '',
					variablesReference: 0,
				}
			} else {
				response.body = {
					result: JSON.stringify(output),
					variablesReference: 0,
				}
			}
		}
	}
}

function prettyStringArray(strings: any) {
	if (typeof strings == 'object') {
		if (strings.length !== undefined) {
			return strings.join(', ')
		} else {
			return JSON.stringify(strings)
		}
	} else {
		return strings
	}
}
