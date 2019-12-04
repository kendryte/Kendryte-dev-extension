import * as vscode from 'vscode'
import { projectConfigParser } from '@common/project-config-parser'
import { ProjectConfig } from '@command/makefileService/types'
import { systemFilter, writeFilePromisify } from '@utils/index'
import { join } from 'path'

export const createCCppConfig = async (): Promise<void> => {
    if (!vscode.workspace.rootPath) {
        vscode.window.showErrorMessage('Please open a workspace.')
        return
    }
    const config = await projectConfigParser(vscode.workspace.rootPath)
    if (!config) {
        vscode.window.showErrorMessage('Please open a kendryte workspace')
        return
    }
    const data = createConfig(config)
    await writeFilePromisify(join(vscode.workspace.rootPath, '.vscode/c_cpp_properties.json'), JSON.stringify(data, null, 4), {
        mode: 0o777,
        encoding: 'utf-8'
    })
}

const createConfig = (config: ProjectConfig): any => {
    const includePath: Array<string> = []
    const packagePath = (process.env.packagePath || '').replace(/\\/g, '/')
    const toolchainList = [
        'toolchain/riscv64-unknown-elf/include',
        'toolchain/lib/gcc/riscv64-unknown-elf/8.2.0/include',
        'toolchain/lib/gcc/riscv64-unknown-elf/8.2.0/include-fixed',
        'toolchain/riscv64-unknown-elf/include/c++/8.2.0',
        'toolchain/riscv64-unknown-elf/include/c++/8.2.0/riscv64-unknown-elf',
    ]
    toolchainList.map(item => {
        includePath.push(join(packagePath, item).replace(/\\/g, '/'))
    })
    if (config.includeFolders) {
        config.includeFolders.map(include => {
            includePath.push(join(<string>vscode.workspace.rootPath, include).replace(/\\/g, '/'))
        })
    }
    const data = {
        version: 4,
        configurations: [
            {
                name: "Default",
                defines: [],
                compilerPath: systemFilter(join(packagePath, 'toolchain/bin/riscv64-unknown-elf-g++.exe').replace(/\\/g, '/'), join(packagePath, 'toolchain/bin/riscv64-unknown-elf-g++'), join(packagePath, 'toolchain/bin/riscv64-unknown-elf-g++')),
                cStandard: "c11",
                cppStandard: "c++17",
                intelliSenseMode: "gcc-x64",
                includePath: includePath
            }
        ]
    }
    return data
}