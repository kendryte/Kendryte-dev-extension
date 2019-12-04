import * as vscode from 'vscode'
import { Devices } from '@service/devices'
import { FrontendChannelLogger } from '@utils/index'
import { SerialPortService } from '@service/serialport'

export const openSerialPort = (deviceService: Devices, logger: FrontendChannelLogger, serialPort: SerialPortService): vscode.Disposable => {
    return vscode.commands.registerCommand('extension.openSerialPort', async () => {
        if (!deviceService.device) {
            await vscode.commands.executeCommand('extension.pickDevice')
        }
        logger.show()
        if (serialPort.status) {
            logger.info(`===================== Stop serial port output ${(new Date()).toLocaleTimeString()} =====================`)
            serialPort.setStatus(false)
        } else {
            serialPort.setStatus(true)
            serialPort.on('data', data => {
                logger.info(data)
            })
            serialPort.on('close', err => {
                if (err && err.disconnected) {
                    serialPort.disposeSerialPort()
                    vscode.window.showInformationMessage(`${deviceService.device} disconnected.`)
                    deviceService.setDevice()
                }
                serialPort.removeAllListeners()
            })
        }
    })
}