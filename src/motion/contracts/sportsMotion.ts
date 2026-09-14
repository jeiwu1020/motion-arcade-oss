/** Participant anatomy, never mirrored display orientation. */
export type SportsHandSide = 'LEFT' | 'RIGHT'

export interface AvailableSportsMotionHandState {
  readonly availability: 'AVAILABLE'
  /** Canonical source-image point: x grows rightward, y grows downward. */
  readonly x: number
  readonly y: number
  readonly confidence: number
  /** Body-relative velocity in body-units per second. */
  readonly velocityX: number
  readonly velocityY: number
  /** Unit direction of the latest velocity; zero means no reliable motion. */
  readonly vectorX: number
  readonly vectorY: number
  readonly speed: number
  readonly intensity: number
  readonly timestampMs: number
  readonly sequence: number
}

/** An unavailable hand deliberately has no position, vector, or speed. */
export interface UnavailableSportsMotionHandState {
  readonly availability: 'UNAVAILABLE'
  readonly timestampMs: number
  readonly sequence: number
}

export type SportsMotionHandState =
  | AvailableSportsMotionHandState
  | UnavailableSportsMotionHandState

/** One sequence-safe broad wrist/arm sweep; it carries no sport interpretation. */
export interface SportsSwingEvent {
  readonly sequence: number
  readonly hand: SportsHandSide
  readonly timestampMs: number
  readonly vectorX: number
  readonly vectorY: number
  readonly speed: number
  readonly intensity: number
}

/** Immutable, game-facing output from the shared sports-motion foundation. */
export interface SportsMotionSnapshot {
  readonly timestampMs: number
  readonly sequence: number
  readonly leftHand: SportsMotionHandState
  readonly rightHand: SportsMotionHandState
  /** Latest left-side event in this input session, or none after a lifecycle reset. */
  readonly leftSwing: SportsSwingEvent | null
  /** Latest right-side event in this input session, or none after a lifecycle reset. */
  readonly rightSwing: SportsSwingEvent | null
}

/** The small game-facing provider surface future sports Sessions depend on. */
export interface SportsMotionSnapshotSource {
  getSnapshot(): SportsMotionSnapshot
  subscribe(listener: () => void): () => void
}
