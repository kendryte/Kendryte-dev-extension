import { mkdirPromisify, unlinkPromisify } from '@utils/index'
import * as AdmZip from 'adm-zip'

export const jszipUnarchive = (filePath: string, targetPath: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        const zipFile = new AdmZip(filePath)
        zipFile.extractAllTo(targetPath, true)
        try {
            await unlinkPromisify(filePath)
        } catch (e) {

        }
        resolve()
    })
}