import { ChildProcess, spawn } from 'child_process'
import { resolve } from 'path'
import { IMyLogger } from '@utils/baseLogger'

export interface ISpawnArguments {
	gdb: string
	app: string
	env: NodeJS.ProcessEnv
	args: string[]
	logger: IMyLogger
}

export interface IChildProcess extends ChildProcess {
}

export function createGdbProcess(arg: ISpawnArguments): IChildProcess {
	const logger = arg.logger
	const args = ['--interpreter=mi2', '--quiet']
	if (arg.args) {
		args.push(...arg.args)
	}

	logger.info(`gdb: ${arg.gdb}`)
	logger.info(`app: ${arg.app}`)
	logger.info(`args: ${args.join(', ')}`)
	logger.debug(`env: ${JSON.stringify(arg.env, null, 8)}`)
	const process = spawn(arg.gdb, [arg.app, ...args], {
		cwd: resolve(arg.app, '..'),
		env: arg.env,
		stdio: 'pipe',
		shell: false,
		windowsHide: true,
	})
	logger.info(`pid: ${process.pid}`)

	return process
}

export function waitProcess(p: ChildProcess) {
	return new Promise<void>((resolve, reject) => {
		p.on('error', reject)
		p.on('exit', (code, signal) => {
			if (code === 0) {
				resolve()
			} else {
				reject(new Error(`child process exit with code ${code || '?'}, signal ${signal || '?'}`))
			}
		})
	})
}
