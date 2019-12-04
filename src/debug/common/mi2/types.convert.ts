import { DebugProtocol } from 'vscode-debugprotocol'
import { BreakpointType, MyBreakpoint } from './types'

export function toProtocolBreakpoint(breakpoint: MyBreakpoint): DebugProtocol.Breakpoint {
	if (breakpoint.tried && (breakpoint.gdbBreakNum || 0) > 0) {
		return {
			id: breakpoint.gdbBreakNum,
			verified: true,
			source: {
				path: breakpoint.type === BreakpointType.Line ? breakpoint.file : undefined,
			},
			line: breakpoint.type === BreakpointType.Line ? breakpoint.line : undefined,
		}
	} else {
		return {
			verified: false,
			message: breakpoint.errorMessage,
		}
	}
}