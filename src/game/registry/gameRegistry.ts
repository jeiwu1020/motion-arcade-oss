import { balloonPopRegistration } from '../../games/balloon-pop/registration'
import type { GameRegistration } from './types'
import { assertValidGameRegistry } from './validateRegistry'

export const gameRegistry = Object.freeze([
  balloonPopRegistration,
]) satisfies readonly GameRegistration[]

assertValidGameRegistry(gameRegistry)
