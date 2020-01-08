import { unlinkPromisify } from '@utils/promisify'
import { extract, I7zHandler, compress } from '7zip-bin-wrapper'

export const unArchive = (sourceFile: string, target: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
        try {
            await waitHandle(extract(sourceFile, target))
        } catch(e) {
			console.log(e)
			reject(e)
			return
		}
		try {
			await unlinkPromisify(sourceFile)
		} catch(e) {
			console.log(e)
		}
		resolve()
    })
}

export const archive = (targetFile: string, source: string, extraSource: string[] = []): Promise<void> => {
	return new Promise(async (resolve, reject) => {
        try {
            await waitHandle(compress(targetFile, source, ...extraSource))
        } catch(e) {
			reject(e)
			return
		}
		resolve()
    })
}

const waitHandle = (handler: I7zHandler) => {
	// console.log(handler.commandline.join(' '));
	handler.on('output', (data: string) => {
		console.log(data)
	});
	handler.on('progress', ({progress, message}) => {
		console.log(progress)
		console.log(message)
		// logger.progress(progress);
		// logger.sub1(progress.toFixed(0) + '%');
		// logger.sub2(message);
	});
	
	return handler.promise();
}