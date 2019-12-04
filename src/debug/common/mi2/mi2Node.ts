import { inspect } from 'util'
import { objectPath } from '../library/objectPath'
import { MiOutputType } from './mi2Parser'

export interface IMapLike {
	[varName: string]: IMapLike | ReadonlyArray<any> | string
}

interface WithData {
	readonly data: IMapLike
	result<T = any>(path: string): T
}

interface WithToken {
	readonly token: number
}

export type OneOfMiNodeType = IResultNode | IAsyncNode | IStreamNode

export interface IResultNode extends WithData, WithToken, MINode {
	readonly type: MiOutputType.result

	readonly className: 'done' | 'running' | 'connected' | 'error' | 'exit'
}

export interface IAsyncNode extends WithData, WithToken, MINode {
	readonly type: MiOutputType.asyncExec | MiOutputType.asyncStatus | MiOutputType.asyncNotify

	readonly className: string
}

export interface IStreamNode extends MINode {
	readonly type: MiOutputType.streamConsole | MiOutputType.streamTarget | MiOutputType.streamLog
	readonly content: string
}

export interface MINode {
	rawLine: string
	isUnhandled(): boolean
	handled: boolean
}

abstract class MIBaseImpl implements MINode {
	private _handled: boolean = false

	protected constructor(
		public readonly rawLine: string,
		public readonly token: number,
		public readonly data: any,
	) {
	}

	[inspect.custom](depth: any, opts: { colors: any }) {
		const obj = {
			...JSON.parse(JSON.stringify(this)),
		}
		delete obj.rawLine

		return '[' + this.constructor.name + ' ' + MiOutputType[(this as any).type] + '] ' +
		       (opts.colors ? '\x1B[38514m' : '') + this.rawLine + (opts.colors ? '\x1B[0m' : '') + ' ' +
		       JSON.stringify(obj, null, 4)
	}

	isUnhandled() {
		return !this._handled
	}

	get handled() {
		return this._handled
	}

	set handled(v: boolean) {
		if (v && !this._handled) {
			this._handled = true
		}
	}

	result<T = any>(path: string): T {
		if (!this.data) {
			throw new Error()
		}
		return objectPath(this.data as any, path)
	}
}

export class MIResultNodeImpl extends MIBaseImpl implements IResultNode {
	constructor(
		rawLine: string,
		public readonly type: MiOutputType.result,
		token: number,
		readonly className: 'done' | 'running' | 'connected' | 'error' | 'exit',
		data: any,
	) {
		super(rawLine, token, data)
	}
}

export class MIAsyncNodeImpl extends MIBaseImpl implements IAsyncNode {
	constructor(
		rawLine: string,
		public readonly type: MiOutputType.asyncExec | MiOutputType.asyncStatus | MiOutputType.asyncNotify,
		token: number,
		readonly className: string,
		data: any,
	) {
		super(rawLine, token, data)
	}
}

export class MIStreamNodeImpl extends MIBaseImpl implements IStreamNode {
	constructor(
		rawLine: string,
		public readonly type: IStreamNode['type'],
		public readonly content: any,
	) {
		super(rawLine, 0, undefined)
	}
}
