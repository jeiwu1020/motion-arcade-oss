import type {
  MotionInputSnapshot,
  PlayerId,
} from '../../motion/contracts/motion'

export interface TestLabMotionBridge {
  getSnapshot(): MotionInputSnapshot
  getActivePlayerId(): PlayerId | undefined
}
