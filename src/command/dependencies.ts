import * as vscode from 'vscode'
import { localDependenciesReader, projectConfigParser } from '@common/index'
import { readFileSync } from 'fs'
import { urlJoin } from '@utils/index'
import Axios from 'axios'
import { installPackage } from '@common/dependency'

export const dependenciesDownload = (context: vscode.ExtensionContext): vscode.Disposable => {
    return vscode.commands.registerCommand('packageDependencies.download', async () => {
        return new Promise(async (resolve, reject) => {
            let localDependencies = await localDependenciesReader()
            const workspacePath = vscode.workspace.rootPath
            if (!workspacePath) {
                reject('Please open a kendryte project folder.')
                return
            }
            const config = await projectConfigParser(workspacePath)
            if (!config) {
                reject('Please open a kendryte project folder.')
                return
            }
            const dependencies = config.dependencies
            if (!dependencies || Object.keys(dependencies).length === 0) {
                vscode.window.showInformationMessage('No packages found.')
                return
            }
            const hostConfig = JSON.parse(readFileSync(`${context.extensionPath}/config.json`, 'utf8'))
            const remoteHost = hostConfig.host
            const packages = hostConfig.packages
            Axios({
                method: 'get',
                url: urlJoin(remoteHost, packages, 'list.json'),
                responseType: 'json'
            })
                .then(async res => {
                    for (let dependency of Object.keys(dependencies)) {
                        if (!localDependencies || !localDependencies.hasOwnProperty(dependency)) {
                            try {
                                localDependencies = await installPackage(
                                    dependency,
                                    dependencies[dependency],
                                    workspacePath,
                                    res.data.packages,
                                    remoteHost,
                                    localDependencies || {}
                                )
                            } catch (err) {
                                vscode.window.showErrorMessage(err)
                                return
                            }
                        }
                    }
                    vscode.window.showInformationMessage('Packages installed.')
                    await vscode.commands.executeCommand('extension.configGenerate')
                    resolve()
                })
                .catch(err => {
                    console.log(err)
                    reject(err)
                })
        })
    })
}