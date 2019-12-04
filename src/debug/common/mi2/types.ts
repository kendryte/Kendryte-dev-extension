export enum BreakpointType {
	Function,
	Line,
}

interface MyBreakpointBase {
	gdbBreakNum?: number
	type: BreakpointType
	condition: string
	// countCondition: string
	tried?: boolean
	errorMessage?: string
	addr?: string
}

export interface MyBreakpointLine extends MyBreakpointBase {
	type: BreakpointType.Line
	file: string
	line: number
	logMessage: string
}

export interface MyBreakpointFunc extends MyBreakpointBase {
	type: BreakpointType.Function
	name: string
}

export type MyBreakpoint = MyBreakpointLine | MyBreakpointFunc

export interface IMyThread {
	id: number
	targetId: string
	name?: string
}

export interface IMyStack {
	level: number
	address: string
	function: string
	fileName: string
	file: string
	line: number
}

export interface IMyVariable {
	name: string
	valueStr: string
	type: string
	raw?: any
}
