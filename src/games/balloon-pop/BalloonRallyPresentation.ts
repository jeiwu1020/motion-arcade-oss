import { BALLOON_RALLY_RULES } from './BalloonRallyCore'

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

export interface BalloonRallyPresentationState {
  readonly phase: 'COUNTDOWN' | 'PLAYING' | 'FINISHED'
  readonly combo: number
  readonly miniEventSequence: number
  readonly partyRush: boolean
  readonly roundRemainingMs: number
}

export const BALLOON_RALLY_PARTY_RUSH_CUE = Object.freeze({
  title: 'PARTY RUSH!',
  subtitle: '最後 10 秒！',
})

export function hasBalloonRallyCountdownStarted(countdownRemainingMs: number): boolean {
  return Number.isFinite(countdownRemainingMs) && countdownRemainingMs < BALLOON_RALLY_RULES.countdownMs
}

export type BalloonRallyOneShotCue =
  | Readonly<{ kind: 'COMBO_MILESTONE'; milestone: BalloonRallyComboMilestone }>
  | Readonly<{ kind: 'MINI_EVENT_START' }>
  | Readonly<{ kind: 'PARTY_RUSH_START' }>
  | Readonly<{ kind: 'FINAL_COUNTDOWN'; value: 3 | 2 | 1 }>
  | Readonly<{ kind: 'ROUND_FINISH' }>

/** Pure transition detection keeps one-shot SFX/cues out of authoritative Core rules. */
export function getBalloonRallyOneShotCues(
  previous: BalloonRallyPresentationState | null,
  next: BalloonRallyPresentationState,
): readonly BalloonRallyOneShotCue[] {
  if (!previous) return []
  const cues: BalloonRallyOneShotCue[] = []
  const milestone = getComboMilestoneCrossed(previous.combo, next.combo)
  if (milestone) cues.push({ kind: 'COMBO_MILESTONE', milestone })
  if (next.miniEventSequence > previous.miniEventSequence) cues.push({ kind: 'MINI_EVENT_START' })
  if (!previous.partyRush && next.partyRush) cues.push({ kind: 'PARTY_RUSH_START' })
  if (previous.phase === 'PLAYING' && next.phase === 'FINISHED') cues.push({ kind: 'ROUND_FINISH' })
  for (const threshold of [3_000, 2_000, 1_000] as const) {
    if (previous.roundRemainingMs > threshold && next.roundRemainingMs <= threshold && next.roundRemainingMs > 0) {
      cues.push({ kind: 'FINAL_COUNTDOWN', value: (threshold / 1_000) as 3 | 2 | 1 })
    }
  }
  return cues
}

export type BalloonRallyDamageStage = 'NONE' | 'CRACKED' | 'CRACKED_DOUBLE' | 'HEAVILY_CRACKED'

/** Presentation-only damage mapping. One-hit targets intentionally stay clean. */
export function getBalloonRallyDamageStage(
  kind: 'STANDARD' | 'PARTY' | 'GOLDEN' | 'GIANT' | 'BONUS',
  hp: number,
  maxHp: number,
): BalloonRallyDamageStage {
  if (kind === 'STANDARD') return hp < maxHp ? 'CRACKED' : 'NONE'
  if (kind === 'GIANT') {
    if (hp <= 1) return 'HEAVILY_CRACKED'
    if (maxHp >= 4 && hp === 2) return 'CRACKED_DOUBLE'
    if (hp < maxHp) return 'CRACKED'
  }
  return 'NONE'
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
