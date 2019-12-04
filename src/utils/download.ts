import Axios, { AxiosResponse } from 'axios';
import { mkdirPromisify } from '@utils/promisify'
import * as fs from 'fs'
import { join } from 'path'

export const downloadPackage = (path: string, url: string, fileName: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        let res: AxiosResponse<any>
        try {
            res = await Axios({
                method: "get",
                url,
                responseType: "stream"
            })
        } catch(e) {
            reject(e)
            return
        }
        try {
            await mkdirPromisify(path, { recursive: true })
        } catch(e) {
            
        }
        const writer = fs.createWriteStream(join(path, fileName))
        res.data.pipe(writer)
        writer.on('finish', msg => {
            // console.log(`finish write file ${fileName}`)
            resolve(msg)
        })
        writer.on('error', e => reject(e))
    })
}