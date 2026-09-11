import type { SpatialHandSnapshot } from '../../motion/contracts/spatial'
import type { BalloonRallyPhase } from './BalloonRallyCore'
import type { BalloonRallyTrackingInput } from './BalloonRallySession'

export interface ResolveBalloonRallyTrackingInputOptions {
  readonly phase: BalloonRallyPhase
  readonly runtimeReady: boolean
  readonly hardFailure: boolean
  readonly spatialSnapshot: SpatialHandSnapshot
}

/**
 * Setup stays bound to legitimate UPPER_BODY readiness. Once the Core is
 * active, an independently AVAILABLE canonical wrist is the interaction truth.
 */
export function resolveBalloonRallyTrackingInput({
  phase,
  runtimeReady,
  hardFailure,
  spatialSnapshot,
}: ResolveBalloonRallyTrackingInputOptions): BalloonRallyTrackingInput {
  const spatialHandAvailable =
    spatialSnapshot.leftHand.availability === 'AVAILABLE' ||
    spatialSnapshot.rightHand.availability === 'AVAILABLE'
  return Object.freeze({
    setupReady: runtimeReady,
    usefulTracking: phase === 'PLAYING' ? spatialHandAvailable : runtimeReady,
    hardFailure,
  })
}
