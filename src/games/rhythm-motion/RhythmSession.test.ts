import { describe, expect, it } from 'vitest'

import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import type { MotionInputRequest } from '../../motion/contracts/motion'
import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { RHYTHM_RULES, type RhythmState } from './RhythmCore'
import { RhythmSession } from './RhythmSession'

const REQUEST: MotionInputRequest = Object.freeze({
  players: Object.freeze([{
    playerId: 'player-1',
    abilityProfile: resolveAbilityProfile(['UPPER_BODY']),
  }]),
  actions: Object.freeze([
    'MOVE_LEFT',
    'MOVE_RIGHT',
    'LEAN_LEFT',
    'LEAN_RIGHT',
    'REACH_LEFT',
    'REACH_RIGHT',
  ] as const),
  sensors: Object.freeze({ pose: false, hands: false, audio: false }),
})

const READY = Object.freeze({ setupReady: true, hardFailure: false })
const NOT_READY = Object.freeze({ setupReady: false, hardFailure: false })
const FAILED = Object.freeze({ setupReady: false, hardFailure: true })

class KeyEventForTest extends Event {
  readonly code: string
  readonly repeat: boolean

  constructor(type: 'keydown' | 'keyup', code: string) {
    super(type, { cancelable: true })
    this.code = code
    this.repeat = false
  }
}

async function setup(seed = 17) {
  const keyboard = new EventTarget()
  const provider = new KeyboardMouseTestInputProvider({ keyboardTarget: keyboard })
  await provider.start(REQUEST)
  const session = new RhythmSession(provider, { seed })
  await session.start()
  return { keyboard, provider, session }
}

function startPlaying(session: RhythmSession): void {
  session.tick(RHYTHM_RULES.countdownMs, READY)
  expect(session.getState().phase).toBe('PLAYING')
}

function reachFirstNote(session: RhythmSession): void {
  session.tick(RHYTHM_RULES.visualLeadMs + RHYTHM_RULES.warmUpSpacingMs / 4, READY)
}

function latestNote(state: RhythmState, id: number) {
  return state.notes.find((note) => note.id === id)
}

describe('RhythmSession normalized action bridge', () => {
  it('does not score an action that was already held before session start', async () => {
    const keyboard = new EventTarget()
    const provider = new KeyboardMouseTestInputProvider({ keyboardTarget: keyboard })
    await provider.start(REQUEST)
    provider.triggerAction('player-1', 'MOVE_LEFT')
    const session = new RhythmSession(provider, { seed: 17 })

    await session.start()
    startPlaying(session)
    reachFirstNote(session)
    provider.update(16)
    session.tick(16, READY)

    expect(session.getState().successfulNotes).toBe(0)
  })

  it('consumes only new sequence occurrences once', async () => {
    const { provider, session } = await setup()
    startPlaying(session)
    reachFirstNote(session)

    provider.triggerAction('player-1', 'MOVE_LEFT')
    session.tick(0, READY)
    expect(session.getState().successfulNotes).toBe(1)
    provider.update(16)
    session.tick(16, READY)
    expect(session.getState().successfulNotes).toBe(1)
  })

  it('normalizes MOVE and LEAN sides and keeps reach sides distinct', async () => {
    const leftMove = await setup()
    startPlaying(leftMove.session)
    reachFirstNote(leftMove.session)
    leftMove.provider.triggerAction('player-1', 'MOVE_LEFT')
    leftMove.session.tick(0, READY)
    expect(latestNote(leftMove.session.getState(), 1)?.action).toBe('LEFT')
    expect(latestNote(leftMove.session.getState(), 1)?.resolution).toBe('PERFECT')

    const leftLean = await setup()
    startPlaying(leftLean.session)
    reachFirstNote(leftLean.session)
    leftLean.provider.triggerAction('player-1', 'LEAN_LEFT')
    leftLean.session.tick(0, READY)
    expect(latestNote(leftLean.session.getState(), 1)?.resolution).toBe('PERFECT')

    const rightMove = await setup()
    startPlaying(rightMove.session)
    rightMove.session.tick(3_250, READY)
    rightMove.provider.triggerAction('player-1', 'MOVE_RIGHT')
    rightMove.session.tick(0, READY)
    expect(latestNote(rightMove.session.getState(), 2)?.action).toBe('RIGHT')
    expect(latestNote(rightMove.session.getState(), 2)?.resolution).toBe('PERFECT')

    const reaches = await setup()
    startPlaying(reaches.session)
    reaches.session.tick(4_250, READY)
    reaches.provider.triggerAction('player-1', 'REACH_LEFT')
    reaches.session.tick(0, READY)
    reaches.session.tick(1_000, READY)
    reaches.provider.triggerAction('player-1', 'REACH_RIGHT')
    reaches.session.tick(0, READY)
    expect(latestNote(reaches.session.getState(), 3)?.resolution).toBe('PERFECT')
    expect(latestNote(reaches.session.getState(), 4)?.resolution).toBe('PERFECT')
  })

  it('pauses countdown and chart time while not ready and consumes actions during recovery', async () => {
    const { provider, session } = await setup()
    session.tick(500, NOT_READY)
    expect(session.getState().countdownRemainingMs).toBe(RHYTHM_RULES.countdownMs)
    session.tick(500, READY)
    expect(session.getState().countdownRemainingMs).toBe(2_500)
    session.tick(2_500, READY)
    expect(session.getState().phase).toBe('PLAYING')
    session.tick(2_250, READY)
    const elapsedBeforeLoss = session.getState().elapsedMs
    provider.triggerAction('player-1', 'MOVE_LEFT')
    session.tick(800, NOT_READY)
    expect(session.getState().elapsedMs).toBe(elapsedBeforeLoss)
    session.tick(200, READY)
    expect(session.getState().elapsedMs).toBe(elapsedBeforeLoss + 200)
    expect(session.getState().successfulNotes).toBe(0)
  })

  it('does not advance Core on hard failure and consumes current sequences on replay', async () => {
    const { provider, session } = await setup()
    session.tick(1_000, FAILED)
    expect(session.getState().countdownRemainingMs).toBe(RHYTHM_RULES.countdownMs)

    startPlaying(session)
    provider.triggerAction('player-1', 'MOVE_LEFT')
    session.replay()
    startPlaying(session)
    reachFirstNote(session)
    provider.update(16)
    session.tick(16, READY)
    expect(session.getState().successfulNotes).toBe(0)
  })

  it('drives all four game actions through the developer keyboard provider', async () => {
    const { keyboard, provider, session } = await setup()
    startPlaying(session)

    keyboard.dispatchEvent(new KeyEventForTest('keydown', 'KeyA'))
    session.tick(0, READY)
    keyboard.dispatchEvent(new KeyEventForTest('keyup', 'KeyA'))
    keyboard.dispatchEvent(new KeyEventForTest('keydown', 'KeyD'))
    session.tick(0, READY)
    keyboard.dispatchEvent(new KeyEventForTest('keyup', 'KeyD'))
    provider.triggerAction('player-1', 'REACH_LEFT')
    session.tick(0, READY)
    provider.triggerAction('player-1', 'REACH_RIGHT')
    session.tick(0, READY)

    expect(session.getState().lastResult).toBeNull()
    expect(session.getState().phase).toBe('PLAYING')
  })
})
