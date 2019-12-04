import * as url from 'url'
import { join } from 'path'
export const urlJoin = (host: string, ...args: Array<string>): string => {
    const path = join(...args)
    const fullPath = url.resolve(host, path)
    return fullPath
}