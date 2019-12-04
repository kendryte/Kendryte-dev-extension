import { vscode } from '../vscode'

const getNonce = () => {
    let text = ""
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length))
	}
	return text
}

export interface Message {
    [key: string]: any
}

export const webviewRequest = (msg: Message): Promise<any> => {
    return new Promise((resolve, reject) => {
        const handleResponse = (event: MessageEvent) => {
            const message = event.data
            if (message.symbol === msg.symbol) {
                window.removeEventListener('message', handleResponse)
                if (message.type === 'error') {
                    reject(message.error)
                    return
                }
                resolve(message.data)
            }
        }
        const nonce = getNonce()
        msg.symbol = nonce
        vscode.postMessage(msg)
        window.addEventListener('message', handleResponse)
    })
}