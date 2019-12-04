export function objectPath(obj: object, path: string): any {
	path.split('.').every((name) => {
		return obj = (obj as any)[name]
	})
	return obj
}

export function skipArray(item: ReadonlyArray<any>, path: string) {
	if (!Array.isArray(item) || item.length === 0) {
		return undefined
	}
	let ret: any = undefined, i = 0
	item.some((item) => {
		return ret = objectPath(item, path)
	})

	return ret
}
