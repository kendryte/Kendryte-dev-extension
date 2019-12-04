import { readFileSync } from 'fs'

export const configReader = <T>(filePath: string): T | undefined => {
    try {
        const data = readFileSync(filePath, 'utf-8')
        const reader: T = JSON.parse(data)
        return reader
    } catch(e) {
        return
    }
}