import { DebugSession, OutputEvent } from 'vscode-debugadapter'
import { IMyLogger } from '@utils/baseLogger'

export interface IDebugConsole {
	log(message: string): void
	error(message: string): void
	logUser(message: string): void
	errorUser(message: string): void
}

export function wrapDebugConsole(session: DebugSession, logger: IMyLogger): IDebugConsole {
	return {
		logUser(message: string) {
			this.log(message + '\n')
		},
		errorUser(message: string) {
			this.error(message + '\n')
		},
		log(message: string) {
			session.sendEvent(new OutputEvent(message, 'stdout'))
		},
		error(message: string) {
			session.sendEvent(new OutputEvent(message, 'stderr'))
		},
	}
}