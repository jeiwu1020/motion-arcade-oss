import type {
  ReactionArenaCueKind,
  ReactionArenaGrade,
  ReactionArenaGameplayPhase,
  ReactionArenaPhase,
} from './ReactionArenaCore'

export type ReactionArenaCueVisualFamily = 'SIDE_GATE' | 'REACH_TARGET' | 'DUCK_BARRIER'

export interface ReactionArenaCueVisual {
  readonly family: ReactionArenaCueVisualFamily
  readonly direction: 'LEFT' | 'RIGHT' | null
  readonly label: string
  readonly prompt: string
}

export interface ReactionArenaPresentationState {
  readonly phase: ReactionArenaPhase
  readonly gameplayPhase?: ReactionArenaGameplayPhase
  readonly speedZone: boolean
  readonly combo: number
  readonly elapsedMs: number
}

export type ReactionArenaOneShotEvent =
  | Readonly<{ kind: 'SPEED_ZONE_START' }>
  | Readonly<{ kind: 'COMBO_MILESTONE'; value: number }>
  | Readonly<{ kind: 'ROUND_FINISH' }>

const VISUALS: Readonly<Record<ReactionArenaCueKind, ReactionArenaCueVisual>> = Object.freeze({
  LEFT: { family: 'SIDE_GATE', direction: 'LEFT', label: 'LEFT', prompt: '向左移動' },
  RIGHT: { family: 'SIDE_GATE', direction: 'RIGHT', label: 'RIGHT', prompt: '向右移動' },
  REACH_LEFT: { family: 'REACH_TARGET', direction: 'LEFT', label: 'REACH LEFT', prompt: '伸出左手' },
  REACH_RIGHT: { family: 'REACH_TARGET', direction: 'RIGHT', label: 'REACH RIGHT', prompt: '伸出右手' },
  SQUAT: { family: 'DUCK_BARRIER', direction: null, label: 'SQUAT', prompt: '蹲下閃過' },
})

export function getReactionArenaCueVisual(kind: ReactionArenaCueKind): ReactionArenaCueVisual {
  return VISUALS[kind]
}

export function getReactionArenaGradeLabel(grade: ReactionArenaGrade): string {
  return grade
}

export function getReactionArenaOneShotEvents(
  previous: ReactionArenaPresentationState,
  next: ReactionArenaPresentationState,
): readonly ReactionArenaOneShotEvent[] {
  const events: ReactionArenaOneShotEvent[] = []
  if (!previous.speedZone && next.speedZone) events.push({ kind: 'SPEED_ZONE_START' })
  const previousBucket = Math.floor(Math.max(0, previous.combo) / 5)
  const nextBucket = Math.floor(Math.max(0, next.combo) / 5)
  if (nextBucket > previousBucket && nextBucket > 0) {
    events.push({ kind: 'COMBO_MILESTONE', value: nextBucket * 5 })
  }
  if (previous.phase === 'PLAYING' && next.phase === 'FINISHED') events.push({ kind: 'ROUND_FINISH' })
  return events
}
