import { EventEmitter } from 'events'

export interface EventCallback<T> {
	(data: T): void
}

export interface EventRegister<T> {
	(cb: EventCallback<T>): void
}

export class Emitter<T> {
	private nodeEvent = new EventEmitter()
	private _enabled: boolean = true

	pause() {
		this._enabled = false
	}

	resume() {
		this._enabled = true
	}

	fire(data: T) {
		if (this._enabled) {
			this.nodeEvent.emit('rawEvent', data)
		}
	}

	dispose() {
		this.nodeEvent.removeAllListeners('rawEvent')
		delete this.nodeEvent
	}

	get event(): EventRegister<T> {
		return (cb: EventCallback<T>) => {
			this.nodeEvent.on('rawEvent', cb)
		}
	}
}