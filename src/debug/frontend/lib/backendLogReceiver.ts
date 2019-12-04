import { createWriteStream, WriteStream } from 'fs'
import * as vscode from 'vscode'
import { IMyLogger, LogLevel } from '@utils/baseLogger'
import { ICustomEvent, ILogEventBody } from '../../common/eventProtocol'
import { FrontendChannelLogger } from '@utils/extensionLogger'

export class BackendLogReceiver {
	public readonly logger: FrontendChannelLogger
	private handled!: vscode.Disposable

	constructor() {
		this.logger = new FrontendChannelLogger('B', 'kendryte.gdb')
		this.start()
	}

	dispose() {
		this.handled.dispose()
	}

	private start() {
		this.handled = vscode.debug.onDidReceiveDebugSessionCustomEvent((e: any) => {
			const customEvent: ICustomEvent = e.body
			if (!customEvent.event || !customEvent.type) {
				return
			}
			switch (customEvent.type) {
				case 'nl':
					this.logger.writeln('')
					break
				case 'log':
					const { level, message, args } = customEvent.event as ILogEventBody
					doLog(this.logger, level, message, args || [])
					break
				case 'clear-log':
					this.logger.clear()
					break
				default:
					this.logger.warning('Unknown event type: ' + customEvent.type + ': ' + JSON.stringify(customEvent.event))
					break
			}
		})
	}
}

function doLog(logger: IMyLogger, level: LogLevel, message: string, args: any[]): void {
	switch (level) {
		case LogLevel.Trace:
			return logger.trace(message, ...args)
		case LogLevel.Debug:
			return logger.debug(message, ...args)
		case LogLevel.Info:
			return logger.info(message, ...args)
		case LogLevel.Warning:
			return logger.warning(message, ...args)
		case LogLevel.Error:
			return logger.error(message, ...args)
		case LogLevel.Critical:
			return logger.critical(message, ...args)
		case LogLevel.Off:
			return logger.writeln(message, ...args)
		default:
			logger.warning('Unknown log message level: %s', level)
			return logger.writeln(message, ...args)
	}
}
