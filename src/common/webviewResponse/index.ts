import * as vscode from 'vscode'
import { localDependenciesReader } from '@common/local-dependencies'
import { installExample } from '@common/webviewResponse/example'
import { createNewProject } from '@common/webviewResponse/newProject'

export const messageHandler = async (msg: any, extensionPath: string) => {
    switch(msg.type) {
        case 'check':
            const dependencies = await localDependenciesReader()
            const response = {
                type: "response",
                data: {
                    dependencies: Object.keys(dependencies || {})
                }
            }
            return response
        case 'package':
            try {
                await vscode.commands.executeCommand('extension.addDependency', msg.name)
            } catch(err) {
                vscode.window.showErrorMessage(err)
                return ({
                    type: 'error',
                    error: 'Something wrong'
                })
            }
            return({})
        case 'example':
            try {
                await installExample(msg.name, extensionPath)
            } catch(err) {
                vscode.window.showErrorMessage(err)
                return ({
                    type: 'error',
                    error: 'Download example failed.'
                })
            }
            return({})
        case 'create':
            try {
                await createNewProject()
            } catch(err) {
                vscode.window.showErrorMessage(err)
                return ({
                    type: 'error',
                    error: 'Create new project failed.'
                })
            }
            return({})
        default:
    }
}