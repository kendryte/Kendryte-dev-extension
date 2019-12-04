import * as vscode from 'vscode'
import { readFilePromisify, writeFilePromisify, urlJoin } from '@utils/index'
import { installPackage } from '@common/dependency'
import { localDependenciesReader } from '@common/local-dependencies'
import * as path from 'path'
import Axios from 'axios'
import { DevPackages } from '@treeview/DevPackages'

export const addDependency = (context: vscode.ExtensionContext, depProvider: DevPackages): vscode.Disposable => {
    return vscode.commands.registerCommand('extension.addDependency', packageName => {
        return new Promise(async (resolve, reject) => {
            const hostConfig = JSON.parse(await readFilePromisify(`${context.extensionPath}/config.json`, 'utf8'))
            const remoteHost = hostConfig.host
            Axios({
                method: 'get',
                url: urlJoin(remoteHost, 'package', 'list.json'),
                responseType: 'json'
            })
                .then(res => {
                    if (!vscode.workspace.rootPath) {
                        reject('Please open a workspace')
                        return
                    }

                    /*
                        To do..
                        Add quick pick if packageName is undefined.
                    */

                    const remotePackages = res.data.packages
                    if (!remotePackages[packageName]) {
                        reject(`Cannot find module ${packageName} on server.`)
                        return
                    }
                    const configPath = path.join(vscode.workspace.rootPath, 'kendryte-package.json')
                    readFilePromisify(configPath, 'utf-8')
                        .then(data => {
                            const config = JSON.parse(data)
                            config.dependencies[packageName] = '0.1.0'
                            writeFilePromisify(configPath, JSON.stringify(config, null, '\t'), 'utf-8')
                                .then(async res => {
                                    const localDependencies = await localDependenciesReader()
                                    await installPackage(
                                        packageName,
                                        '0.1.0',
                                        <string>vscode.workspace.rootPath,
                                        remotePackages,
                                        remoteHost,
                                        localDependencies || {}
                                    )
                                    vscode.window.showInformationMessage(`${packageName} installed.`)
                                    depProvider.refresh()
                                    await vscode.commands.executeCommand('extension.configGenerate')
                                    resolve()
                                })
                        })
                        .catch(error => {
                            reject('Kendryte-package.json is not exists.')
                        })
                })
        })
    })
}