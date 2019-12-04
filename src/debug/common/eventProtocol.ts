import { LogLevel } from '@utils/baseLogger'

export interface Body {
	[id: string]: any
}

export interface ICustomEvent<BODY extends Body = Body> {
	type: string
	event: BODY
}

export interface ILogEventBody {
	level: LogLevel
	message: string
	args?: string[]
}