import { StoppedEvent } from 'vscode-debugadapter'
import { DebugProtocol } from 'vscode-debugprotocol'


export function createStopEvent(reason: StopReason, threadId?: number, description?: string) {
	const ev: DebugProtocol.StoppedEvent = new StoppedEvent(stopReasonString(StopReason.Pausing))
	const b = ev.body
	if (threadId) {
		b.threadId = threadId
	} else {
		b.threadId = 1
		b.allThreadsStopped = true
	}
	if (description) {
		b.description = description
	}
	return ev
}

export function stopReasonString(reason: StopReason) {
	switch (reason) {
		case StopReason.Breakpoint:
			return 'breakpoint'
		case StopReason.StepComplete:
			return 'step'
		case StopReason.SignalStop:
			return 'pause'
		case StopReason.UserCause:
			return 'user request'
		case StopReason.Startup:
			return 'entry'
		case StopReason.Pausing:
			return 'pause'
		default:
			return 'unknown'
	}
}

export enum StopReason {
	UnknownReason,
	Breakpoint,
	StepComplete,
	SignalStop,
	Startup,
	UserCause,
	Pausing,
}