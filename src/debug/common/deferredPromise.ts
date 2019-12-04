export function sleep(ms: number): [Promise<void>, () => void] {
	let cb = () => {}
	const p = new Promise<void>((resolve, reject) => {
		const to = setTimeout(() => resolve(), ms)
		cb = () => {
			clearTimeout(to)
			reject(canceled())
		}
	})
	return [p, cb]
}

export function timeout(ms: number): [Promise<void>, () => void] {
	let cb = () => {}
	const p = new Promise<void>((resolve, reject) => {
		const to = setTimeout(() => reject(canceled()), ms)
		cb = () => {
			clearTimeout(to)
			resolve()
		}
	})
	return [p, cb]
}

export interface ProgressPromise<T, NT> extends Promise<T> {
	progress(cb: NotifyCallback<NT>): this
}

export class DeferredPromise<T, NT = void> {
	public readonly p: ProgressPromise<T, NT>
	private completeCallback!: ValueCallback<T>
	private errorCallback!: (err: any) => void
	private notifyCallbacks: NotifyCallback<NT>[] = []
	private _isComplete!: boolean
	private _isError!: boolean

	constructor() {
		this.p = Object.assign(new Promise<any>((c, e) => {
			this.completeCallback = (d) => {
				this._isComplete = true
				c(d)
			}
			this.errorCallback = (err) => {
				this._isError = true
				e(err)
			}
		}), {
			progress: (cb: NotifyCallback<NT>) => {
				this.notifyCallbacks.push(cb)
				return this.p
			},
		})
	}

	public complete(value: T) {
		process.nextTick(() => {
			this.completeCallback(value)
		})
	}

	public error(err: any) {
		process.nextTick(() => {
			this.errorCallback(err)
		})
	}

	public cancel() {
		process.nextTick(() => {
			this.errorCallback(canceled())
		})
	}

	public notify(data: NT) {
		for (const cb of this.notifyCallbacks) {
			cb(data)
		}
	}

	public isFired() {
		return this._isComplete || this._isError
	}
}

export type ValueCallback<T> = (value: T | Thenable<T>) => void
export type NotifyCallback<T> = (value: T) => void

const canceledName = 'Canceled'
const timoutName = 'Timeout'

export class CanceledError extends Error {
}

export function timeouts(): CanceledError {
	const error = new CanceledError(timoutName)
	error.name = timoutName
	return error
}

export function canceled(): CanceledError {
	const error = new CanceledError(canceledName)
	error.name = canceledName
	return error
}

export function isCancel(e: Error) {
	return e instanceof CanceledError
}
