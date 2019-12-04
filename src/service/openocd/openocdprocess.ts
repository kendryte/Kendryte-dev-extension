import * as vscode from 'vscode'
import { spawn } from 'child_process'
import { FrontendChannelLogger, throttleOffset, systemFilter } from '@utils/index'
import { join } from 'path'

export class Process {
    private readonly pid: number
    private readonly logger: FrontendChannelLogger
    private readonly clearFunc: () => void

    constructor(
        logger: FrontendChannelLogger,
        clearFunc: () => void
    ) {
        this.logger = logger
        this.clearFunc = clearFunc
        this.pid = this.start()
    }
    private start(): number {
        const args = ['-f', `${vscode.workspace.rootPath}/.vscode/openocd.cfg`]
        const openocdPath = join(process.env.packagePath || '', 'openocd')
        const openocd = systemFilter(join(openocdPath, 'openocd.exe'), join(openocdPath, 'openocd'), join(openocdPath, 'openocd'))
        const openocdService = spawn(openocd, args)
        openocdService.stdout.on('data', throttleOffset(data => {
            this.logger.info(data)
        }, 10, 5000))
        openocdService.stderr.on('data', throttleOffset(data => {
            this.logger.info(data)
        }, 10, 5000))
        openocdService.on('error', throttleOffset(err => {
            this.logger.error(err.message)
        }, 10, 5000))
        openocdService.on('close', code => {
            if (code === 0)
                this.logger.info(`Command execution completed with code: ${code}`)
            else {
                this.logger.error(`Command execution failed with code: ${code}`)
                if (code === 1) {
                    this.clearFunc()
                    this.logger.show()
                    vscode.window.showErrorMessage('Openocd service start failed. Please check openocd output channel.')
                }
            }
        })
        return openocdService.pid
    }

    public kill(): void {
        if (/^win/.test(process.platform)) {
            spawn("taskkill", ["/PID", this.pid.toString(), "/T", "/F"])

            // 确保 kill 掉 openocd 
            const killProcess = spawn('taskkill', ['/IM', '"openocd.exe"', '/F'])
            killProcess.stdout.on('data', data => this.logger.info(data))
            killProcess.stderr.on('data', data => this.logger.error(data))
        } else {
            process.kill(this.pid, 'SIGTERM')

            // 确保 kill 掉 openocd 
            const killProcess = spawn('killall', ['SIGKILL', 'openocd'])
            killProcess.stdout.on('data', data => this.logger.info(data))
            killProcess.stderr.on('data', data => this.logger.error(data))
        }
    }
}