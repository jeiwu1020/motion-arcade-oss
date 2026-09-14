import { balloonPopRegistration } from '../../games/balloon-pop/registration'
import { reactionArenaRegistration } from '../../games/reaction-arena/registration'
import { runnerRegistration } from '../../games/runner/registration'
import { rhythmMotionRegistration } from '../../games/rhythm-motion/registration'
import { tennisRegistration } from '../../games/tennis/registration'
import { badmintonRegistration } from '../../games/badminton/registration'
import { bowlingRegistration } from '../../games/bowling/registration'
import type { GameRegistration } from './types'
import { assertValidGameRegistry } from './validateRegistry'

export const gameRegistry = Object.freeze([
  balloonPopRegistration,
  reactionArenaRegistration,
  runnerRegistration,
  rhythmMotionRegistration,
  tennisRegistration,
  badmintonRegistration,
  bowlingRegistration,
]) satisfies readonly GameRegistration[]

assertValidGameRegistry(gameRegistry)
