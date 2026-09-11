export type BalloonRallyVisualHandSide = 'LEFT' | 'RIGHT'

export interface BalloonRallyHandVisualSnapshot {
  readonly side: BalloonRallyVisualHandSide
  readonly availability: 'AVAILABLE' | 'UNAVAILABLE'
  readonly x?: number
  readonly y?: number
}

export interface BalloonRallyHandGlowPoint {
  readonly x: number
  readonly y: number
  readonly createdAtMs: number
}

export interface BalloonRallyHandGlowTrack {
  readonly anchor: Readonly<{ x: number; y: number }> | null
  readonly points: readonly BalloonRallyHandGlowPoint[]
}

export interface BalloonRallyHandGlowTrailState {
  readonly left: BalloonRallyHandGlowTrack
  readonly right: BalloonRallyHandGlowTrack
}

export const BALLOON_RALLY_HAND_GLOW_CONFIG = Object.freeze({
  trailLifetimeMs: 200,
  unavailableFadeMs: 180,
  minimumTrailDistancePx: 8,
  maximumTrailPoints: 12,
})

export interface BalloonRallyComboMilestone {
  readonly value: number
  readonly label: string
}

export function getComboMilestoneCrossed(previousCombo: number, nextCombo: number): BalloonRallyComboMilestone | null {
  const previousBucket = Math.floor(Math.max(0, previousCombo) / 5)
  const nextBucket = Math.floor(Math.max(0, nextCombo) / 5)
  if (nextBucket <= previousBucket || nextBucket < 1) return null
  const value = nextBucket * 5
  return { value, label: value === 10 ? 'SUPER COMBO!' : `${value} COMBO!` }
}

function cleanTrack(track: BalloonRallyHandGlowTrack, nowMs: number): BalloonRallyHandGlowTrack {
  return {
    anchor: track.anchor,
    points: track.points.filter((point) => nowMs - point.createdAtMs <= BALLOON_RALLY_HAND_GLOW_CONFIG.trailLifetimeMs),
  }
}

function updateTrack(
  previous: BalloonRallyHandGlowTrack,
  visual: BalloonRallyHandVisualSnapshot | undefined,
  nowMs: number,
): BalloonRallyHandGlowTrack {
  const cleaned = cleanTrack(previous, nowMs)
  if (!visual || visual.availability !== 'AVAILABLE' || !Number.isFinite(visual.x) || !Number.isFinite(visual.y)) {
    return {
      anchor: null,
      points: previous.points.filter((point) => nowMs - point.createdAtMs <= BALLOON_RALLY_HAND_GLOW_CONFIG.unavailableFadeMs),
    }
  }
  const point = { x: visual.x as number, y: visual.y as number }
  const last = cleaned.anchor
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < BALLOON_RALLY_HAND_GLOW_CONFIG.minimumTrailDistancePx) {
    return { anchor: point, points: cleaned.points }
  }
  const points = [...cleaned.points, { ...point, createdAtMs: nowMs }]
  return {
    anchor: point,
    points: points.slice(-BALLOON_RALLY_HAND_GLOW_CONFIG.maximumTrailPoints),
  }
}

export function updateBalloonRallyHandGlowTrail(
  previous: BalloonRallyHandGlowTrailState,
  visuals: readonly BalloonRallyHandVisualSnapshot[],
  nowMs: number,
): BalloonRallyHandGlowTrailState {
  const left = visuals.find((visual) => visual.side === 'LEFT')
  const right = visuals.find((visual) => visual.side === 'RIGHT')
  return {
    left: updateTrack(previous.left, left, nowMs),
    right: updateTrack(previous.right, right, nowMs),
  }
}
