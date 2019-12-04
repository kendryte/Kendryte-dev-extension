import * as vscode from 'vscode'
import { writeFilePromisify, format, systemFilter } from '@utils/index'
import { projectConfigParser } from '@common/index'
import { join } from 'path'

export const createDebugConfigFile = (port: number): void => {
    createLaunchConfig(port)
    createTasksConfig()
}

const createLaunchConfig = async (port: number): Promise<void> => {
    if (!vscode.workspace.rootPath) {
        vscode.window.showErrorMessage('Please open a workspace.')
        return
    }
    const config = await projectConfigParser(vscode.workspace.rootPath)
    if (!config) {
        vscode.window.showErrorMessage('Please open a kendryte workspace.')
        return
    }
    const projectName = config.name
    const data = createDefaultLaunchConfig(projectName, port)
    await writeFilePromisify(`${vscode.workspace.rootPath}/.vscode/launch.json`, data)
}

const createDefaultLaunchConfig = (projectName: string, port: number): string => {
    if (!process.env.packagePath) {
        return ''
    }
    const packagePath = process.env.packagePath.replace(/\\/g, '/')
    return format(`
        {
            "$schema": "vscode://schemas/launch",
            "version": "0.2.0",
            "configurations": [
                {
                    "id": "kendryte",
                    "type": "kendryte",
                    "request": "launch",
                    "name": "KDBG",
                    "executable": "${join(vscode.workspace.rootPath || '', 'build', projectName). replace(/\\/g, '/')}",
                    "target": "127.0.0.1:${port}",
                    "cwd": "${join(vscode.workspace.rootPath || '', 'build'). replace(/\\/g, '/')}",
                    "internalConsoleOptions": "openOnSessionStart",
                    "env": {
                        "PATH": "${join(packagePath, 'toolchain/bin').replace(/\\/g, '/')}:${join(packagePath, 'cmake/bin/').replace(/\\/g, '/')}:${join(packagePath, 'jlink').replace(/\\/g, '/')}:${join(packagePath, 'clang-format/bin').replace(/\\/g, '/')}:${join(process.env.PATH || '').replace(/\\/g, '/')}",
                        "Path": "${join(packagePath, 'toolchain/bin').replace(/\\/g, '/')};${join(packagePath, 'cmake/bin/').replace(/\\/g, '/')};${join(packagePath, 'jlink').replace(/\\/g, '/')};${join(packagePath, 'clang-format/bin').replace(/\\/g, '/')};${join(process.env.PATH || '').replace(/\\/g, '/')}",
                    },
                    "autorun": [],
                    "gdbpath": "${join(packagePath, 'toolchain/bin/riscv64-unknown-elf-gdb').replace(/\\/g, '/')}",
                    "preLaunchTask": "Start Openocd and Build"
                }
            ]
        }
    ` + '\n')
}

const createTasksConfig = async (): Promise<void> => {
    const data = createDefaultTasksConfig()
    await writeFilePromisify(`${vscode.workspace.rootPath}/.vscode/tasks.json`, data)
}

const createDefaultTasksConfig = ():string => {
    return format(`
        {
            "version": "2.0.0",
            "tasks": [
                {
                    "label": "Build",
                    "command": "${systemFilter('.vscode/cmake.cmd', `${vscode.workspace.rootPath}/.vscode/cmake.sh`, `${vscode.workspace.rootPath}/.vscode/cmake.sh`)}",
                    "type": "process",
                    "presentation": {
                        "reveal": "always"
                    },
                    "group": {
                        "kind": "build",
                        "isDefault": true
                    }
                },
                {
                    "label": "Start Openocd",
                    "command": "\${command:extension.openocd.restart}"
                },
                {
                    "label": "Start Openocd and Build",
                    "dependsOn":["Build", "Start Openocd"]
                }
            ]
        }
    ` + '\n')
}