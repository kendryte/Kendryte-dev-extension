import * as vscode from 'vscode'
import * as SerialPort from 'serialport'
import { EventEmitter } from 'events'
import * as os from 'os'
import { join } from 'path'
import { constants } from 'fs'
import { accessAsync, sudoexecPromisify } from '@utils/index'

export class SerialPortService extends EventEmitter {
    private outputStatus: boolean
    private updateStatusbar: any
    private connection?: SerialPort
    private readonly extensionPath: string

    constructor(updateStatusbar: any, extensionPath: string) {
        super()
        this.outputStatus = false
        this.updateStatusbar = updateStatusbar
        this.extensionPath = extensionPath
    }

    get status() {
        return this.outputStatus
    }

    /*
        * There is a bug that when serialport's 'data' and 'error' listener didn't open, 'close' listener will never recive callback.
        * So Please use SerialPortService.on()
        * It will never return serialport service.
    */

    public setStatus(value: boolean) {
        this.outputStatus = value
        this.updateStatusbar(value)

        // Reset Serialport when output channel open.
        if (this.connection) {
            this.resetSerialPort()
        }
    }
    public createSerialPortConnect(device: string) {
        return new Promise(async (resolve, reject) => {
            const readPermission = await accessAsync(device, constants.R_OK)
            const writePermission = await accessAsync(device, constants.W_OK)
            if (os.platform() === 'linux' && (!readPermission || !writePermission)) {
                await sudoexecPromisify(`chmod 666 ${device}`, {name: 'Kendryte Dev Tool', icns: join(this.extensionPath, 'resources', 'kendryte.svg')})
            }
            const sp = new SerialPort(device, {
                baudRate: 115200,
                autoOpen: true,
                lock: true,
                rtscts: false,
                xon: true,
                xoff: true,
                xany: true,
            }, err => {
                sp.set({
                    dtr: false,
                    rts: false,
                    dsr: false,
                    cts: false,
                    brk: false
                })
                if (!err) {
                    this.connection = sp
                    resolve()
                } else {
                    reject(err)
                }
            })
            sp.setEncoding('utf8')
            sp.on('data', _ => {
                this.emit('data', _)
            })
            sp.on('error', _ => {
                this.emit('error', _)
            })
            sp.on('close', _ => {
                this.emit('close', _)
            })
        })
    }
    public disposeSerialPort() {
        if (this.connection) {
            this.connection.close()
            this.connection.removeAllListeners()
            this.removeAllListeners()
        }
        delete this.connection
        this.setStatus(false)
    }

    // Only can be used in upload
    public disconnectService() {
        return new Promise(resolve => {
            if (this.connection) {
                this.connection.close(_ => {
                    if (this.connection) {
                        this.connection.removeAllListeners()
                    }
                    this.removeAllListeners()
                    delete this.connection
                    resolve()
                })
            }
        })
    }

    private async resetSerialPort() {
        if (this.connection) {
            this.connection.close(_ => {
                if (this.connection) {
                    this.createSerialPortConnect(this.connection.path)
                        .then()
                        .catch(err => {
                            vscode.window.showErrorMessage(err.message)
                        })
                }
            })
            this.connection.removeAllListeners()
            this.removeAllListeners()
        }
    }
}