export function escapePath(str: string) {
	if (typeof str !== 'string') {
		str = ''
	}
	str = str.replace(/\\/g, '/')
	return JSON.stringify(str)
}
