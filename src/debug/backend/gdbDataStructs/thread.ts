import { IGDBThreadFrame } from './threadFrame'

export interface IGDBThread {
	id: string
	'target-id': string
	name?: string
	frame: IGDBThreadFrame
	state: string
}
