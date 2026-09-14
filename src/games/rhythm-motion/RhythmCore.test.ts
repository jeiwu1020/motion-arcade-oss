import { describe, expect, it } from 'vitest'

import {
  RHYTHM_RULES,
  advanceRhythm,
  createRhythmState,
  replayRhythm,
  rhythmNoteSpacingAt,
  type RhythmNote,
  type RhythmState,
} from './RhythmCore'

function startPlaying(seed = 17): RhythmState {
  return advanceRhythm(createRhythmState({ seed }), {
    deltaMs: RHYTHM_RULES.countdownMs,
  })
}

function withNotes(state: RhythmState, notes: readonly RhythmNote[]): RhythmState {
  return {
    ...state,
    notes: Object.freeze(notes.map((note) => Object.freeze({ ...note }))),
    nextNoteIndex: 0,
    lastResult: null,
  }
}

function note(
  id: number,
  action: RhythmNote['action'],
  targetTimeMs: number,
): RhythmNote {
  return Object.freeze({ id, action, targetTimeMs, resolution: 'PENDING' })
}

function attempt(action: RhythmNote['action'], atMs?: number) {
  return atMs === undefined ? { action } : { action, atMs }
}

function advanceTo(state: RhythmState, elapsedMs: number): RhythmState {
  return advanceRhythm(state, { deltaMs: elapsedMs - state.elapsedMs })
}

describe('RhythmCore countdown and lifecycle', () => {
  it('starts a three-second countdown with a deterministic chart', () => {
    const state = createRhythmState({ seed: 123 })

    expect(state).toMatchObject({
      phase: 'COUNTDOWN',
      rhythmPhase: 'WARM_UP',
      countdownRemainingMs: 3_000,
      roundRemainingMs: 60_000,
      elapsedMs: 0,
      score: 0,
      currentCombo: 0,
    })
    expect(state.notes.length).toBeGreaterThan(4)
  })

  it('progresses countdown through repeated small frames', () => {
    let state = createRhythmState({ seed: 123 })
    for (let index = 0; index < 60; index += 1) {
      state = advanceRhythm(state, { deltaMs: 50 })
    }

    expect(state.phase).toBe('PLAYING')
    expect(state.countdownRemainingMs).toBe(0)
    expect(state.elapsedMs).toBe(0)
    expect(state.roundRemainingMs).toBe(60_000)
  })

  it('transitions at 15, 35, and 50 seconds and finishes exactly at 60 seconds', () => {
    let state = startPlaying()
    state = advanceRhythm(state, { deltaMs: 15_000 })
    expect(state.rhythmPhase).toBe('GROOVE')
    state = advanceRhythm(state, { deltaMs: 20_000 })
    expect(state.rhythmPhase).toBe('ENERGY')
    state = advanceRhythm(state, { deltaMs: 15_000 })
    expect(state.rhythmPhase).toBe('FINAL_BEAT')
    expect(state.presentationEvents).toContainEqual({ kind: 'FINAL_BEAT_START', sequence: 1 })
    state = advanceRhythm(state, { deltaMs: 9_999 })
    expect(state.phase).toBe('PLAYING')
    state = advanceRhythm(state, { deltaMs: 1 })
    expect(state.phase).toBe('FINISHED')
    expect(state.elapsedMs).toBe(60_000)
    expect(state.roundRemainingMs).toBe(0)
  })

  it('keeps finished results stable and marks unresolved notes as misses', () => {
    let state = withNotes(startPlaying(), [note(1, 'LEFT', 100)])
    state = advanceRhythm(state, { deltaMs: 451 })
    expect(state.notes[0]?.resolution).toBe('MISS')
    expect(state.missedNotes).toBe(1)
    const finished = advanceTo(state, 60_000)

    expect(finished.phase).toBe('FINISHED')
    expect(advanceRhythm(finished, { deltaMs: 5_000, actionAttempts: [attempt('RIGHT')] }))
      .toEqual(finished)
  })
})

describe('RhythmCore deterministic chart and fairness', () => {
  it('generates and replays the same chart for the same seed', () => {
    const first = createRhythmState({ seed: 0x51a })
    const second = createRhythmState({ seed: 0x51a })

    expect(first.notes).toEqual(second.notes)
    expect(replayRhythm(first).notes).toEqual(first.notes)
    expect(replayRhythm(first).randomState).toBe(first.randomState)
  })

  it('teaches LEFT, RIGHT, REACH_LEFT, and REACH_RIGHT in warm-up', () => {
    const state = createRhythmState({ seed: 4 })
    expect(state.notes.slice(0, 4).map(({ action }) => action)).toEqual([
      'LEFT',
      'RIGHT',
      'REACH_LEFT',
      'REACH_RIGHT',
    ])
  })

  it('keeps chart notes spaced, non-simultaneous, and inside the round', () => {
    const notes = createRhythmState({ seed: 99 }).notes
    expect(notes.every(({ targetTimeMs }) => targetTimeMs > 0 && targetTimeMs < RHYTHM_RULES.roundMs)).toBe(true)
    for (let index = 1; index < notes.length; index += 1) {
      const gap = notes[index]!.targetTimeMs - notes[index - 1]!.targetTimeMs
      expect(gap).toBeGreaterThanOrEqual(RHYTHM_RULES.minimumNoteSpacingMs)
      expect(notes[index]!.targetTimeMs).not.toBe(notes[index - 1]!.targetTimeMs)
      expect(notes[index]!.action).not.toBe(notes[index - 1]!.action)
    }
  })

  it('uses the requested phase spacing floors and never exceeds two same-side actions', () => {
    const notes = createRhythmState({ seed: 77 }).notes
    const side = (action: RhythmNote['action']) =>
      action === 'LEFT' || action === 'REACH_LEFT' ? 'LEFT' : 'RIGHT'
    let sameSideRun = 1
    for (let index = 1; index < notes.length; index += 1) {
      const previous = notes[index - 1]!
      const current = notes[index]!
      const gap = current.targetTimeMs - previous.targetTimeMs
      const floor = rhythmNoteSpacingAt(previous.targetTimeMs)
      expect(gap).toBeGreaterThanOrEqual(floor)
      sameSideRun = side(current.action) === side(previous.action) ? sameSideRun + 1 : 1
      expect(sameSideRun).toBeLessThanOrEqual(2)
    }
  })
})

describe('RhythmCore judgement and note matching', () => {
  it.each([
    ['PERFECT', 0],
    ['PERFECT', -120],
    ['PERFECT', 120],
    ['GREAT', -121],
    ['GREAT', 230],
    ['GOOD', -231],
    ['GOOD', 350],
  ] as const)('classifies offset %s at %dms boundary', (resolution, offset) => {
    const base = advanceTo(withNotes(startPlaying(), [note(1, 'LEFT', 5_000)]), 5_000)
    const state = advanceRhythm(base, {
      deltaMs: 0,
      actionAttempts: [attempt('LEFT', 5_000 + offset)],
    })

    expect(state.lastResult?.resolution).toBe(resolution)
    expect(state.notes[0]?.resolution).toBe(resolution)
  })

  it('rejects offsets outside the symmetric GOOD window as misses once late edge passes', () => {
    const base = advanceTo(withNotes(startPlaying(), [note(1, 'LEFT', 5_000)]), 5_000)
    const early = advanceRhythm(base, { deltaMs: 0, actionAttempts: [attempt('LEFT', 4_649)] })
    expect(early.notes[0]?.resolution).toBe('PENDING')

    const late = advanceRhythm(base, { deltaMs: 0, actionAttempts: [attempt('LEFT', 5_351)] })
    expect(late.notes[0]?.resolution).toBe('PENDING')
    const expired = advanceTo(late, 5_351)
    expect(expired.notes[0]?.resolution).toBe('MISS')
  })

  it('does not resolve a note for a wrong action', () => {
    const base = advanceTo(withNotes(startPlaying(), [note(1, 'LEFT', 5_000)]), 5_000)
    const state = advanceRhythm(base, { deltaMs: 0, actionAttempts: [attempt('RIGHT', 5_000)] })
    expect(state.notes[0]?.resolution).toBe('PENDING')
    expect(state.successfulNotes).toBe(0)
  })

  it('resolves one nearest matching note per occurrence', () => {
    const base = advanceTo(withNotes(startPlaying(), [
      note(1, 'LEFT', 5_000),
      note(2, 'LEFT', 5_400),
    ]), 5_300)
    const state = advanceRhythm(base, { deltaMs: 0, actionAttempts: [attempt('LEFT', 5_300)] })

    expect(state.notes.map(({ resolution }) => resolution)).toEqual(['PENDING', 'PERFECT'])
    expect(state.successfulNotes).toBe(1)
  })

  it('records early, late, exact, and mean absolute offsets for successful notes', () => {
    let state = withNotes(startPlaying(), [
      note(1, 'LEFT', 5_000),
      note(2, 'RIGHT', 6_000),
      note(3, 'REACH_LEFT', 7_000),
    ])
    state = advanceTo(state, 5_000)
    state = advanceRhythm(state, { deltaMs: 0, actionAttempts: [attempt('LEFT', 4_900)] })
    state = advanceTo(state, 6_000)
    state = advanceRhythm(state, { deltaMs: 0, actionAttempts: [attempt('RIGHT', 6_000)] })
    state = advanceTo(state, 7_000)
    state = advanceRhythm(state, { deltaMs: 0, actionAttempts: [attempt('REACH_LEFT', 7_200)] })

    expect(state).toMatchObject({
      earlyHitCount: 1,
      lateHitCount: 1,
      hitOffsetsMs: [-100, 0, 200],
      meanAbsoluteHitOffsetMs: 100,
      successfulNotes: 3,
    })
  })
})

describe('RhythmCore scoring and combo', () => {
  it('awards PERFECT/GREAT/GOOD values and combo tier bonuses', () => {
    const actions: RhythmNote['action'][] = ['LEFT', 'RIGHT', 'REACH_LEFT', 'REACH_RIGHT', 'LEFT', 'RIGHT', 'REACH_LEFT']
    let state = withNotes(startPlaying(), actions.map((action, index) => note(index + 1, action, (index + 1) * 1_000)))

    for (let index = 0; index < actions.length; index += 1) {
      const target = (index + 1) * 1_000
      state = advanceTo(state, target)
      state = advanceRhythm(state, {
        deltaMs: 0,
        actionAttempts: [attempt(actions[index]!, target + (index === 1 ? 200 : 0))],
      })
    }

    expect(state.score).toBe(1_050)
    expect(state.currentCombo).toBe(7)
    expect(state.bestCombo).toBe(7)
    expect(state.perfectCount).toBe(6)
    expect(state.greatCount).toBe(1)
  })

  it('resets combo on a miss without subtracting score and preserves best combo', () => {
    let state = withNotes(startPlaying(), [
      note(1, 'LEFT', 1_000),
      note(2, 'RIGHT', 2_000),
      note(3, 'REACH_LEFT', 3_000),
    ])
    state = advanceTo(state, 1_000)
    state = advanceRhythm(state, { deltaMs: 0, actionAttempts: [attempt('LEFT', 1_000)] })
    state = advanceTo(state, 2_351)
    expect(state.currentCombo).toBe(0)
    expect(state.score).toBe(150)
    state = advanceTo(state, 3_000)
    state = advanceRhythm(state, { deltaMs: 0, actionAttempts: [attempt('REACH_LEFT', 3_000)] })

    expect(state).toMatchObject({
      score: 300,
      missedNotes: 1,
      currentCombo: 1,
      bestCombo: 1,
    })
  })
})
