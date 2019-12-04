import * as vscode from 'vscode'
import { initialization } from '../initialization'

export const reinstallPackages = (context: vscode.ExtensionContext): vscode.Disposable => {
    return vscode.commands.registerCommand('extension.reinstallPackages', async () => {
        await context.globalState.update('k210Packages', {})
        initialization(context)
    })
}