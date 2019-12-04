import * as vscode from 'vscode'
import { readFilePromisify, writeFilePromisify, removeDir } from '@utils/index'
import { join } from 'path'
import { DevPackages } from '@treeview/DevPackages'

export const deleteDependency = (depProvider: DevPackages) => {
    return vscode.commands.registerCommand('packageDependencies.delete', treeItem => {
        const packageName = treeItem.label
        return new Promise((resolve, reject) => {
            const workspace = vscode.workspace.rootPath
            if (!workspace) {
                vscode.window.showErrorMessage('Please open a workspace')
                reject('Please open a workspace')
                return
            }
            const configPath = join(workspace, 'kendryte-package.json')
            readFilePromisify(configPath, 'utf-8')
                .then(async data => {
                    const config = JSON.parse(data)
                    delete config.dependencies[packageName]
                    await writeFilePromisify(configPath, JSON.stringify(config, null, '\t'), 'utf-8')
                    await removeDir(join(workspace, 'kendryte_libraries', packageName))
                    vscode.window.showInformationMessage(`${packageName} deleted.`)
                    depProvider.refresh()
                    await vscode.commands.executeCommand('extension.configGenerate')
                    resolve()
                })
                .catch(err => {
                    reject('Please open a kendryte workspace.')
                    return
                })
        })
    })
}