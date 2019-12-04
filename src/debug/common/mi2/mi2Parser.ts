/**
 *    output ==>
 *        (
 *            exec-async-output     = [ token ] "*" ("stopped" | others) ( "," variable "=" (const | tuple | list) )* \n
 *            status-async-output   = [ token ] "+" ("stopped" | others) ( "," variable "=" (const | tuple | list) )* \n
 *            notify-async-output   = [ token ] "=" ("stopped" | others) ( "," variable "=" (const | tuple | list) )* \n
 *            console-stream-output = "~" c-string \n
 *            target-stream-output  = "@" c-string \n
 *            log-stream-output     = "&" c-string \n
 *        )*
 *        [
 *            [ token ] "^" ("done" | "running" | "connected" | "error" | "exit") ( "," variable "=" (const | tuple | list) )* \n
 *        ]
 *        "(gdb)" \n
 */
import { escapeCString } from './cString'
import { MIAsyncNodeImpl, MIResultNodeImpl, MIStreamNodeImpl, OneOfMiNodeType } from './mi2Node'
import { Mi2SyntaxError } from './syntaxError'

export const isMi2Output = /^(?:\d*|undefined)[*+=]|[~@&^]/

const tokenRegex = /^\d+/
const asyncRecordRegex = /^(\d*|undefined)([*+=])/
const streamRecordRegex = /^([~@&])/
const resultRecordRegex = /^(\d*)\^(done|running|connected|error|exit)/
const variableRegex = /^[a-zA-Z_\-][a-zA-Z0-9_\-]*/

export enum MiOutputType {
	asyncExec,
	asyncStatus,
	asyncNotify,
	streamConsole,
	streamTarget,
	streamLog,
	result,
}

function escapeRegExp(string: { replace: (arg0: RegExp, arg1: string) => void }) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

type CallbackType = (() => any) | ((required: boolean) => any)

function popAll(...cbList: CallbackType[]): any[] {
	let ret = []

	function firstOkCb() {
		for (const cb of cbList) {
			const ret = cb(false)
			if (ret) {
				return ret
			}
		}
	}

	for (let value = firstOkCb(); value; value = firstOkCb()) {
		ret.push(value)
	}
	return ret
}

export function parseMI(output: string): OneOfMiNodeType {
	output = output.trim()
	const remOutput = output

	function isEnding() {
		return output.length === 0
	}

	function findMatch(wantList: string[] | string) {
		const subs = Array.isArray(wantList) ? wantList : [wantList]
		let match = 0
		subs.every((sub) => {
			if (sub === output.substr(0, sub.length)) {
				match = sub.length
				return false
			} else {
				return true
			}
		})
		return match
	}

	function assertIs(wantList: string[] | string, extraMessage?: string) {
		const match = findMatch(wantList)
		if (!match) {
			throw new Mi2SyntaxError(`missing "${wantList}" ${extraMessage || ''}`, remOutput, output)
		}
	}

	function readReg(reg: RegExp, required = false) {
		const m = reg.exec(output)
		if (!m) {
			if (required) {
				throw new Mi2SyntaxError(`missing "${reg}"`, remOutput, output)
			}
			return undefined
		}
		output = output.substr(m[0].length)
		return m
	}

	function read(length: number) {
		if (!length) {
			return undefined
		}
		const ret = output.substr(0, length)
		output = output.substr(length)
		return ret
	}

	function cut(wantList: string[] | string, required: boolean = false) {
		if (required) {
			assertIs(wantList)
		}
		return read(findMatch(wantList))
	}

	function parseCString() {
		// console.log('parseCString:', output)
		assertIs('"')
		let stringEnd = 1
		let inString = true
		let remaining = output.substr(stringEnd)
		let escaping = false
		while (inString && remaining.length) {
			if (escaping) {
				escaping = false
			} else if (remaining[0] == '\\') {
				escaping = true
			} else if (remaining[0] == '"') {
				inString = false
			}

			remaining = remaining.substr(1)
			stringEnd++
		}

		if (inString) {
			throw new Mi2SyntaxError('missing string ending', remOutput, output)
		}

		return escapeCString(read(stringEnd) || '')
	}

	function parseTupleOrList(required = false) {
		// console.log('parseTupleOrList:', output)
		const first = cut(['{', '['], required)
		if (!first) {
			return undefined
		}
		const isArray = first === '['
		if (isArray) {
			const ret = popAll(parseValue, parseResult, parseCommaAny)
			cut(']', true)
			return ret
		} else {
			const objectItems = popAll(parseResult, parseCommaAny)
			const ret = Object.assign({}, ...objectItems)
			// console.log(ret)
			cut('}', true)
			return ret
		}
	}

	function parseValue(required = false) { // parse xxxx=<???>
		// console.log('parseValue:', output)
		if (findMatch('"')) {
			return parseCString()
		} else if (findMatch(['{', '['])) {
			return parseTupleOrList(required)
		} else if (required) {
			throw new Mi2SyntaxError('require a value', remOutput, output)
		} else {
			return undefined
		}
	}

	function parseResult(required = false) { // parse <xxxx=???>
		const variableMatch = variableRegex.exec(output)
		if (!variableMatch) {
			if (required) {
				throw new Mi2SyntaxError('require result', remOutput, output)
			}
			return undefined
		}
		const variableName = variableMatch[0]
		read(variableName.length)
		cut('=', true)
		const mainValue = parseValue(true)
		if (mainValue && typeof mainValue === 'object' && !Array.isArray(mainValue)) {
			while (findMatch(',{')) {
				const child = parseCommaTupleOrList(true)
				if (mainValue.MI2ChildValues) {
					if (Array.isArray(mainValue.MI2ChildValues)) {
						mainValue.MI2ChildValues.push(child)
					} else {
						mainValue.MI2ChildValues = [mainValue.MI2ChildValues, child]
					}
				} else {
					mainValue.MI2ChildValues = child
				}
			}
		}
		return { [variableName]: mainValue }
	}

	function parseCommaTupleOrList(required = false) { // parse <,???>
		if (!cut(',', required)) {
			return undefined
		}
		const value = parseTupleOrList()
		if (required && value === undefined) {
			throw new Mi2SyntaxError('require object or array ', remOutput, output)
		}
		return value
	}

	function parseCommaAny(required = false) { // parse <,???>
		if (!cut(',', required)) {
			return undefined
		}
		const value = parseResult() || parseTupleOrList()
		if (required && value === undefined) {
			throw new Mi2SyntaxError('require result or object or array ', remOutput, output)
		}
		return value
	}

	function parseCommaResult(required = false) { // parse <,xxxx=???>
		if (!cut(',', required)) {
			return undefined
		}
		const value = parseResult()
		if (required && value === undefined) {
			throw new Mi2SyntaxError('require result ', remOutput, output)
		}
		return value
	}

	const tokenMatch = readReg(/^\d+/)
	const token = tokenMatch ? parseInt(tokenMatch[0]) : NaN
	const type = cut(['*', '+', '=', '^', '~', '@', '&'], true)

	function handleRecord() {
		const className = (readReg(variableRegex, true) || [])[0]
		if (isEnding()) {
			return { className, value: undefined }
		}
		cut(',', true)
		let value = parseTupleOrList()
		if (value) {
			if (!isEnding()) {
				throw new Mi2SyntaxError('expect eol ', remOutput, output)
			}
		} else {
			const valueArr = popAll(parseResult, parseCommaResult)
			if (!isEnding()) {
				throw new Mi2SyntaxError('expect eol ', remOutput, output)
			}
			value = Object.assign({}, ...valueArr)
		}
		return { className, value }
	}

	if (type === '*') {
		const { className, value } = handleRecord()
		return new MIAsyncNodeImpl(remOutput, MiOutputType.asyncExec, token, className, value)
	} else if (type === '+') {
		const { className, value } = handleRecord()
		return new MIAsyncNodeImpl(remOutput, MiOutputType.asyncStatus, token, className, value)
	} else if (type === '=') {
		const { className, value } = handleRecord()
		return new MIAsyncNodeImpl(remOutput, MiOutputType.asyncNotify, token, className, value)
	} else if (type === '^') {
		const { className, value } = handleRecord()
		return new MIResultNodeImpl(remOutput, MiOutputType.result, token, className as any, value)
	} else if (type === '~') {
		const content = parseCString()
		return new MIStreamNodeImpl(remOutput, MiOutputType.streamConsole, content)
	} else if (type === '@') {
		const content = parseCString()
		return new MIStreamNodeImpl(remOutput, MiOutputType.streamTarget, content)
	} else if (type === '&') {
		const content = parseCString()
		return new MIStreamNodeImpl(remOutput, MiOutputType.streamLog, content)
	} else {
		const content = parseCString()
		return new MIStreamNodeImpl(remOutput, MiOutputType.streamLog, content)
	}
}
