import { Response } from 'vscode-debugadapter'
import { dumpJson } from '../../common/library/strings'
import { IResultNode } from '../../common/mi2/mi2Node'

const responseSymbol = Symbol('alreadyResponse')

interface ResponseExpand extends Response {
	[responseSymbol]: (String | Symbol)[]
}

export function handleMethodPromise(code?: number, actionTitle?: string): MethodDecorator {
	return (target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
		actionTitle = actionTitle || `GDB: cannot ${propertyKey.toString()}: {message}`
		if (typeof descriptor.value === 'function') {
			const original: Function = descriptor.value
			descriptor.value = function (this: any, response: ResponseExpand, ...others: any[]) {
				this.vscodeProtocolLogger.info(`::%s()`, propertyKey)

				return Promise.resolve(original.apply(this, arguments)).then(() => {
					if (response[responseSymbol]) {
						response[responseSymbol].push(propertyKey)
						this.vscodeProtocolLogger.error(`::%s() duplicate resolve, stack = %s`, propertyKey, response[responseSymbol])
					} else {
						this.vscodeProtocolLogger.trace('result', dumpJson(response))

						this.vscodeProtocolLogger.info(`::%s() resolved`, propertyKey)
						this.vscodeProtocolLogger.writeln('')
						response[responseSymbol] = [propertyKey]
						this.sendResponse(response)
					}
				}, (e) => {
					if (!(e instanceof Error)) {
						const msg = e ? e.message || 'NoMessage' : 'NoMessage'
						e = new Error('Unknown reason: ' + msg)
					}

					this.debugConsole.error('Internal error occurred. See log for more information.')
					this.vscodeProtocolLogger.info(`::%s() rejected:\n~~~~~~~~~~~~~~~~~~~\n%s\n~~~~~~~~~~~~~~~~~~~`, propertyKey, e.stack)
					this.vscodeProtocolLogger.writeln('')
					code = (e instanceof ErrorCode) ? e.code : 233
					this.sendErrorResponse(response, code, actionTitle, {
						message: e.message,
						code,
						stack: e.stack,
					})
				})
			}
			return descriptor
		} else {
			throw new Error('Cannot decorate ' + propertyKey.toString())
		}
	}
}

export class ErrorCode extends Error {
	constructor(public readonly code: number, message: string) {
		super(message)
	}
}

export class ErrorMi2 extends Error {
	constructor(public readonly node: IResultNode, message: string) {
		super(message)
	}
}
