import * as vscode from 'vscode'
import * as fs from 'fs'
import { readdirPromisify, systemFilter } from '@utils/index'
import { join } from 'path'

const copyDir = (path: string, targetPath: string) => {
    return new Promise((resolve, reject) => {
        try {
            fs.mkdirSync(targetPath)
        } catch(e) {
            console.log(e)
        }
        readdirPromisify(path)
            .then(items => {
                items.map(item => {
                    const itemPath = join(path, item)
                    if (fs.statSync(itemPath).isDirectory()) {
                        copyDir(join(path, item), join(targetPath, item))
                    } else {
                        const buffer = fs.readFileSync(join(path, item))
                        try {
                            fs.writeFileSync(join(targetPath, item), buffer)
                        } catch (err) {
                            reject(`Create file ${item} failed`)
                            console.log(err)
                        }
                    }
                })
                resolve()
            })
            .catch(err => {
                console.log(err)
                reject('No such directory.')
            })
    })
}

export const createNewProject = () => {
    return new Promise((resolve, reject) => {
        vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false
        })
            .then(uri => {
                if (!uri || !process.env.packagePath) {
                    reject()
                    return
                }
                const path = systemFilter(uri[0].path.replace(/^\//, ''), uri[0].path, uri[0].path)
                copyDir(join(process.env.packagePath, 'hello-world-project'), join(path, 'hello-world'))
                    .then(async () => {
                        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(join(path, 'hello-world')), true)
                        resolve()
                    })
                    .catch(err => reject(err))
            })
    })
}