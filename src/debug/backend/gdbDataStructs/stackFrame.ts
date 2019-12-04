export interface IGDBStackFrame {
	level: string // number
	addr: string // hex
	func: string
	file: string
	fullname: string
	line?: string // number
	from?: string // number ???
}