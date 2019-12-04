import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { messageHandler } from '@common/webviewResponse'

/**
 * Manages react webview panels
*/
export class ReactPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	*/
	public static currentPanel: ReactPanel | undefined

	private static readonly viewType = 'react'

	private readonly _panel: vscode.WebviewPanel
	private readonly _extensionPath: string
	private _disposables: vscode.Disposable[] = []

	public static createOrShow(extensionPath: string, subscriptions: vscode.Disposable[]) {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined

		// If we already have a panel, show it.
		// Otherwise, create a new panel.
		if (ReactPanel.currentPanel) {
			ReactPanel.currentPanel._panel.reveal(column)
		} else {
			ReactPanel.currentPanel = new ReactPanel(extensionPath, subscriptions, column || vscode.ViewColumn.One)
		}
	}

	private constructor(extensionPath: string, subscriptions: vscode.Disposable[], column: vscode.ViewColumn) {
		this._extensionPath = extensionPath

		// Create and show a new webview panel
		this._panel = vscode.window.createWebviewPanel(ReactPanel.viewType, "Kendryte", column, {
			// Enable javascript in the webview
			enableScripts: true,

			// And restric the webview to only loading content from our extension's `media` directory.
			localResourceRoots: [
				vscode.Uri.file(path.join(this._extensionPath, 'build/react-views'))
			]
		})
		
		// Set the webview's initial html content 
        this._panel.webview.html = this._getHtmlForWebview()
		this._panel.iconPath = vscode.Uri.file(path.join(this._extensionPath, 'resources/kendryte.svg'))

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(async message => {
			console.log(message)
			const msg = await messageHandler(message, extensionPath)
			console.log(msg)
			this._panel.webview.postMessage({
				...msg,
				symbol: message.symbol
			})
		}, undefined, this._disposables)
	}

	public doRefactor() {
		// Send a message to the webview webview.
		// You can send any JSON serializable data.
		this._panel.webview.postMessage({ command: 'refactor' })
	}

	public dispose() {
		ReactPanel.currentPanel = undefined

		// Clean up our resources
		this._panel.dispose()

		while (this._disposables.length) {
			const x = this._disposables.pop()
			if (x) {
				x.dispose()
			}
		}
	}

	private _getHtmlForWebview() {
		const manifest = JSON.parse(fs.readFileSync(path.join(this._extensionPath, 'build/react-views', 'asset-manifest.json'), 'utf-8'))
		const mainStyle = manifest.files['main.css']

		const stylePathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'build/react-views', mainStyle))
		const styleUri = stylePathOnDisk.with({ scheme: 'vscode-resource' })

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce()

		const scripts = this._getScripts()

		const scriptTags = () => {
			return scripts.map(script => {
				return `<script nonce="${nonce}" src="${script}"></script>`
			})
		}

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
				<meta name="theme-color" content="#000000">
				<title>Kendryte</title>
				<link rel="stylesheet" type="text/css" href="${styleUri}">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src https: 'nonce-${nonce}'; style-src vscode-resource: 'unsafe-inline' https: data:; connect-src https:">
				<base href="${vscode.Uri.file(path.join(this._extensionPath, 'build/react-views')).with({ scheme: 'vscode-resource' })}/">
			</head>

			<body>
				<noscript>You need to enable JavaScript to run this app.</noscript>
				<div id="root"></div>
				
				${scriptTags()}
			</body>
			</html>`
	}

	private _getScripts(): Array<vscode.Uri> {
		const manifest = JSON.parse(fs.readFileSync(path.join(this._extensionPath, 'build/react-views', 'asset-manifest.json'), 'utf-8'))
		let entryFiles: Array<string> = manifest.entrypoints
		entryFiles = entryFiles.filter((file: string) => {
			return !/\.css$/.test(file)
		})
		return entryFiles.map((file: string) => {
			const scriptPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'build/react-views', file))
			const scriptUri = scriptPathOnDisk.with({ scheme: 'vscode-resource' })
			return scriptUri
		})
	} 
}

function getNonce() {
	let text = ""
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length))
	}
	return text
}