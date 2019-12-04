import * as vscode from 'vscode'
import { createCmakeListFile } from '@command/makefileService/writeCmakeList'
import { searchProjects } from '@command/makefileService/searchProjects'
import { ProjectInfo } from './types'

// VSCode command register
export const cmakelistGenerate = (): vscode.Disposable => {
    return vscode.commands.registerCommand('extension.cmakelistGenerate', () => {
        return new Promise(async (resolve, reject) => {
            const projectList = await searchProjects()
            if (projectList.rootProject) {
                createCmakeListFile(projectList.rootProject, Object.values(projectList.dependencies))
                Object.values(projectList.dependencies).map(project => {
                    const dependencyList = Object.keys(project.config.dependencies || {})
                    const dependencyConfigList: Array<ProjectInfo> = []
                    dependencyList.map(item => {
                        if (projectList.dependencies[item]) dependencyConfigList.push(projectList.dependencies[item])
                    })
                    createCmakeListFile(project, dependencyConfigList)
                })
            } else {
                vscode.window.showErrorMessage('Please open a project folder.')
            }
            vscode.window.showInformationMessage('CMakeLists.txt file generated')
            resolve()
        })
    })
}
