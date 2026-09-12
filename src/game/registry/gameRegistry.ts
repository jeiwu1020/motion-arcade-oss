import { balloonPopRegistration } from '../../games/balloon-pop/registration'
import { reactionArenaRegistration } from '../../games/reaction-arena/registration'
import type { GameRegistration } from './types'
import { assertValidGameRegistry } from './validateRegistry'

export const gameRegistry = Object.freeze([
  balloonPopRegistration,
  reactionArenaRegistration,
]) satisfies readonly GameRegistration[]

assertValidGameRegistry(gameRegistry)
