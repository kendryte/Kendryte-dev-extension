import * as vscode from 'vscode'
import { Devices } from '@service/devices'

export const pickDevice = (devicesService: Devices): vscode.Disposable => {
    return vscode.commands.registerCommand('extension.pickDevice', async () => {
        return new Promise(async (resolve, reject) => {
            const quickPick = vscode.window.createQuickPick()
            let devices = await devicesService.getDiveceList()
            devices = devices.filter(portInfo => {
                return !!portInfo.productId
            })
            console.log(devices)
            quickPick.items = devices.map((portInfo): vscode.QuickPickItem => {
                return {
                    // label: portInfo.manufacturer ? `${portInfo.comName}: ${portInfo.manufacturer}` : portInfo.comName,
                    label: portInfo.path,
                    description: portInfo.serialNumber || portInfo.productId,
                    detail: portInfo.pnpId,
                    picked: portInfo.path === devicesService.device,
                }
            })
            if (quickPick.items.length === 0) {
                reject('No device found')
                return
            }
            quickPick.show()
            quickPick.onDidChangeSelection(async event => {
                await devicesService.setDevice(event[0].label)
                quickPick.dispose()
                resolve(devicesService.device)
            })
            quickPick.onDidHide(event => {
                if (!devicesService.device) {
                    vscode.window.showErrorMessage('Please select a device.')
                }
            })
        })
    })
}