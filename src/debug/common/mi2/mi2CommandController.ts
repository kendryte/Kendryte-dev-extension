import { ErrorMi2 } from '../../backend/lib/handleMethodPromise'
import { DeferredPromise, ProgressPromise } from '../deferredPromise'
import { Emitter } from '../event'
import { autoIncrease } from '../guid'
import { dumpJson } from '../library/strings'
import { IAsyncNode, IResultNode, OneOfMiNodeType } from './mi2Node'
import { isMi2Output, MiOutputType, parseMI } from './mi2Parser'
import { IMyLogger } from '@utils/baseLogger'
import split2 = require('split2')

export interface IHandlerData extends IHandlerPublicData {
	deferred: DeferredPromise<IResultNode, IResultNode | IAsyncNode>
	token: number
	command: string
}

export interface ISimpleOutput {
	error: boolean
	message: string
}

export interface IHandlerPublicData {
	promise: ProgressPromise<IResultNode, IResultNode | IAsyncNode>
	token: number
	command: string
}

const isPrompt = /^\s*\(gdb\)\s*$/

/**
 * Mi2协议层
 * 接近原始MI2协议，输入指令字符串，运行，然后返回MI2结构体
 * 无自动应答操作
 */
export class Mi2CommandController {
	private readonly handlers = new Map<number, IHandlerData>()
	// private readonly results = new WeakMap<IHandlerData, MINode>()
	private readonly currentToken = autoIncrease()

	private readonly _onSimpleLine = new Emitter<ISimpleOutput>()
	public readonly onSimpleLine = this._onSimpleLine.event

	private readonly _onReceiveMi2 = new Emitter<OneOfMiNodeType>()
	public readonly onReceiveMi2 = this._onReceiveMi2.event

	constructor(
		private readonly input: NodeJS.WritableStream,
		private readonly output: NodeJS.ReadableStream,
		private readonly logger: IMyLogger,
	) {
		output.pipe(split2()).on('data', (line) => this.parseLine(line))
	}

	dispose() {
		this._onSimpleLine.dispose()
		this._onReceiveMi2.dispose()
	}

	send(command: string): IHandlerPublicData {
		const token = this.currentToken.next()
		const deferred = new DeferredPromise<IResultNode, IResultNode | IAsyncNode>()

		const ret: IHandlerData = {
			token,
			deferred,
			promise: deferred.p,
			command: command,
		}

		deferred.p.finally(() => {
			this.handlers.delete(token)
		})

		setImmediate(() => {
			this.input.write(`${token}-${command}\n`)
		})

		this.handlers.set(token, ret)
		return ret
	}

	private parseLine(line: string) {
		if (!isMi2Output.test(line)) {
			if (isPrompt.test(line)) {
				return
			}

			this._onSimpleLine.fire({
				error: false,
				message: line + '\n',
			})
			return
		}

		const node = parseMI(line)
		node.handled = !!this.recv(line, node)

		if (node.isUnhandled()) {
			this._onReceiveMi2.fire(node)
		}

		if (node.isUnhandled()) {
			this._onSimpleLine.fire({
				error: true,
				message: 'Unhandled GDB output: ' + line + dumpJson(node) + '\n',
			})
		}
	}

	private recv<NT>(line: string, node: OneOfMiNodeType) {
		switch (node.type) {
			case MiOutputType.streamConsole:
				this._onSimpleLine.fire({
					error: true,
					message: node.content.replace(/\s+$/, '') + '\n',
				})
				return true
			case MiOutputType.streamLog:
				this._onSimpleLine.fire({
					error: false,
					message: node.content.replace(/\s+$/, '') + '\n',
				})
				return true
			case MiOutputType.streamTarget:
				return false
		}

		const item = this.handlers.get(node.token)

		if (node.type === MiOutputType.result) {
			if (!item) {
				throw new Error(`command ${node.token} return, but not exists: ${line}`)
			}
			if (node.className === 'error') {
				const msg = node.result<string>('msg')
				item.deferred.error(new ErrorMi2(node, msg))
				return true
			} else if (node.className) {
				item.deferred.complete(node)
				return true
			} else {
				return false
			}
		}

		if (!item) {
			return false
		}

		if (node.type === MiOutputType.asyncStatus) {
			if (node.className === 'download') {
				item.deferred.notify(node)
				return true
			}
		}
	}
}