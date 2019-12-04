import * as vscode from 'vscode'
import { ReactPanel } from '@common/react-panel'

export const createHelloworld = (context: vscode.ExtensionContext): vscode.Disposable => {
    return vscode.commands.registerCommand('extension.createHelloworld', async (params) => {
        return new Promise(async resolve => {
            vscode.tasks.fetchTasks()
                .then(data => console.log(data))
            resolve()
        })
    })
}