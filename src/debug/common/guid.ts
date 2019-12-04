export function autoIncrease() {
	let current = 1
	return {
		get current() {
			return current
		},
		next() {
			current++
			return current
		},
	}
}

