import * as vscode from 'vscode'
import { spawn } from 'child_process'
import { writeFileSync, readFileSync } from 'fs'
import * as JSZip from 'jszip'
import { Devices, SerialPortService } from '@service/index'
import { projectConfigParser, flashConfigParser, FlashList, BinaryFile } from '@common/index'
import { FrontendChannelLogger, systemFilter } from '@utils/index'
import { join } from 'path'

export const buildAndUpload = (context: vscode.ExtensionContext, deviceServices: Devices, uploadLogger: FrontendChannelLogger, serialPortService: SerialPortService): vscode.Disposable => {
    return vscode.commands.registerCommand('extension.buildAndUpload', async () => {
        let path: string
        if (vscode.workspace.rootPath) {
            path = `${vscode.workspace.rootPath}/build`
        } else {
            vscode.window.showErrorMessage('Please open a kendryte workspace')
            return 
        }
        const reader = await projectConfigParser(vscode.workspace.rootPath)
        if (!reader) {
            vscode.window.showErrorMessage('Please open a kendryte workspace')
            return
        }
        await vscode.commands.executeCommand('extension.build')

        // Generate flash-list.json file
        const flashList: FlashList = {
            version: '1.0.0',
            files: []
        }
        const projectBin: BinaryFile = {
            address: '0',
            bin: `${reader.name}.bin`,
            sha256Prefix: true
        }
        flashList.files.push(projectBin)

        const extraSource: Array<string> = []

        // Read flash-manager.json
        const flashConfig = await flashConfigParser(`${vscode.workspace.rootPath}`)
        if (flashConfig) {
            flashConfig.downloadSections.map(section => {
                const sectionConfig: BinaryFile = {
                    address: section.address.padEnd(10, '0'),
                    bin: section.filename,
                    sha256Prefix: false
                }
                flashList.files.push(sectionConfig)
                extraSource.push(`${vscode.workspace.rootPath}/${section.filename}`)
            })
        }

        // Write flash-list.json file
        writeFileSync(`${path}/flash-list.json`, JSON.stringify(flashList))

        const firmwarePath = `${path}/${reader.name}.bin`
        const flashListPath = `${path}/flash-list.json`

        // Package to .kfpkg
        extraSource.push(flashListPath) // Push flash-list.json file
        const zip = new JSZip()
        // Add firmware
        zip.file(`${reader.name}.bin`, readFileSync(firmwarePath))
        // Add flash-list.json
        zip.file('flash-list.json', readFileSync(flashListPath, 'utf-8'))
        // Add extra source
        extraSource.map(source => zip.file(source.replace(/(.*\/)*([^.]+)/i, '$2'), readFileSync(source)))

        try {
            const buffer = await zip.generateAsync({type: 'nodebuffer'})
            writeFileSync(`${path}/${reader.name}.kfpkg`, buffer)
        } catch(e) {
            vscode.window.showErrorMessage('Generate .kfpkg file failed.')
            return
        }
        const options = {
            cwd: path,
            env: {
                Path: join(process.env.packagePath || '', 'python')
            }
        }
        if (!deviceServices.device) {
            // 如果未选择可用设备，会在此中断函数
            await vscode.commands.executeCommand('extension.pickDevice')
        }

        uploadLogger.show()

        const Unixargs = ['-b', '2000000', '-p', deviceServices.device as string, `${reader.name}.kfpkg`]
        const windowsArgs = [join(process.env.packagePath || '', 'kflash\\kflash.py'), '-b', '2000000', '-p', deviceServices.device as string, `${reader.name}.kfpkg`]
        const windowsExec = 'python'

        // Stop serialport service when upload
        await serialPortService.disconnectService()
        const executable = systemFilter(windowsExec, join(process.env.packagePath || '', 'kflash/kflash'), join(process.env.packagePath || '', 'kflash/kflash'))
        const args = systemFilter(windowsArgs, Unixargs, Unixargs)
        const sdkProcess = spawn(executable, args, options)
        sdkProcess.stdout.on('data', (data) => {
            uploadLogger.info(data)
            console.log(`stdout: ${data}`)
        })
    
        sdkProcess.stderr.on('data', (data) => {
            uploadLogger.error(data)
            console.log(`stderr: ${data}`)
        })

        sdkProcess.on('close', (code) => {
            uploadLogger.info('Upload finished.')
            deviceServices.setDevice(deviceServices.device as string)
            console.log(`子进程退出，退出码 ${code}`)
        })
    })
}