import * as fs from 'fs'
import * as path from 'path'
import { readdirPromisify } from './promisify'
export const removeDir = (p: string) => {
    return new Promise((resolve, reject) => {
        fs.stat(p, (err, statObj) => {
            if (err) {
                console.log(err)
                resolve()
                return
            }
            if (statObj.isDirectory()) {
                readdirPromisify(p)
                    .then(async dirs => {
                        await Promise.all(dirs.map(async dir => await removeDir(path.join(p, dir))))
                        fs.rmdir(p, resolve)
                    })
            } else {
                fs.unlink(p, resolve)
            }

        })
    })
}