import * as nls from 'vscode-nls'

const localize = nls.config({ messageFormat: nls.MessageFormat.file })()

export const MESSAGE_LOADING_PROGRAM = localize('loadingProgram', 'loading program:')

export function MESSAGE_DOWNLOAD_SPEED(completeStr: string, speedLevel: string, kbpsStr: string) {
	return localize('kendryte.download.message', 'Complete: {0} {1} Speed@ {2}', completeStr, speedLevel, kbpsStr)
}