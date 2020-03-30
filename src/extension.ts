import * as path from 'path'
import * as vscode from 'vscode'
import { initialization } from './initialization'
import * as command from '@command/index'
import { DevPackages } from './views/DevPackages'
import { Devices, OpenocdService, SerialPortService } from '@service/index'

import * as fs from 'fs'
import * as net from 'net'
import * as os from 'os'
import { CancellationToken, DebugConfiguration, ProviderResult, WorkspaceFolder } from 'vscode'
import { IMyLogger } from '@utils/baseLogger'
import { BackendLogReceiver } from '@debug/frontend/lib/backendLogReceiver'
import { disposeChannel, FrontendChannelLogger } from '@utils/extensionLogger'


export const activate = async (context: vscode.ExtensionContext) => {
	// Initialzate
	await initialization(context)

	// Create dependencies tree view
	const dependenciesProvider = new DevPackages(vscode.workspace.rootPath)
	vscode.window.registerTreeDataProvider('packageDependencies', dependenciesProvider)
	vscode.commands.registerCommand('packageDependencies.refresh', () => dependenciesProvider.refresh())

	// Create log channel
	const openocdLogger = new FrontendChannelLogger('Openocd', 'openocd')
	const uploadLogger = new FrontendChannelLogger('Upload', 'upload')
	const serialportLogger = new FrontendChannelLogger('Serialport', 'serialport')

	// Status bar items
	const home = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
	home.command = 'packageDependencies.createWebview'
	home.text = '$(home) Kendryte Homepage'
	home.show()
	context.subscriptions.push(home)

	const build = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
	build.command = 'extension.build'
	build.tooltip = 'Build'
	build.text = '$(tools)'
	build.show()
	context.subscriptions.push(build)

	const upload = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
	upload.command = 'extension.buildAndUpload'
	upload.tooltip = 'Build and Upload'
	upload.text = '$(cloud-download)'
	upload.show()
	context.subscriptions.push(upload)

	const debug = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
	debug.command = 'extension.debug'
	debug.tooltip = 'Debug'
	debug.text = '$(bug)'
	debug.show()
	context.subscriptions.push(debug)

	const serialport = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
	serialport.command = 'extension.openSerialPort'
	serialport.tooltip = 'Open serial port output'
	serialport.text = '$(terminal)'
	serialport.show()
	context.subscriptions.push(serialport)
	const updateSerialPort = (open: boolean) => {
		serialport.text = !open ? '$(terminal)' : '$(primitive-square)'
		serialport.tooltip = !open ? 'Open serial port output' : 'Stop serial port'
	}

	// SerialPort container service
	const serialPortService = new SerialPortService(updateSerialPort, context.extensionPath)

	// Devices check service
	const deviceServices = new Devices(serialPortService)
	deviceServices.on('setdevice', device => {
		updateDevice(device)
	})

	const device = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
	device.command = 'extension.pickDevice'
	device.tooltip = 'Pick a device'
	device.text = deviceServices.device || 'No device picked.'
	device.show()
	context.subscriptions.push(device)
	const updateDevice = (deviceName: string | undefined) => {
		device.text = deviceName || 'No device picked.'
	}

	// Register extension command
	context.subscriptions.push(command.reinstallPackages(context))
	context.subscriptions.push(command.build(context))
	context.subscriptions.push(command.createHelloworld(context))
	context.subscriptions.push(command.buildAndUpload(context, deviceServices, uploadLogger, serialPortService));
	context.subscriptions.push(command.debug(context))
	context.subscriptions.push(command.pickDevice(deviceServices))
	context.subscriptions.push(command.configGenerate())
	context.subscriptions.push(command.cmakelistGenerate())
	context.subscriptions.push(command.createWebview(context))
	context.subscriptions.push(command.dependenciesDownload(context))
	context.subscriptions.push(command.addDependency(context, dependenciesProvider))
	context.subscriptions.push(command.deleteDependency(dependenciesProvider))
	context.subscriptions.push(command.openSerialPort(deviceServices, serialportLogger, serialPortService))

	// Openocd service command
	const openocdService = new OpenocdService(openocdLogger)
	context.subscriptions.push(command.openocdStart(openocdService))
	context.subscriptions.push(command.openocdStop(openocdService))
	context.subscriptions.push(command.openocdRestart(openocdService))

	// Debug Part
	// The following part is copied from https://github.com/GongT/kendryte-ide-shell/blob/master/extensions.kendryte/kendryte-debug/src/frontend/extension.ts
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('debugmemory', new MemoryContentProvider()))
	context.subscriptions.push(vscode.commands.registerCommand('kendryte-debug.examineMemoryLocation', examineMemory))
	context.subscriptions.push(vscode.commands.registerCommand('kendryte-debug.getFileNameNoExt', () => {
		if (!vscode.window.activeTextEditor || !vscode.window.activeTextEditor.document || !vscode.window.activeTextEditor.document.fileName) {
			vscode.window.showErrorMessage('No editor with valid file name active')
			return
		}
		const fileName = vscode.window.activeTextEditor.document.fileName
		const ext = path.extname(fileName)
		return fileName.substr(0, fileName.length - ext.length)
	}))
	context.subscriptions.push(vscode.commands.registerCommand('kendryte-debug.getFileBasenameNoExt', () => {
		if (!vscode.window.activeTextEditor || !vscode.window.activeTextEditor.document || !vscode.window.activeTextEditor.document.fileName) {
			vscode.window.showErrorMessage('No editor with valid file name active')
			return
		}
		const fileName = path.basename(vscode.window.activeTextEditor.document.fileName)
		const ext = path.extname(fileName)
		return fileName.substr(0, fileName.length - ext.length)
	}))
	context.subscriptions.push(new BackendLogReceiver())
	context.subscriptions.push({
		dispose: disposeChannel,
	})

	vscode.debug.registerDebugConfigurationProvider('kendryte', new Provider())

	// Create config files and watch kendryte-package.json
	const files = await vscode.workspace.findFiles('kendryte-package.json')
	if (files.length > 0) {
		await vscode.commands.executeCommand('extension.configGenerate')
		const watcher = vscode.workspace.createFileSystemWatcher(files[0].path)
		watcher.onDidChange(_ => {
			vscode.commands.executeCommand('extension.configGenerate')
		})
	}
	vscode.commands.executeCommand('packageDependencies.createWebview')
}

class Provider implements vscode.DebugConfigurationProvider {
	private readonly logger: IMyLogger

	constructor() {
		this.logger = new FrontendChannelLogger('Provider', 'kendryte.gdb')
	}

	provideDebugConfigurations(folder: WorkspaceFolder | undefined, token?: CancellationToken): ProviderResult<DebugConfiguration[]> {
		this.logger.info('createDebugAdapterDescriptor', arguments)
		return []
	}

	createDebugAdapterDescriptor() {
		this.logger.info('createDebugAdapterDescriptor', arguments)
		debugger
	}
}

const memoryLocationRegex = /^0x[0-9a-f]+$/

function getMemoryRange(range: string) {
	if (!range) {
		return undefined
	}
	range = range.replace(/\s+/g, '').toLowerCase()
	let index
	if ((index = range.indexOf('+')) !== -1) {
		const from = range.substr(0, index)
		let length = range.substr(index + 1)
		if (!memoryLocationRegex.exec(from)) {
			return undefined
		}
		if (memoryLocationRegex.exec(length)) {
			length = parseInt(length.substr(2), 16).toString()
		}
		return 'from=' + encodeURIComponent(from) + '&length=' + encodeURIComponent(length)
	} else if ((index = range.indexOf('-')) != -1) {
		const from = range.substr(0, index)
		const to = range.substr(index + 1)
		if (!memoryLocationRegex.exec(from)) {
			return undefined
		}
		if (!memoryLocationRegex.exec(to)) {
			return undefined
		}
		return 'from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to)
	} else if (memoryLocationRegex.exec(range)) {
		return 'at=' + encodeURIComponent(range)
	} else {
		return undefined
	}
}

function examineMemory() {
	const socketlists = path.join(os.tmpdir(), 'kendryte-debug-sockets')
	if (!fs.existsSync(socketlists)) {
		if (process.platform == 'win32') {
			return vscode.window.showErrorMessage('This command is not available on windows')
		} else {
			return vscode.window.showErrorMessage('No debugging sessions available')
		}
	}
	fs.readdir(socketlists, (err, files) => {
		if (err) {
			if (process.platform == 'win32') {
				return vscode.window.showErrorMessage('This command is not available on windows')
			} else {
				return vscode.window.showErrorMessage('No debugging sessions available')
			}
		}
		const pickedFile = (file: string | undefined) => {
			vscode.window.showInputBox({
				placeHolder: 'Memory Location or Range',
				validateInput: (range: string) => getMemoryRange(range) === undefined ? 'Range must either be in format 0xF00-0xF01, 0xF100+32 or 0xABC154' : '',
			}).then(range => {
				vscode.commands.executeCommand('vscode.previewHtml', vscode.Uri.parse('debugmemory://' + file + '#' + getMemoryRange(range || '')))
			})
		}
		if (files.length == 1) {
			pickedFile(files[0])
		} else if (files.length > 0) {
			vscode.window.showQuickPick(files, { placeHolder: 'Running debugging instance' }).then(file => pickedFile(file))
		} else if (process.platform == 'win32') {
			return vscode.window.showErrorMessage('This command is not available on windows')
		} else {
			vscode.window.showErrorMessage('No debugging sessions available')
		}
	})
}

class MemoryContentProvider implements vscode.TextDocumentContentProvider {
	provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Thenable<string> {
		return new Promise((resolve, reject) => {
			const conn = net.connect(path.join(os.tmpdir(), 'kendryte-debug-sockets', uri.authority))
			let from: number, to: number
			let highlightAt = -1
			const splits = uri.fragment.split('&')
			if (splits[0].split('=')[0] == 'at') {
				const loc = parseInt(splits[0].split('=')[1].substr(2), 16)
				highlightAt = 64
				from = Math.max(loc - 64, 0)
				to = Math.max(loc + 768, 0)
			} else if (splits[0].split('=')[0] == 'from') {
				from = parseInt(splits[0].split('=')[1].substr(2), 16)
				if (splits[1].split('=')[0] == 'to') {
					to = parseInt(splits[1].split('=')[1].substr(2), 16)
				} else if (splits[1].split('=')[0] == 'length') {
					to = from + parseInt(splits[1].split('=')[1])
				} else {
					return reject('Invalid Range')
				}
			} else {
				return reject('Invalid Range')
			}
			if (to < from) {
				return reject('Negative Range')
			}
			conn.write('examineMemory ' + JSON.stringify([from, to - from + 1]))
			conn.once('data', data => {
				let formattedCode = ''
				const hexString = data.toString()
				let x = 0
				let asciiLine = ''
				let byteNo = 0
				for (let i = 0; i < hexString.length; i += 2) {
					const digit = hexString.substr(i, 2)
					const digitNum = parseInt(digit, 16)
					if (digitNum >= 32 && digitNum <= 126) {
						asciiLine += String.fromCharCode(digitNum)
					} else {
						asciiLine += '.'
					}
					if (highlightAt == byteNo) {
						formattedCode += '<b>' + digit + '</b> '
					} else {
						formattedCode += digit + ' '
					}
					if (++x > 16) {
						formattedCode += asciiLine + '\n'
						x = 0
						asciiLine = ''
					}
					byteNo++
				}
				if (x > 0) {
					for (let i = 0; i <= 16 - x; i++) {
						formattedCode += '   '
					}
					formattedCode += asciiLine
				}
				resolve('<h2>Memory Range from 0x' + from.toString(16) + ' to 0x' + to.toString(16) + '</h2><code><pre>' + formattedCode + '</pre></code>')
				conn.destroy()
			})
		})
	}
}


// this method is called when your extension is deactivated
export function deactivate() { }
