import * as vscode from 'vscode'
import { downloadPackage, urlJoin, jszipUnarchive, systemFilter, sleep } from '@utils/index'
import { readFileSync } from 'fs'
import { join } from 'path'

export const installExample = (exampleName: string, extensionPath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false
        })
            .then(uri => {
                if (!uri) {
                    reject()
                    return
                }
                const path = systemFilter(uri[0].path.replace(/^\//, ''), uri[0].path, uri[0].path)
                const host = JSON.parse(readFileSync(join(extensionPath, 'config.json'), 'utf-8')).host
                const exampleUrl = urlJoin(host, 'example', `${exampleName}_0.1.0.zip`)
                console.log(exampleUrl)
                downloadPackage(path, exampleUrl, `${exampleName}.zip`)
                    .then(async () => {
                        // 添加延迟时间，确保在加密磁盘下或速度慢的磁盘中，Windows defender 扫描完毕文件后再进行解压。否则可能出现大文件解压时被锁，安装依赖失败。
                        await sleep(1000)
                        jszipUnarchive(join(path, `${exampleName}.zip`), join(path, exampleName))
                            .then(async () => {
                                if (vscode.workspace.rootPath) {
                                    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(join(path, exampleName)), true)
                                } else {
                                    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(join(path, exampleName)), false)
                                }
                                resolve()
                            })
                            .catch(err => reject(`Extract ${exampleName} failed`))
                    })
                    .catch(err => {
                        console.log(err)
                        reject(`Download ${exampleName} failed`)
                    })
            })
    })
}