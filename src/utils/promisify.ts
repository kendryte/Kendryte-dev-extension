import { promisify } from 'util'
import { mkdir, writeFile, unlink, readdir, readFile } from 'fs'
import { exec } from 'child_process'
import * as sudo from 'sudo-prompt'
import { EventEmitter } from 'events'

export const execPromisify = promisify(exec)
export const mkdirPromisify = promisify(mkdir)
export const writeFilePromisify = promisify(writeFile)
export const unlinkPromisify = promisify(unlink)
export const readdirPromisify = promisify(readdir)
export const readFilePromisify = promisify(readFile)
export const sudoexecPromisify = (cmd: string, options: {name?: string, icns?: string}): Promise<EventEmitter> => {
    return new Promise((resolve, reject) => {
        const event = new EventEmitter()
        sudo.exec(cmd, options, (err, stdout, stderr) => {
            if (err) {
                reject(err)
                return
            }
            event.emit('stdout', stdout)
            event.emit('stderr', stderr)
            resolve(event)
        })
    })
}