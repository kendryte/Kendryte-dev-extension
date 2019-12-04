import * as vscode from 'vscode'
import { downloadPackage, urlJoin, jszipUnarchive, systemFilter } from '@utils/index'
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
                    .then(() => {
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