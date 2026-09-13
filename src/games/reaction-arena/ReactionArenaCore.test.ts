import { describe, expect, it } from 'vitest'

import {
  REACTION_ARENA_RULES,
  advanceReactionArena,
  createReactionArenaState,
  hasReactionArenaCountdownStarted,
  replayReactionArena,
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

function seekToPatternPhase(
  phase: 'COMBO_CHAIN' | 'SPEED_ZONE' | 'SPECIAL_EVENT_1' | 'SPECIAL_EVENT_2',
  seed = 1,
) {
  const phaseStartMs = phase === 'COMBO_CHAIN'
    ? REACTION_ARENA_RULES.specialEventOneEndMs
    : phase === 'SPEED_ZONE'
      ? REACTION_ARENA_RULES.speedZoneStartMs
      : phase === 'SPECIAL_EVENT_1'
        ? REACTION_ARENA_RULES.reactionRallyEndMs
        : REACTION_ARENA_RULES.comboChainEndMs
  let state = startPlaying(seed)
  state = advance(state, phaseStartMs - state.elapsedMs)
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (
      state.gameplayPhase === phase &&
      state.currentCue &&
      state.currentCue.startTimeMs >= phaseStartMs
    ) {
      return state
    }
    state = advance(state, 100)
  }
  return state
}

function resolveCurrentCue(
  state: ReturnType<typeof createReactionArenaState>,
  sequence: number,
) {
  const cue = state.currentCue
  expect(cue).not.toBeNull()
  const resolved = advance(state, 1, [
    { action: cue!.kind, sequence, atMs: state.elapsedMs + 1 },
  ])
  return advance(resolved, REACTION_ARENA_RULES.interCueGapMs)
}

describe('ReactionArenaCore', () => {
  it('recognizes that visible countdown starts only after the initial state advances', () => {
    expect(hasReactionArenaCountdownStarted(REACTION_ARENA_RULES.countdownMs)).toBe(false)
    expect(hasReactionArenaCountdownStarted(REACTION_ARENA_RULES.countdownMs - 1)).toBe(true)
  })

  it('keeps one COMBO_CHAIN pattern in order before selecting the next chain', () => {
    const patterns = [
      ['LEFT', 'REACH_RIGHT'],
      ['RIGHT', 'REACH_LEFT'],
      ['SQUAT', 'REACH_LEFT'],
      ['REACH_RIGHT', 'LEFT'],
    ]
    let state = seekToPatternPhase('COMBO_CHAIN', 7)
    const first = state.currentCue!.kind
    const expected = patterns.find((pattern) => pattern[0] === first)!
    state = resolveCurrentCue(state, 1)
    const second = state.currentCue!.kind
    expect([first, second]).toEqual(expected)

    state = resolveCurrentCue(state, 2)
    const nextChainFirst = state.currentCue!.kind
    expect(patterns.map((pattern) => pattern[0])).toContain(nextChainFirst)
  })

  it('advances to the next COMBO_CHAIN step after an expiry without rerolling', () => {
    const patterns = [
      ['LEFT', 'REACH_RIGHT'],
      ['RIGHT', 'REACH_LEFT'],
      ['SQUAT', 'REACH_LEFT'],
      ['REACH_RIGHT', 'LEFT'],
    ]
    const state = seekToPatternPhase('COMBO_CHAIN', 29)
    const first = state.currentCue!
    const expected = patterns.find((pattern) => pattern[0] === first.kind)!
    const next = advance(
      state,
      first.responseWindowMs + REACTION_ARENA_RULES.interCueGapMs,
    )
    expect(next.lastResult?.state).toBe('EXPIRED')
    expect(next.currentCue?.kind).toBe(expected[1])
  })

  it('keeps one SPEED_ZONE pattern in order and starts a fresh pattern after completion', () => {
    const patterns = [
      ['LEFT', 'REACH_RIGHT', 'RIGHT'],
      ['SQUAT', 'REACH_LEFT'],
      ['RIGHT', 'LEFT', 'REACH_RIGHT'],
      ['REACH_LEFT', 'RIGHT'],
    ]
    let state = seekToPatternPhase('SPEED_ZONE', 11)
    const selected: string[] = []
    const expected = patterns.find((pattern) => pattern[0] === state.currentCue!.kind)!
    for (let index = 0; index < expected.length; index += 1) {
      selected.push(state.currentCue!.kind)
      state = resolveCurrentCue(state, index + 1)
    }
    expect(selected).toEqual(expected)

    const completed = resolveCurrentCue(state, 10)
    expect(patterns.map((pattern) => pattern[0])).toContain(completed.currentCue!.kind)
  })

  it('restarts a fixed special-event pattern instead of clamping on its final cue', () => {
    const patterns: Record<string, string[]> = {
      REACH_BURST: ['REACH_LEFT', 'REACH_RIGHT', 'REACH_RIGHT', 'REACH_LEFT', 'REACH_LEFT', 'REACH_RIGHT'],
      SIDE_DASH: ['LEFT', 'RIGHT', 'LEFT', 'RIGHT', 'RIGHT', 'LEFT'],
      DUCK_AND_STRIKE: ['SQUAT', 'REACH_LEFT', 'REACH_RIGHT', 'SQUAT', 'REACH_RIGHT'],
    }
    let state = seekToPatternPhase('SPECIAL_EVENT_1', 13)
    const event = state.currentCue!.event!
    const observed: string[] = []
    const expected = patterns[event]!
    for (let index = 0; index < expected.length + 1; index += 1) {
      observed.push(state.currentCue!.kind)
      state = resolveCurrentCue(state, index + 1)
    }
    expect(observed.slice(0, expected.length)).toEqual(expected)
    expect(observed.at(-1)).toBe(expected[0])
  })

  it('leaves a cue-free transition gap from 49 to 50 seconds before SPEED_ZONE', () => {
    let state = seekToPatternPhase('SPECIAL_EVENT_2', 19)
    state = advance(state, REACTION_ARENA_RULES.specialEventTwoEndMs - state.elapsedMs)
    expect(state.elapsedMs).toBe(REACTION_ARENA_RULES.specialEventTwoEndMs)
    expect(state.currentCue?.event ?? null).toBeNull()

    state = advance(state, 500)
    expect(state.elapsedMs).toBe(REACTION_ARENA_RULES.specialEventTwoEndMs + 500)
    expect(state.currentCue?.event ?? null).toBeNull()

    state = advance(state, 500)
    expect(state.elapsedMs).toBe(REACTION_ARENA_RULES.speedZoneStartMs)
    expect(state.gameplayPhase).toBe('SPEED_ZONE')
  })

  it('replays the same deterministic chain choices from the original seed', () => {
    const collect = (initial: ReturnType<typeof createReactionArenaState>) => {
      let state = initial
      const kinds: string[] = []
      for (let index = 0; index < 4; index += 1) {
        kinds.push(state.currentCue!.kind)
        state = resolveCurrentCue(state, index + 1)
      }
      return kinds
    }
    const state = seekToPatternPhase('SPEED_ZONE', 23)
    const replayed = seekToPatternPhase('SPEED_ZONE', 23)
    expect(collect(state)).toEqual(collect(replayed))
    expect(replayReactionArena(state).specialEvents).toEqual(
      createReactionArenaState({ seed: state.initialSeed }).specialEvents,
    )
  })

  it('accumulates countdown time across repeated small frames', () => {
    let state = createReactionArenaState({ seed: 42 })

    for (let elapsedMs = 100; elapsedMs <= 2_000; elapsedMs += 100) {
      state = advance(state, 100)
      if (elapsedMs === 100 || elapsedMs === 1_000 || elapsedMs === 2_000) {
        expect(state.countdownRemainingMs).toBe(REACTION_ARENA_RULES.countdownMs - elapsedMs)
      }
    }

    state = advance(state, 1_000)
    expect(state.phase).toBe('PLAYING')
    expect(state.countdownRemainingMs).toBe(0)
  })

  it('transitions from countdown with realistic repeated 16/17 ms frames', () => {
    let state = createReactionArenaState()
    let elapsedMs = 0
    let frameIndex = 0
    while (state.phase === 'COUNTDOWN' && elapsedMs < 4_000) {
      const deltaMs = frameIndex % 2 === 0 ? 16 : 17
      state = advance(state, deltaMs)
      elapsedMs += deltaMs
      frameIndex += 1
    }

    expect(state.phase).toBe('PLAYING')
    expect(state.countdownRemainingMs).toBe(0)
  })

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
