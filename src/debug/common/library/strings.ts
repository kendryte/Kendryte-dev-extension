export function padPercent(n: number) {
	const s = n.toFixed(0)
	if (s.length === 3) {
		return s + '%'
	} else if (s.length === 2) {
		return ' ' + s + '%'
	} else if (s.length === 1) {
		return '  ' + s + '%'
	}
	return 'NaN'
}

export function errorMessage(e: Error): string {
	return e ? e.message || '' + e || 'UnknownError' : 'UnknownError'
}

export function errorStack(e: Error) {
	return e && e.stack || errorMessage(e) + '\n  No stack trace available'
}

export function dumpJson(a: any) {
	return `\n--------------------------------\n${JSON.stringify(a, null, 4)}\n--------------------------------`
}
