import * as vscode from 'vscode'
import { createServer, AddressInfo } from 'net'
import { createOpenocdConfigFile } from '@command/configGenerate/openocdConfig'
import { createDebugConfigFile } from '@command/configGenerate/debugConfig'
import { createCmakeConfig } from '@command/configGenerate/cmake'
import { createCCppConfig } from '@command/configGenerate/c-cpp-config'
import * as fs from 'fs'
import { join } from 'path'

// Find openocd service port
const findPort = (): Promise<number> => {
    return new Promise(resolve => {
        let port: number = vscode.workspace.getConfiguration('openocd').get('port') || 0
        if (port === 0) {
            const s = createServer()
            s.listen(0, () => {
                const port = (s.address() as AddressInfo).port
                s.close(() => {
                    resolve(port)
                })
            })
        } else resolve(port)
    })
}

// VSCode command register
export const configGenerate = (): vscode.Disposable => {
    return vscode.commands.registerCommand('extension.configGenerate', () => {
        return new Promise(async (resolve, reject) => {
            const port = await findPort()
            if (!vscode.workspace.rootPath) {
                vscode.window.showErrorMessage('Please open a kendryte folder.')
                return
            }
            try {
                fs.mkdirSync(join(vscode.workspace.rootPath, '.vscode'))
            } catch(e) {
                console.log(e)
            }
            createOpenocdConfigFile(port)
            createDebugConfigFile(port)
            createCmakeConfig()
            createCCppConfig()
            resolve()
        })
    })
}