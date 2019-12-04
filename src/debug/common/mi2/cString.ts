const escapeChar = Buffer.from('\\')[0]
const escapeMap: { [id: string]: string } = {
	/// https://en.wikipedia.org/wiki/Escape_sequences_in_C#Table_of_escape_sequences
	'a': Buffer.from('07', 'hex').toString('latin1'),
	'b': Buffer.from('08', 'hex').toString('latin1'),
	'f': Buffer.from('0C', 'hex').toString('latin1'),
	'n': Buffer.from('0A', 'hex').toString('latin1'),
	'r': Buffer.from('0D', 'hex').toString('latin1'),
	't': Buffer.from('09', 'hex').toString('latin1'),
	'v': Buffer.from('0B', 'hex').toString('latin1'),
	'\\': Buffer.from('5C', 'hex').toString('latin1'),
	'\'': Buffer.from('27', 'hex').toString('latin1'),
	'"': Buffer.from('22', 'hex').toString('latin1'),
	'?': Buffer.from('3F', 'hex').toString('latin1'),
	'e': Buffer.from('1B', 'hex').toString('latin1'),
}

// not cover: double-quote inside the str
// like: "aaaaaa"bbbbb" - should invalid, but valid here
export function escapeCString(str: string) {
	if (str[0] != '"' || str[str.length - 1] != '"') {
		throw new Error('Not a valid string')
	}
	return str.substr(1, str.length - 2).replace(/\\u([0-9a-fA-F]{4})/g, (m, code) => {
		return Buffer.from(code, 'hex').toString('latin1')
	}).replace(/\\U([0-9a-fA-F]{8})/ig, (m, code) => {
		return Buffer.from(code, 'hex').toString('latin1')
	}).replace(/\\([0-7]{3})/ig, (m, code) => {
		return Buffer.alloc(1, parseInt(code, 8)).toString('latin1')
	}).replace(/\\x([0-9a-fA-F]{2})/ig, (m, code) => {
		return Buffer.from(code, 'hex').toString('latin1')
	}).replace(/\\([eabfnrtv\\'"?])/ig, (m, code) => {
		return escapeMap[code] || m
	})
}
