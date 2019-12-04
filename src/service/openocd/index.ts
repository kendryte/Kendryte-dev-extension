import * as vscode from 'vscode'
import { FrontendChannelLogger, systemFilter } from '@utils/index'
import { spawn } from 'child_process'
import { Process } from '@service/openocd/openocdprocess'

export class OpenocdService {
    private process?: Process
    readonly logger: FrontendChannelLogger
    constructor(
        logger: FrontendChannelLogger
    ) {
        this.logger = logger
    }

    // Create openocd process
    private createOpenocdProcess = () => {
        this.process = new Process(this.logger, this.clearProcess)
    }

    public start = (): void => {
        if (this.process) {
            this.logger.info('Openocd Service is running')
            return
        }
        this.createOpenocdProcess()
    }
    public stop = (): void => {
        if (!this.process) {
            this.logger.info('Openocd service not found')
            return
        }
        this.process.kill()
        this.logger.info('Openocd is closed')
        delete this.process
    }
    public restart = (): void => {
        /*
            Why use killall command?
            To prevent openocd service error and process.kill doesn't work.
        */
        const killCommand = systemFilter('taskkill', 'killall', 'killall')
        const killArgs = systemFilter(['/IM', '"openocd.exe"', '/F'], ['SIGKILL', 'openocd'], ['SIGKILL', 'openocd'])
        const killProcess = spawn(killCommand, killArgs)
        killProcess.stdout.on('data', data => this.logger.info(data))
        killProcess.stderr.on('data', data => this.logger.error(data))
        killProcess.on('close', _ => {
            delete this.process
            vscode.commands.executeCommand('extension.openocd.start')
        })
    }

    clearProcess = () => {
        delete this.process
    }
}