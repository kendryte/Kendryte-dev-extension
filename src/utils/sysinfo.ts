import * as os from 'os'
import { join } from 'path'
export const systemFilter = <T>(win32: T,darwin: T, linux: T): T => {
    const platform = os.platform()
    switch(platform) {
        case 'win32': {
            return win32
        }
        case 'darwin': {
            return darwin
        }
        case 'linux': {
            return linux
        }
        default: {
            return linux
        }
    };
}

export const setPackagePath = (): string => {
    const win32 = join(process.env['USERPROFILE'] || '', '.k210-extension')
    const darwin = join(process.env['HOME'] || '', '.k210-extension')
    const linux = join(process.env['HOME'] || '', '.k210-extension')
    const path = systemFilter<string>(win32, darwin, linux) 
    process.env.packagePath = path
    return process.env.packagePath
}