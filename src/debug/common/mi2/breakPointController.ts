import { BreakpointType, MyBreakpoint, MyBreakpointFunc, MyBreakpointLine } from './types'

export interface IBreakpointDiff {
	condition?: boolean
	logMessage?: boolean
}

export class BreakPointController {
	private readonly bp = new Map<string, MyBreakpoint[]>()

	constructor() {
	}

	public registerNew(category: string, breakpoint: MyBreakpoint) {
		if (!this.bp.has(category)) {
			this.bp.set(category, [])
		}
		(this.bp.get(category) || []).push(breakpoint)
	}

	public removeExists(category: string, breakpoint: MyBreakpoint) {
		const arr = this.bp.get(category) || []
		const index = arr.findIndex((item) => {
			return isSame(item, breakpoint)
		})
		arr.splice(index, 1)
	}

	public compareBreakpoint(a: MyBreakpoint, b: MyBreakpoint): IBreakpointDiff | false {
		let ret: IBreakpointDiff = {}
		if (isSame(a, b)) {
			if (a.type === BreakpointType.Line && b.type === BreakpointType.Line) {
				ret.logMessage = a.logMessage !== b.logMessage
			}
		}
		ret.condition = a.condition !== b.condition

		if (ret.logMessage || ret.condition) {
			return ret // update
		}
		return false // no change
	}

	public isExists(file: string, breakpoint: MyBreakpoint): MyBreakpoint | undefined {
		if (!this.bp.has(file)) {
			return
		}
		return (this.bp.get(file) || []).find((item) => {
			return isSame(breakpoint, item)
		})
	}

	conflictsAddress(addr: string): MyBreakpoint | void {
		for (const arr of this.bp.values()) {
			const exists = arr.find(item => item.addr === addr)
			if (exists) {
				return exists
			}
		}
	}

	public filterOthers(file: string, breakpoints: MyBreakpoint[]): MyBreakpoint[] {
		const ret: MyBreakpoint[] = []
		if (!this.bp.has(file)) {
			return ret
		}

		return (this.bp.get(file) || []).filter((exists) => {
			return breakpoints.every((item) => {
				return !isSame(item, exists)
			})
		})
	}

	public dump(file: string): (MyBreakpoint)[] {
		const ret = []

		ret.push(...(this.bp.get(file) || []))

		return ret
	}
}

function isSame(a: MyBreakpoint, b: MyBreakpoint) {
	if (a.type === BreakpointType.Function && b.type === BreakpointType.Function && a.name === b.name) {
		return true
	} else if (a.type === BreakpointType.Line && b.type === BreakpointType.Line && a.file === b.file && a.line === b.line) {
		return true
	} else {
		return false
	}
}
