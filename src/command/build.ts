import * as vscode from 'vscode'
import { readdirPromisify } from '@utils/index'

export const build = (context: vscode.ExtensionContext): vscode.Disposable => {
    return vscode.commands.registerCommand('extension.build', async () => {
        return new Promise(async (resolve, reject) => {
            if (!vscode.workspace.rootPath) {
                vscode.window.showErrorMessage('Please open a kendryte workspace')
                return
            }
            readdirPromisify(vscode.workspace.rootPath)
                .then(async items => {
                    if (!items.includes('kendryte_libraries')) {
                        await vscode.commands.executeCommand('packageDependencies.download')
                    }
                    await vscode.commands.executeCommand('extension.cmakelistGenerate')
                    const tasks = await vscode.tasks.fetchTasks()
                    for (const task of tasks) {
                        if (task.name === 'Build') {
                            await vscode.tasks.executeTask(task)
                            vscode.tasks.onDidEndTaskProcess(event => {
                                vscode.window.showInformationMessage('Build complete')
                                resolve()
                            })
                            break
                        }
                    }
                })
        })
    })
}