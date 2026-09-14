import { describe, expect, it } from 'vitest'

import { LocomotionTestProvider } from '../../motion/locomotion/LocomotionTestProvider'
import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import type { MotionInputRequest } from '../../motion/contracts/motion'
import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { LONG_JUMP_RULES } from './LongJumpCore'
import { LongJumpSession } from './LongJumpSession'

const REQUEST: MotionInputRequest = Object.freeze({
  players: Object.freeze([{
    playerId: 'player-1',
    abilityProfile: resolveAbilityProfile(['STANDARD']),
  }]),
  actions: Object.freeze(['JUMP'] as const),
  sensors: Object.freeze({ pose: false, hands: false, audio: false }),
})

const READY = Object.freeze({ setupReady: true, hardFailure: false })
const NOT_READY = Object.freeze({ setupReady: false, hardFailure: false })
const FAILED = Object.freeze({ setupReady: false, hardFailure: true })

async function setup(): Promise<{
  locomotion: LocomotionTestProvider
  motion: KeyboardMouseTestInputProvider
  session: LongJumpSession
}> {
  const locomotion = new LocomotionTestProvider()
  const motion = new KeyboardMouseTestInputProvider({ keyboardTarget: new EventTarget() })
  await motion.start(REQUEST)
  const session = new LongJumpSession(locomotion, motion)
  await session.start()
  return { locomotion, motion, session }
}

function enterCharge(session: LongJumpSession): void {
  session.tick(LONG_JUMP_RULES.countdownMs + LONG_JUMP_RULES.attemptReadyMs, READY)
  expect(session.getState().phase).toBe('CHARGE')
}

function enterTakeoffWindow(session: LongJumpSession): void {
  enterCharge(session)
  session.tick(LONG_JUMP_RULES.chargeMs, READY)
  expect(session.getState().phase).toBe('TAKEOFF_WINDOW')
}

function retrigger(motion: KeyboardMouseTestInputProvider): void {
  motion.update(400)
  motion.update(16)
  motion.triggerAction('player-1', 'JUMP')
}

describe('LongJumpSession retained dual-input safety', () => {
  it('marks retained locomotion and JUMP occurrences before start', async () => {
    const locomotion = new LocomotionTestProvider()
    locomotion.triggerStep('LEFT', { timestampMs: 100 })
    const motion = new KeyboardMouseTestInputProvider({ keyboardTarget: new EventTarget() })
    await motion.start(REQUEST)
    motion.triggerAction('player-1', 'JUMP')
    const session = new LongJumpSession(locomotion, motion)
    await session.start()

    enterTakeoffWindow(session)
    session.tick(0, READY)
    expect(session.getState().detectedGameSteps).toBe(0)
    expect(session.getState().lastAttempt).toBeNull()
  })

  it('consumes fresh alternating steps once and uses normalized intensity for charge', async () => {
    const { locomotion, motion, session } = await setup()
    enterCharge(session)

    locomotion.triggerStep('LEFT', { timestampMs: 100 })
    session.tick(0, READY)
    locomotion.triggerStep('RIGHT', { timestampMs: 500 })
    session.tick(0, READY)
    const afterSteps = session.getState()
    session.tick(1_000, READY)

    expect(afterSteps.detectedGameSteps).toBe(2)
    expect(session.getState().detectedGameSteps).toBe(2)
    expect(session.getState().charge).toBeGreaterThan(0)
    expect(session.getState().charge).toBeLessThanOrEqual(1)
    expect(session.getState().chargeElapsedMs).toBe(1_000)
    void motion
  })

  it('does not replay a retained JUMP and ignores JUMP outside TAKEOFF_WINDOW', async () => {
    const { motion, session } = await setup()
    enterCharge(session)
    motion.triggerAction('player-1', 'JUMP')
    session.tick(0, READY)
    expect(session.getState().phase).toBe('CHARGE')

    retrigger(motion)
    session.tick(0, READY)
    session.tick(LONG_JUMP_RULES.chargeMs, READY)
    session.tick(0, READY)
    expect(session.getState().lastAttempt).toBeNull()
  })

  it('consumes JUMP and steps while unready without advancing or replaying after recovery', async () => {
    const { locomotion, motion, session } = await setup()
    enterTakeoffWindow(session)
    const before = session.getState()
    locomotion.triggerStep('LEFT', { timestampMs: 100 })
    motion.triggerAction('player-1', 'JUMP')
    session.tick(1_000, NOT_READY)
    expect(session.getState()).toBe(before)
    session.tick(0, READY)
    expect(session.getState().lastAttempt).toBeNull()
    expect(session.getState().detectedGameSteps).toBe(0)
  })

  it('pauses on hard failure, then accepts one fresh JUMP after recovery', async () => {
    const { motion, session } = await setup()
    enterTakeoffWindow(session)
    const before = session.getState()
    session.tick(500, FAILED)
    expect(session.getState()).toBe(before)

    session.tick(500, READY)
    expect(session.getState().takeoffElapsedMs).toBe(500)
    retrigger(motion)
    session.tick(0, READY)
    const afterJump = session.getState()
    session.tick(0, READY)
    expect(afterJump.phase).toBe('FLIGHT')
    expect(session.getState()).toEqual(afterJump)
  })
})
