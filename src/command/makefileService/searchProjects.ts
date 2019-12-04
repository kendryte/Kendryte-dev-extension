import * as vscode from 'vscode'
import { readdirSync } from 'fs'
import { ProjectInfo, ProjectConfig } from '@command/makefileService/types'
import { projectConfigParser } from '@common/index'
import { join } from 'path'

interface ProjectList {
    rootProject: ProjectInfo | undefined
    dependencies: {
        [key:string]: ProjectInfo
    }
}

export const searchProjects = async (): Promise<ProjectList> => {
    const packageFile = 'kendryte-package.json'
    const projectList: ProjectList = {
        rootProject: undefined,
        dependencies: {}
    }
    if (!vscode.workspace.rootPath) {
        return projectList
    }
    const rootDir = readdirSync(vscode.workspace.rootPath.replace(/\\/g, '/')) // List
    if (rootDir.indexOf(packageFile) >= 0) {
        const rootProjectInfo: ProjectInfo = {
            path: vscode.workspace.rootPath,
            isRoot: true,
            config: <ProjectConfig>await projectConfigParser(vscode.workspace.rootPath)
        }
        projectList.rootProject = rootProjectInfo
        const dependencyList = Object.keys(rootProjectInfo.config.dependencies || {})
        const dependencyDir = readdirSync(`${vscode.workspace.rootPath}/kendryte_libraries`)
        await Promise.all(dependencyList.map(async dependency => {
            if (dependencyDir.indexOf(dependency) >= 0) {
                const projectPath = join(vscode.workspace.rootPath || '', 'kendryte_libraries', dependency).replace(/\\/g, '/')
                const projectInfo: ProjectInfo = {
                    path: projectPath,
                    isRoot: false,
                    config: <ProjectConfig>await projectConfigParser(projectPath)
                }
                projectList.dependencies[projectInfo.config.name] = projectInfo
            }
        }))
    }

    return projectList
}