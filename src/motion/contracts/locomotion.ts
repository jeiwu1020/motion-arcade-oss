/** Participant anatomy, never mirrored display orientation. */
export type LocomotionStepSide = 'LEFT' | 'RIGHT'

/** One accepted alternating knee-lift step. */
export interface LocomotionStepEvent {
  readonly sequence: number
  readonly side: LocomotionStepSide
  readonly timestampMs: number
  /** Body-relative lift amount normalized for arcade use. */
  readonly liftIntensity: number
}

/** Immutable, normalized compact-space locomotion output for future game Sessions. */
export interface LocomotionSnapshot {
  readonly timestampMs: number
  readonly sequence: number
  readonly availability: 'AVAILABLE' | 'UNAVAILABLE'
  /** Recent accepted alternating-step cadence; this is not real-world velocity. */
  readonly cadenceSpm: number
  readonly intensity: number
  /** The latest retained event in this input session, cleared on lifecycle reset. */
  readonly latestStep: LocomotionStepEvent | null
}

/** The small game-facing provider surface future locomotion Sessions depend on. */
export interface LocomotionSnapshotSource {
  getSnapshot(): LocomotionSnapshot
  subscribe(listener: () => void): () => void
}
