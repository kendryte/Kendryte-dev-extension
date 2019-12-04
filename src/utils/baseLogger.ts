import { format } from 'util'

export enum LogLevel {
	Trace,
	Debug,
	Info,
	Warning,
	Error,
	Critical,
	Off
}

export const LogLevelNames = {
	[LogLevel.Trace]: 'TRACE',
	[LogLevel.Debug]: 'DEBUG',
	[LogLevel.Info]: ' INFO',
	[LogLevel.Warning]: ' WARN',
	[LogLevel.Error]: 'ERR',
	[LogLevel.Critical]: 'FATAL',
	[LogLevel.Off]: 'OFF'
}

export interface IMyLogger {
	writeln(data: string, ...args: any[]): any

	trace(msg: string, ...args: any[]): any
	debug(msg: string, ...args: any[]): any
	info(msg: string, ...args: any[]): any
	warning(msg: string, ...args: any[]): any
	error(msg: string, ...args: any[]): any
	critical(msg: string, ...args: any[]): any
}

export abstract class NodeLoggerCommon implements IMyLogger {
	protected constructor(private readonly _tag: string) {
	}

	abstract clear(): void

	protected abstract printLine(tag: string, level: LogLevel, message: string): any

	protected prependTags(tag: string, message: string) {
		return message.replace(/^/g, `[${tag}] `).trim()
	}

	writeln(msg: string, ...args: any[]) {
		if (args.length) {
			msg = format(msg, ...args)
		}
		this.printLine(this._tag, LogLevel.Off, msg)
	}

	trace(msg: string, ...args: any[]) {
		if (args.length) {
			msg = format(msg, ...args)
		}
		this.printLine(this._tag, LogLevel.Trace, msg)
	}

	debug(msg: string, ...args: any[]) {
		if (args.length) {
			msg = format(msg, ...args)
		}
		this.printLine(this._tag, LogLevel.Debug, msg)
	}

	info(msg: string, ...args: any[]) {
		if (args.length) {
			msg = format(msg, ...args)
		}
		this.printLine(this._tag, LogLevel.Info, msg)
	}

	warning(msg: string, ...args: any[]) {
		if (args.length) {
			msg = format(msg, ...args)
		}
		this.printLine(this._tag, LogLevel.Warning, msg)
	}

	error(msg: string, ...args: any[]) {
		if (args.length) {
			msg = format(msg, ...args)
		}
		this.printLine(this._tag, LogLevel.Error, msg)
	}

	critical(msg: string, ...args: any[]) {
		if (args.length) {
			msg = format(msg, ...args)
		}
		this.printLine(this._tag, LogLevel.Critical, msg)
		throw new Error(msg)
	}
}
