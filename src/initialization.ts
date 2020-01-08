import * as vscode from 'vscode'
import * as fs from 'fs'
import Axios from 'axios'
import * as os from 'os'
import { setPackagePath, systemFilter, downloadPackage, unArchive, urlJoin } from '@utils/index'
import { PackageData, PlatformPackage, PackagesVersion, GlobalConfig } from './interface'
import { join } from 'path'
import * as chmodr from 'chmodr'
export const initialization = async (context: vscode.ExtensionContext) => {
    const config = JSON.parse(fs.readFileSync(`${context.extensionPath}/config.json`, 'utf8'))
    let packages: PackageData[]
    try {
        packages = await getRemotePackagesVersion(config)
    } catch(e) {
        vscode.window.showErrorMessage(e)
        return
    }
    await installPackages(context, config, packages)
}

const installPackages = async (context: vscode.ExtensionContext, config: GlobalConfig, packages: PackageData[]): Promise<void> => {
    // Get system information
    let packagePath = setPackagePath()

    // Get local package version
    let packagesVersions: PackagesVersion = context.globalState.get('k210Packages') || {}

    // Get package list
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Downloading Packages.',
        cancellable: false
    }, async(progress) => {
        progress.report({ increment: 0, message: 'Preparing' })

        // Download packages
        for (let packageData of packages) {
            let url = ''
            let remoteVersion: string = ''

            if (packageData.source) {
                url = urlJoin(config.host, packageData.source)
                remoteVersion = packageData.version
            } else {
                if ((!packageData.darwin && os.platform() === 'darwin') || (!packageData.linux && os.platform() === 'linux')) {
                    console.log(`No need to install ${packageData.projectName}`)
                    continue
                }
                const platform = systemFilter<PlatformPackage>(packageData.win32, packageData.darwin as PlatformPackage, packageData.linux as PlatformPackage)
                remoteVersion = packageData.version
                url = platform ? urlJoin(config.host, platform.source) : ''
            }

            // Progress report
            const increceProgress = 1 / packages.length * 100
            progress.report({ increment: increceProgress, message: `Downloading ${packageData.projectName}` })

            // Package install
            packagesVersions = await downloadAndExtract(packageData.projectName, url, remoteVersion, packagePath, packagesVersions, context)
        }
    })
}

const getRemotePackagesVersion = (config: GlobalConfig): Promise<Array<PackageData>> => {
    return new Promise(async (resolve, reject) => {
        try {
            const res = await Axios({
                method: "get",
                url: urlJoin(config.host, 'lib', 'list.json'),
                responseType: "json"
            })
            resolve(res.data)
        } catch(e) {
            reject(`Request remote package list error.${e.message}`)
        }
    })
}

const downloadAndExtract = (packageName: string, url: string, remoteVersion: string, packagePath: string, packagesVersions: PackagesVersion, context: vscode.ExtensionContext): Promise<PackagesVersion> => {
    return new Promise(async (resolve, reject) => {
        // Check package update
        if (packagesVersions[packageName] === remoteVersion) {
            console.log(`Skip ${packageName}`)
            resolve(packagesVersions)
            return
        }

        // Main
        try {
            await downloadPackage(packagePath, url, url.replace(/(.*\/)*([^.]+)/i,"$2")) // 正则获取url尾部的文件名
            await unArchive(join(packagePath, url.replace(/(.*\/)*([^.]+)/i,"$2")), packagePath)
            chmodr(join(process.env['packagePath'] || '', packageName), 0o755, console.log)
            packagesVersions[packageName] = remoteVersion
            await context.globalState.update('k210Packages', packagesVersions)
        } catch(e) {
            vscode.window.showErrorMessage(`Download ${packageName} error.${e.message}`)
        }
        resolve(packagesVersions)
    })
}