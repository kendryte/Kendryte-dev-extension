import * as vscode from 'vscode'
import { OpenocdService } from '@service/openocd'

export const openocdStart = (openocdService: OpenocdService) => {
    return vscode.commands.registerCommand('extension.openocd.start', async () => {
        openocdService.start()
    })
}

export const openocdStop = (openocdService: OpenocdService) => {
    return vscode.commands.registerCommand('extension.openocd.stop', async () => {
        openocdService.stop()
    })
}

export const openocdRestart = (openocdService: OpenocdService) => {
    return vscode.commands.registerCommand('extension.openocd.restart', () => {
        openocdService.restart()      
    })
}
