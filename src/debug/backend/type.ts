import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol'
import { objectPath } from '../common/library/objectPath'
import { MINode } from '../common/mi2/mi2Node'

export interface RequestArguments {
	id: string
	cwd: string
	target: string
	gdbpath: string
	env: NodeJS.ProcessEnv
	debuggerArgs: string[]
	autorun: string[]
	executable: string
	remote: boolean
	valuesFormatting: ValuesFormattingMode
}

export interface LaunchRequestArguments extends RequestArguments, DebugProtocol.LaunchRequestArguments {
}

export interface AttachRequestArguments extends RequestArguments, DebugProtocol.AttachRequestArguments {
}

export type ValuesFormattingMode = 'disabled' | 'parseText' | 'prettyPrinters'

export class VariableObject {
	name: string
	exp: string
	numchild: number
	type: string
	value: string
	threadId: string
	frozen: boolean
	dynamic: boolean
	displayhint: string
	hasMore: boolean
	id!: number

	constructor(node: any) {
		this.name = objectPath(node, 'name')
		this.exp = objectPath(node, 'exp')
		this.numchild = parseInt(objectPath(node, 'numchild'))
		this.type = objectPath(node, 'type')
		this.value = objectPath(node, 'value')
		this.threadId = objectPath(node, 'thread-id')
		this.frozen = !!objectPath(node, 'frozen')
		this.dynamic = !!objectPath(node, 'dynamic')
		this.displayhint = objectPath(node, 'displayhint')
		// TODO: use has_more when it's > 0
		this.hasMore = !!objectPath(node, 'has_more')
	}

	public applyChanges(node: MINode) {
		this.value = objectPath(node, 'value')
		if (!!objectPath(node, 'type_changed')) {
			this.type = objectPath(node, 'new_type')
		}
		this.dynamic = !!objectPath(node, 'dynamic')
		this.displayhint = objectPath(node, 'displayhint')
		this.hasMore = !!objectPath(node, 'has_more')
	}

	public isCompound(): boolean {
		return this.numchild > 0 || this.value === '{...}' || (this.dynamic && (this.displayhint === 'array' || this.displayhint === 'map'))
	}

	public toProtocolVariable(): DebugProtocol.Variable {
		return {
			name: this.exp,
			evaluateName: this.name,
			value: (this.value === void 0) ? '<unknown>' : this.value,
			type: this.type,
			variablesReference: this.id,
		}
	}
}
