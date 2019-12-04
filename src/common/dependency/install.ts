import * as vscode from 'vscode'
import { downloadPackage, jszipUnarchive, urlJoin} from '@utils/index'
import * as path from 'path'

export const installPackage = async (
    packageName: string,
    version: string,
    workspacePath: string,
    packageList: { [key: string]: any },
    remoteHost: string,
    localDependencies: { [key: string]: string }
): Promise<{ [key: string]: string }> => {
    console.log(localDependencies)
    console.log(`Install ${packageName}`)
    try {
        const fileName = `${packageName}_${version}.zip`
        await downloadPackage(path.join(workspacePath, 'kendryte_libraries'), urlJoin(remoteHost, 'package', fileName), fileName)
        await jszipUnarchive(path.join(workspacePath, 'kendryte_libraries', fileName), path.join(workspacePath, 'kendryte_libraries', packageName))
        localDependencies[packageName] = version
        const dependencies = packageList[packageName].versions[version].dependencies
        for (let dependency of Object.keys(dependencies)) {
            if (!localDependencies.hasOwnProperty(dependency)) {
                try {
                    await installPackage(dependency, dependencies[dependency], workspacePath, packageList, remoteHost, localDependencies)
                } catch (err) {
                    vscode.window.showErrorMessage(err)
                }
            } else {
                console.log(`Skip install ${dependency}`)
            }
        }
        return localDependencies
    } catch (err) {
        console.log(err)
        return localDependencies
    }
}