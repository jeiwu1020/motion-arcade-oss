import type { SpatialHand, SpatialHandSnapshot } from '../motion/contracts/spatial'
import {
  calculateCameraVisibleLogicalWorldRect,
  mapSpatialHandToLogicalPlayfield,
  type LogicalPlayfieldPoint,
  type LogicalPlayfieldRect,
} from './spatialPlayfieldMapping'
import type { CameraPresentationDimensions } from '../components/camera-presentation/spatialDisplayMapping'
import type { SpatialMotionSegment } from './spatialCollision'

export interface SpatialCollisionGeometry {
  readonly source: CameraPresentationDimensions
  readonly stage: CameraPresentationDimensions
}

export interface AvailableLogicalSpatialHand {
  readonly availability: 'AVAILABLE'
  readonly sequence: number
  readonly current: LogicalPlayfieldPoint
  readonly segment: SpatialMotionSegment | null
}

export interface UnavailableLogicalSpatialHand {
  readonly availability: 'UNAVAILABLE'
  readonly sequence: number
}

export type LogicalSpatialHand =
  | AvailableLogicalSpatialHand
  | UnavailableLogicalSpatialHand

export interface SpatialCollisionSnapshot {
  readonly sequence: number
  readonly cameraVisibleWorldRect: LogicalPlayfieldRect | null
  readonly leftHand: LogicalSpatialHand
  readonly rightHand: LogicalSpatialHand
}

function unavailable(sequence: number): UnavailableLogicalSpatialHand {
  return Object.freeze({ availability: 'UNAVAILABLE' as const, sequence })
}

function snapshot(
  sequence: number,
  cameraVisibleWorldRect: LogicalPlayfieldRect | null,
  leftHand: LogicalSpatialHand,
  rightHand: LogicalSpatialHand,
): SpatialCollisionSnapshot {
  return Object.freeze({
    sequence,
    cameraVisibleWorldRect: cameraVisibleWorldRect
      ? Object.freeze({ ...cameraVisibleWorldRect })
      : null,
    leftHand,
    rightHand,
  })
}

function geometryKey(geometry: SpatialCollisionGeometry): string {
  return [
    geometry.source.width,
    geometry.source.height,
    geometry.stage.width,
    geometry.stage.height,
  ].join(':')
}

function sourceSampleKey(source: SpatialHandSnapshot): string {
  return [
    source.sequence,
    source.timestampMs,
    source.leftHand.availability,
    source.rightHand.availability,
  ].join(':')
}

function logicalHand(
  hand: SpatialHand,
  sequence: number,
  previous: LogicalSpatialHand,
  canContinue: boolean,
  geometry: SpatialCollisionGeometry,
): LogicalSpatialHand {
  const current = mapSpatialHandToLogicalPlayfield(
    hand,
    geometry.source,
    geometry.stage,
  )
  if (!current) return unavailable(sequence)

  const segment =
    canContinue && previous.availability === 'AVAILABLE'
      ? Object.freeze({
          from: Object.freeze({ ...previous.current }),
          to: Object.freeze({ ...current }),
        })
      : null
  return Object.freeze({
    availability: 'AVAILABLE' as const,
    sequence,
    current: Object.freeze({ ...current }),
    segment,
  })
}

/**
 * Session-local adapter from immutable canonical wrist snapshots to logical
 * Phaser-facing hand samples. It owns only presentation/game-coordinate
 * continuity; it does not know about Pose, DOM, Phaser objects, or rules.
 */
export class SpatialCollisionInputAdapter {
  #outputSequence = 0
  #lastSourceSequence: number | null = null
  #lastSourceTimestamp: number | null = null
  #lastSourceKey: string | null = null
  #lastGeometryKey: string | null = null
  #snapshot: SpatialCollisionSnapshot = snapshot(
    0,
    null,
    unavailable(0),
    unavailable(0),
  )

  ingest(source: SpatialHandSnapshot, geometry: SpatialCollisionGeometry): void {
    const nextSourceKey = sourceSampleKey(source)
    const nextGeometryKey = geometryKey(geometry)
    const geometryChanged = nextGeometryKey !== this.#lastGeometryKey
    if (nextSourceKey === this.#lastSourceKey && !geometryChanged) return

    const sourceContinues =
      !geometryChanged &&
      this.#lastSourceSequence !== null &&
      this.#lastSourceTimestamp !== null &&
      source.sequence > this.#lastSourceSequence &&
      source.timestampMs >= this.#lastSourceTimestamp

    const outputSequence = ++this.#outputSequence
    this.#snapshot = snapshot(
      outputSequence,
      calculateCameraVisibleLogicalWorldRect(geometry.source, geometry.stage),
      logicalHand(
        source.leftHand,
        outputSequence,
        this.#snapshot.leftHand,
        sourceContinues,
        geometry,
      ),
      logicalHand(
        source.rightHand,
        outputSequence,
        this.#snapshot.rightHand,
        sourceContinues,
        geometry,
      ),
    )
    this.#lastSourceSequence = source.sequence
    this.#lastSourceTimestamp = source.timestampMs
    this.#lastSourceKey = nextSourceKey
    this.#lastGeometryKey = nextGeometryKey
  }

  getSnapshot(): SpatialCollisionSnapshot {
    return this.#snapshot
  }

  reset(): void {
    const outputSequence = ++this.#outputSequence
    this.#snapshot = snapshot(
      outputSequence,
      null,
      unavailable(outputSequence),
      unavailable(outputSequence),
    )
    this.#lastSourceSequence = null
    this.#lastSourceTimestamp = null
    this.#lastSourceKey = null
    this.#lastGeometryKey = null
  }

  /**
   * Break hand continuity while retaining the latest valid presentation
   * geometry so a game-scoped soft recovery can keep its world moving safely.
   */
  resetContinuity(): void {
    const outputSequence = ++this.#outputSequence
    this.#snapshot = snapshot(
      outputSequence,
      this.#snapshot.cameraVisibleWorldRect,
      unavailable(outputSequence),
      unavailable(outputSequence),
    )
    this.#lastSourceSequence = null
    this.#lastSourceTimestamp = null
    this.#lastSourceKey = null
    this.#lastGeometryKey = null
  }
}
