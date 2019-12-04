import * as vscode from 'vscode'
import { ReactPanel } from '@common/react-panel'

export const createWebview = (context: vscode.ExtensionContext): vscode.Disposable => {
    return vscode.commands.registerCommand('packageDependencies.createWebview', async () => {
        return new Promise(async resolve => {
            ReactPanel.createOrShow(context.extensionPath, context.subscriptions)
        })
    })
}