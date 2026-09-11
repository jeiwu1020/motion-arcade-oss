import type { LogicalPlayfieldPoint } from './spatialPlayfieldMapping'

export interface SpatialMotionSegment {
  readonly from: LogicalPlayfieldPoint
  readonly to: LogicalPlayfieldPoint
}

export interface SpatialCircleTarget {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly radius: number
}

export interface SpatialHandContactSample {
  readonly side: 'LEFT' | 'RIGHT'
  readonly sequence: number
  readonly current: LogicalPlayfieldPoint | null
  readonly segment: SpatialMotionSegment | null
}

function isPointInsideCircle(
  point: LogicalPlayfieldPoint,
  target: SpatialCircleTarget,
): boolean {
  const horizontal = point.x - target.x
  const vertical = point.y - target.y
  return horizontal * horizontal + vertical * vertical <= target.radius * target.radius
}

/**
 * Detects contact along an entire logical hand path, including a fast pass
 * through a circle when both endpoints lie outside it.
 */
export function doesSegmentIntersectCircle(
  segment: SpatialMotionSegment,
  target: SpatialCircleTarget,
): boolean {
  const horizontal = segment.to.x - segment.from.x
  const vertical = segment.to.y - segment.from.y
  const lengthSquared = horizontal * horizontal + vertical * vertical
  if (lengthSquared === 0) return isPointInsideCircle(segment.from, target)

  const fromTargetX = target.x - segment.from.x
  const fromTargetY = target.y - segment.from.y
  const progress = Math.max(
    0,
    Math.min(1, (fromTargetX * horizontal + fromTargetY * vertical) / lengthSquared),
  )
  const closestPoint = {
    x: segment.from.x + horizontal * progress,
    y: segment.from.y + vertical * progress,
  }

  return isPointInsideCircle(closestPoint, target)
}

interface ContactState {
  readonly sequence: number
  readonly isContacting: boolean
}

/**
 * Keeps per-anatomical-hand contact state for a target. A hit is an outside
 * to contact transition; a held overlap cannot repeatedly emit hits.
 */
export class SpatialCircleContactTracker {
  readonly #states = new Map<string, ContactState>()

  update(sample: SpatialHandContactSample, target: SpatialCircleTarget): boolean {
    const key = `${target.id}:${sample.side}`
    const previous = this.#states.get(key)
    if (previous && sample.sequence === previous.sequence) return false

    const priorContact =
      previous && sample.sequence > previous.sequence
        ? previous.isContacting
        : false
    const isContacting =
      sample.current !== null && isPointInsideCircle(sample.current, target)
    const crossesTarget =
      sample.current !== null &&
      sample.segment !== null &&
      doesSegmentIntersectCircle(sample.segment, target)
    this.#states.set(
      key,
      Object.freeze({ sequence: sample.sequence, isContacting }),
    )
    return (isContacting || crossesTarget) && !priorContact
  }

  reset(): void {
    this.#states.clear()
  }
}
