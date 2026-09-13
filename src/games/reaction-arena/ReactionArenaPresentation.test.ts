import { describe, expect, it } from 'vitest'

import {
  getReactionArenaCueVisual,
  getReactionArenaOneShotEvents,
  getReactionArenaPracticeActionLabel,
  getReactionArenaSuccessVisual,
  type ReactionArenaPresentationState,
} from './ReactionArenaPresentation'

const base = (overrides: Partial<ReactionArenaPresentationState> = {}): ReactionArenaPresentationState => ({
  phase: 'PLAYING',
  speedZone: false,
  combo: 0,
  elapsedMs: 1_000,
  ...overrides,
})

describe('ReactionArenaPresentation', () => {
  it('maps action cues to distinct readable visual families', () => {
    expect(getReactionArenaCueVisual('LEFT').family).toBe('SIDE_GATE')
    expect(getReactionArenaCueVisual('RIGHT').direction).toBe('RIGHT')
    expect(getReactionArenaCueVisual('REACH_LEFT').family).toBe('REACH_TARGET')
    expect(getReactionArenaCueVisual('SQUAT').family).toBe('DUCK_BARRIER')
  })

  it('emits speed-zone and combo milestone events only on transitions', () => {
    const first = getReactionArenaOneShotEvents(base(), base({ speedZone: true, elapsedMs: 50_000 }))
    expect(first.some((event) => event.kind === 'SPEED_ZONE_START')).toBe(true)
    expect(getReactionArenaOneShotEvents(base({ speedZone: true }), base({ speedZone: true }))).toEqual([])
    expect(getReactionArenaOneShotEvents(base(), base({ combo: 5 }))).toEqual([
      { kind: 'COMBO_MILESTONE', value: 5 },
    ])
  })

  it('provides readable practice labels and strong success feedback semantics', () => {
    expect(getReactionArenaPracticeActionLabel('REACH_LEFT')).toBe('左手伸出')
    expect(getReactionArenaPracticeActionLabel('SQUAT')).toBe('蹲下')
    expect(getReactionArenaSuccessVisual('GREAT')).toEqual({ mark: '✓', grade: 'GREAT', durationMs: 800 })
  })
})
