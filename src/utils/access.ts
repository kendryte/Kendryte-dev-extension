import { access, PathLike } from 'fs'

export const accessAsync = (path: PathLike, mode: number | undefined): Promise<boolean> => {
    return new Promise(resolve => {
        access(path, mode, err => {
            resolve(!err)
        })
    })
}