import type {
  AnatomicalSide,
  MotionActionId,
  NormalizedPoint2D,
  WorldHorizontalDirection,
} from '../contracts/motion'

export interface CoordinateTransform {
  readonly sourceCoordinates: 'CANONICAL' | 'MIRRORED'
}

const ACTION_SIDE: Readonly<Partial<Record<MotionActionId, AnatomicalSide>>> = {
  STRIKE_LEFT: 'LEFT',
  STRIKE_RIGHT: 'RIGHT',
  REACH_LEFT: 'LEFT',
  REACH_RIGHT: 'RIGHT',
  ARM_SWING_LEFT: 'LEFT',
  ARM_SWING_RIGHT: 'RIGHT',
  HAND_POSITION_LEFT: 'LEFT',
  HAND_POSITION_RIGHT: 'RIGHT',
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

export function canonicalizeSourcePoint(
  point: NormalizedPoint2D,
  transform: CoordinateTransform,
): NormalizedPoint2D {
  const x = clamp01(point.x)
  return {
    x: transform.sourceCoordinates === 'MIRRORED' ? 1 - x : x,
    y: clamp01(point.y),
  }
}

export function canonicalizeHorizontalDelta(
  deltaX: number,
  transform: CoordinateTransform,
): number {
  const finiteDelta = Number.isFinite(deltaX) ? deltaX : 0
  return transform.sourceCoordinates === 'MIRRORED'
    ? -finiteDelta
    : finiteDelta
}

export function getWorldHorizontalDirection(
  canonicalDeltaX: number,
): WorldHorizontalDirection {
  if (canonicalDeltaX < 0) return 'LEFT'
  if (canonicalDeltaX > 0) return 'RIGHT'
  return 'NONE'
}

export function getAnatomicalSide(
  actionId: MotionActionId,
): AnatomicalSide | undefined {
  return ACTION_SIDE[actionId]
}
