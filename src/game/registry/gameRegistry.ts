import { balloonPopRegistration } from '../../games/balloon-pop/registration'
import { reactionArenaRegistration } from '../../games/reaction-arena/registration'
import { runnerRegistration } from '../../games/runner/registration'
import { rhythmMotionRegistration } from '../../games/rhythm-motion/registration'
import { tennisRegistration } from '../../games/tennis/registration'
import { badmintonRegistration } from '../../games/badminton/registration'
import { bowlingRegistration } from '../../games/bowling/registration'
import { runningRaceRegistration } from '../../games/running-race/registration'
import { swimmingRegistration } from '../../games/swimming/registration'
import { highJumpRegistration } from '../../games/high-jump/registration'
import { longJumpRegistration } from '../../games/long-jump/registration'
import { baseballRegistration } from '../../games/baseball/registration'
import { vocalHopRegistration } from '../../games/vocal-hop/registration'
import { soundCannonRegistration } from '../../games/sound-cannon/registration'
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
  runningRaceRegistration,
  swimmingRegistration,
  highJumpRegistration,
  longJumpRegistration,
  baseballRegistration,
  vocalHopRegistration,
  soundCannonRegistration,
]) satisfies readonly GameRegistration[]

assertValidGameRegistry(gameRegistry)
