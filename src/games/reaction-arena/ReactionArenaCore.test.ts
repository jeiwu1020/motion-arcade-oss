import { describe, expect, it } from 'vitest'

import {
  REACTION_ARENA_RULES,
  advanceReactionArena,
  createReactionArenaState,
  type ReactionArenaActionAttempt,
} from './ReactionArenaCore'

function advance(
  state: ReturnType<typeof createReactionArenaState>,
  deltaMs: number,
  actionAttempts: readonly ReactionArenaActionAttempt[] = [],
) {
  return advanceReactionArena(state, { deltaMs, actionAttempts })
}

function startPlaying(seed = 1) {
  let state = createReactionArenaState({ seed })
  state = advance(state, REACTION_ARENA_RULES.countdownMs)
  return state
}

describe('ReactionArenaCore', () => {
  it('uses deterministic cue and special-event choices for the same seed', () => {
    const first = startPlaying(42)
    const second = startPlaying(42)
    expect(first.currentCue?.kind).toBe(second.currentCue?.kind)
    expect(first.specialEvents).toEqual(second.specialEvents)
  })

  it('keeps JUMP out of the v1 cue pool', () => {
    let state = startPlaying(9)
    for (let index = 0; index < 80; index += 1) {
      expect(state.currentCue?.kind).not.toBe('JUMP')
      state = advance(state, 2_000)
      if (state.phase === 'FINISHED') break
    }
  })

  it('accepts matching new actions and grades the response window', () => {
    let state = startPlaying()
    const cue = state.currentCue
    expect(cue).not.toBeNull()
    state = advance(state, 100, [
      { action: cue!.kind, sequence: 1, atMs: cue!.startTimeMs + 100 },
    ])
    expect(state.lastResult?.grade).toBe('PERFECT')
    expect(state.score).toBe(150)
    expect(state.combo).toBe(1)
  })

  it('ignores unrelated actions and expires a cue without negative score', () => {
    let state = startPlaying()
    state = advance(state, 100, [
      { action: 'SQUAT', sequence: 1, atMs: state.elapsedMs + 100 },
    ])
    expect(state.currentCue?.state).toBe('ACTIVE')
    state = advance(state, 2_000)
    expect(state.missedCues).toBe(1)
    expect(state.score).toBe(0)
    expect(state.combo).toBe(0)
    expect(state.lastResult?.state).toBe('EXPIRED')
  })

  it('does not accept an action that occurred before a cue became active', () => {
    const state = startPlaying()
    const cue = state.currentCue!
    const next = advance(state, 0, [
      { action: cue.kind, sequence: 3, atMs: cue.startTimeMs - 1 },
    ])
    expect(next.combo).toBe(0)
    expect(next.currentCue?.state).toBe('ACTIVE')
  })

  it('transitions through the 60 second round and records result statistics', () => {
    const state = advance(startPlaying(), REACTION_ARENA_RULES.roundMs)
    expect(state.phase).toBe('FINISHED')
    expect(state.roundRemainingMs).toBe(0)
    expect(state.presentationEvents.at(-1)?.kind).toBe('ROUND_FINISH')
  })

  it('uses the documented response windows and grade boundaries', () => {
    let state = startPlaying()
    const cue = state.currentCue!
    expect(cue.responseWindowMs).toBe(REACTION_ARENA_RULES.warmUpResponseMs)
    state = advance(state, Math.floor(cue.responseWindowMs * 0.4), [
      { action: cue.kind, sequence: 1, atMs: cue.startTimeMs + Math.floor(cue.responseWindowMs * 0.4) },
    ])
    expect(state.lastResult?.grade).toBe('PERFECT')
  })

  it('adds combo bonus in five-hit steps and caps it at fifty', () => {
    let state = startPlaying()
    let sequence = 1
    for (let index = 0; index < 30; index += 1) {
      const cue = state.currentCue!
      state = advance(state, 1, [
        { action: cue.kind, sequence, atMs: cue.startTimeMs + 1 },
      ])
      sequence += 1
      state = advance(state, REACTION_ARENA_RULES.interCueGapMs)
      if (state.phase === 'FINISHED') break
    }
    expect(state.bestCombo).toBeGreaterThanOrEqual(25)
    expect(state.lastResult?.comboBonus ?? 0).toBeLessThanOrEqual(50)
  })

  it('selects exactly two distinct special events', () => {
    const state = createReactionArenaState({ seed: 17 })
    expect(state.specialEvents).toHaveLength(2)
    expect(new Set(state.specialEvents).size).toBe(2)
  })

  it('emits a one-shot speed-zone event at fifty seconds', () => {
    let state = startPlaying()
    state = advance(state, 50_000 - state.elapsedMs)
    expect(state.speedZone).toBe(true)
    expect(state.presentationEvents.some((event) => event.kind === 'SPEED_ZONE_START')).toBe(true)
    const eventCount = state.presentationEvents.filter((event) => event.kind === 'SPEED_ZONE_START').length
    state = advance(state, 500)
    expect(state.presentationEvents.filter((event) => event.kind === 'SPEED_ZONE_START')).toHaveLength(eventCount)
  })

  it('raises combo milestone events once per five-hit crossing', () => {
    let state = startPlaying()
    let sequence = 1
    for (let index = 0; index < 5; index += 1) {
      const cue = state.currentCue!
      state = advance(state, 1, [{ action: cue.kind, sequence, atMs: cue.startTimeMs + 1 }])
      sequence += 1
      state = advance(state, REACTION_ARENA_RULES.interCueGapMs)
    }
    expect(state.presentationEvents.filter((event) => event.kind === 'COMBO_MILESTONE').at(-1)?.value).toBe(5)
  })
})
