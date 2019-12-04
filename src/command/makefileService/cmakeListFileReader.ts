import { readFileSync, readdirSync } from 'fs'
import { FileList } from '@command/makefileService/types'
import { join } from 'path'

export const fileListReader = (path: string): FileList => {
    const fileList = readdirSync(path)
    const reader: FileList = {}
    fileList.map(filename => {
        const data = readFileSync(join(path, filename), 'utf-8')
        reader[filename.replace(/.cmake/,'')] = data
    })
    return reader
}