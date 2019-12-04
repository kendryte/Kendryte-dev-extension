import * as vscode from 'vscode'

export const debug = (context: vscode.ExtensionContext): vscode.Disposable => {
    return vscode.commands.registerCommand('extension.debug', () => {
        vscode.debug.startDebugging((vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]), 'KDBG')
    })
}