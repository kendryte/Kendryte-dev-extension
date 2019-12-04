import * as vscode from 'vscode'
import { list, PortInfo } from 'serialport'
import { EventEmitter } from 'events'
import { SerialPortService } from './serialport'

export class Devices extends EventEmitter {
    private currentDevice: string | undefined
    private serialPort: SerialPortService

    constructor(sp: SerialPortService) {
        super()
        this.serialPort = sp
    }

    public async getDiveceList(): Promise<PortInfo[]> {
        return new Promise(async resolve => {
            resolve(await list())
        })
    }

    get device(): string | undefined {
        return this.currentDevice
    }

    // Pick a device
    public async setDevice(device?: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            this.currentDevice = device
            if (this.currentDevice) {
                this.serialPort.createSerialPortConnect(this.currentDevice)
                    .then(() => {
                        this.serialPort.on('close', err => {
                            if (err && err.disconnected) {
                                this.serialPort.disposeSerialPort()
                                vscode.window.showInformationMessage(`${this.currentDevice} disconnected.`)
                                this.setDevice()
                            }
                            this.serialPort.removeAllListeners()
                        })
                        this.emit('setdevice', this.currentDevice)
                        resolve()
                    })
                    .catch(err => {
                        vscode.window.showErrorMessage(err.message)
                        resolve()
                    })
            } else {
                this.emit('setdevice', this.currentDevice)
                resolve()
            }
        })
    }
}