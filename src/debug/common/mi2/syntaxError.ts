const stackModify = / \(.+\/mi2Parser\.[tj]s:\d+:\d+\)/g

export class Mi2SyntaxError extends SyntaxError {
	constructor(msg: string, fullOutput: string, output: string) {
		const o = fullOutput.substr(0, fullOutput.length - output.length) + '🔥' + output
		super(`${msg}\n    of: ${o}`)
		this.stack = (this.stack || '').replace(stackModify, '')
	}
}
