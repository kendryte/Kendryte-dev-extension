export interface IGDBThreadFrame {
	level: string // number
	addr: string // hex
	func: string
	args: string[]
	file: string
	fullname: string
	line: string // number
}
