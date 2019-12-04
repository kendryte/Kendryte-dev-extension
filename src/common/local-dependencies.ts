import * as vscode from 'vscode'
import * as path from 'path'
import { statSync } from 'fs'
import { projectConfigParser } from '@common/project-config-parser'
import { ProjectConfig } from '@command/makefileService/types'
import { readdirPromisify } from '@utils/index'

export const localDependenciesReader = async (): Promise<ProjectConfig["dependencies"]> => {
    return new Promise(async (resolve, reject) => {
        if (!vscode.workspace.rootPath) {
            return
        }
        const localDependencies: ProjectConfig["dependencies"] = {}
        const dependenciesPath = path.join(vscode.workspace.rootPath, 'kendryte_libraries')
        readdirPromisify(dependenciesPath)
            .then(async dependenciesList => {
                await Promise.all(dependenciesList.map(async dependency => {
                    const dependencyPath = path.join(dependenciesPath, dependency)
                    if (!statSync(dependencyPath).isDirectory()) return
                    const config = await projectConfigParser(dependencyPath)
                    if (!config) return
                    localDependencies[config.name] = config.version
                }))
                resolve(localDependencies)
            })
            .catch(err => {
                resolve(localDependencies)
            })
    })
}