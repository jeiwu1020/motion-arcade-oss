/**
 * Canonical source-image coordinates from the current Pose frame.
 * `x` increases from the source image's left edge to right edge; `y` from top
 * to bottom. These values are not mirrored preview or Phaser/playfield points.
 */
export interface AvailableSpatialHand {
  readonly availability: 'AVAILABLE'
  readonly x: number
  readonly y: number
  readonly confidence: number
  readonly timestampMs: number
  readonly sequence: number
}

/** An unavailable hand intentionally has no fallback coordinate. */
export interface UnavailableSpatialHand {
  readonly availability: 'UNAVAILABLE'
  readonly timestampMs: number
  readonly sequence: number
}

export type SpatialHand = AvailableSpatialHand | UnavailableSpatialHand

/**
 * One immutable, single-Pose sample. `leftHand` and `rightHand` are always
 * anatomical participant sides, independent of any mirrored DOM preview.
 */
export interface SpatialHandSnapshot {
  readonly timestampMs: number
  readonly sequence: number
  readonly leftHand: SpatialHand
  readonly rightHand: SpatialHand
}
