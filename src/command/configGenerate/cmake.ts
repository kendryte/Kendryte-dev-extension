import * as vscode from 'vscode'
import { cpus } from 'os'
import { writeFilePromisify, format, systemFilter } from '@utils/index'
import { join } from 'path'

export const createCmakeConfig = async () => {
    const data = systemFilter(createWindowsCmakeDefaultConfig(), createUnixCmakeDefaultConfig(), createUnixCmakeDefaultConfig())
    await writeFilePromisify(systemFilter(`${vscode.workspace.rootPath}/.vscode/cmake.cmd`, `${vscode.workspace.rootPath}/.vscode/cmake.sh`, `${vscode.workspace.rootPath}/.vscode/cmake.sh`), data, {mode: 0o777})
}

const createUnixCmakeDefaultConfig = ():string => {
    if (!process.env.packagePath) {
        vscode.window.showErrorMessage('No local dependencies found. Please try to execute reinsall packages command.')
        return ''
    }
    return format(`
        # This is build script.
        # Do not modify this file unless you know what are you doing!
        \nmkdir ${vscode.workspace.rootPath}/build
        cd ${vscode.workspace.rootPath}/build
        export PATH=${join(process.env.packagePath, 'toolchain/bin')}:$PATH
        ${join(process.env.packagePath, 'cmake/bin/cmake')} .. && ${join(process.env.packagePath, 'cmake/bin/cmake')} --build ${vscode.workspace.rootPath}/build -- -j ${cpus().length - 1 <= 0 ? 2 : cpus().length - 1}
    `)
}

const createWindowsCmakeDefaultConfig = ():string => {
    if (!process.env.packagePath) {
        vscode.window.showErrorMessage('No local dependencies found. Please try to execute reinsall packages command.')
        return ''
    }
    return format(`
        :: This is build script.
        :: Do not modify this file unless you know what are you doing!
        \nmkdir ${vscode.workspace.rootPath}\\build
        cd ${vscode.workspace.rootPath}\\build
        set Path=${join(process.env.packagePath, 'toolchain/bin')};${process.env.Path}
        set CMAKE_MAKE_PROGRAM=make
        ${join(process.env.packagePath, 'cmake/bin/cmake.exe')} -G "Unix Makefiles" .. && ${join(process.env.packagePath, 'cmake/bin/cmake.exe')} --build ${vscode.workspace.rootPath}\\build -- -j ${cpus().length - 1 <= 0 ? 2 : cpus().length - 1}
    `)
}
