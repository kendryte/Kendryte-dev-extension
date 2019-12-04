import * as vscode from 'vscode'
import { LogLevel, LogLevelNames, NodeLoggerCommon } from '@utils/baseLogger'

let globalChannel: vscode.OutputChannel
const channels: Array<string> = []

function globalLogChannelSingleton(channelName: string) {
	if (channels.indexOf(channelName) === -1) {
        globalChannel = vscode.window.createOutputChannel(channelName)
        channels.push(channelName)
	}
	return globalChannel
}

export function disposeChannel() {
	globalChannel.appendLine('will dispose')
	globalChannel.dispose()
}

export class FrontendChannelLogger extends NodeLoggerCommon {
	private currentLevel!: LogLevel

	constructor(
        tag: string,
        channelName: string,
		private readonly channel: vscode.OutputChannel = globalLogChannelSingleton(channelName),
	) {
		super(tag)
		this.setLevel(LogLevel.Info)
	}

	public setLevel(logLevel: LogLevel) {
		this.currentLevel = logLevel
	}

	clear() {
		this.channel.clear()
	}

	show() {
		this.channel.show()
	}

	protected printLine(tag: string, level: LogLevel, message: string) {
		if (this.currentLevel === LogLevel.Off || this.currentLevel > level) {
			return
		}
		if (message === '') {
			this.channel.appendLine('')
			return
		}

		if (typeof message !== 'string') {
			message = '' + message
		}

		const levelName = LogLevelNames[level]
		const fullTag = levelName ? `${tag}][${levelName}` : tag
		this.channel.appendLine(this.prependTags(fullTag, message))
	}
}


