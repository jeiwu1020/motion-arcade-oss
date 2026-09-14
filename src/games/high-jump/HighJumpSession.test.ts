import { describe, expect, it } from 'vitest'

import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import type { MotionInputRequest } from '../../motion/contracts/motion'
import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { HIGH_JUMP_RULES } from './HighJumpCore'
import { HighJumpSession } from './HighJumpSession'

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
  provider: KeyboardMouseTestInputProvider
  session: HighJumpSession
}> {
  const provider = new KeyboardMouseTestInputProvider({ keyboardTarget: new EventTarget() })
  await provider.start(REQUEST)
  const session = new HighJumpSession(provider)
  await session.start()
  return { provider, session }
}

function enterApproach(session: HighJumpSession): void {
  session.tick(HIGH_JUMP_RULES.countdownMs + HIGH_JUMP_RULES.readyMs, READY)
  expect(session.getState().phase).toBe('APPROACH')
}

describe('HighJumpSession retained JUMP safety', () => {
  it('marks a pre-existing retained JUMP on start and does not replay it', async () => {
    const provider = new KeyboardMouseTestInputProvider({ keyboardTarget: new EventTarget() })
    await provider.start(REQUEST)
    provider.triggerAction('player-1', 'JUMP')
    const session = new HighJumpSession(provider)

    await session.start()
    enterApproach(session)
    session.tick(0, READY)

    expect(session.getState().phase).toBe('APPROACH')
    expect(session.getState().lastAttempt).toBeNull()
  })

  it('consumes a fresh JUMP once and ignores the retained occurrence afterward', async () => {
    const { provider, session } = await setup()
    enterApproach(session)

    provider.triggerAction('player-1', 'JUMP')
    session.tick(0, READY)
    const afterJump = session.getState()
    session.tick(0, READY)

    expect(afterJump.phase).toBe('TAKEOFF')
    expect(session.getState()).toMatchObject({ phase: 'TAKEOFF', score: afterJump.score })
    expect(session.getState().lastAttempt).toEqual(afterJump.lastAttempt)
  })

  it('consumes events while unready without advancing or replaying after recovery', async () => {
    const { provider, session } = await setup()

    session.tick(900, NOT_READY)
    provider.triggerAction('player-1', 'JUMP')
    session.tick(0, NOT_READY)
    session.tick(3_700, READY)

    expect(session.getState().phase).toBe('APPROACH')
    expect(session.getState().elapsedMs).toBe(HIGH_JUMP_RULES.readyMs)
    expect(session.getState().lastAttempt).toBeNull()
  })

  it('consumes a JUMP outside APPROACH and only a fresh later JUMP resolves the attempt', async () => {
    const { provider, session } = await setup()
    session.tick(HIGH_JUMP_RULES.countdownMs, READY)
    expect(session.getState().phase).toBe('READY_FOR_ATTEMPT')

    provider.triggerAction('player-1', 'JUMP')
    session.tick(0, READY)
    session.tick(HIGH_JUMP_RULES.readyMs, READY)
    expect(session.getState().phase).toBe('APPROACH')

    provider.update(400)
    provider.update(16)
    provider.triggerAction('player-1', 'JUMP')
    session.tick(0, READY)
    expect(session.getState().phase).toBe('TAKEOFF')
  })

  it('marks the retained sequence on replay and pauses on hard failure', async () => {
    const { provider, session } = await setup()
    enterApproach(session)
    provider.triggerAction('player-1', 'JUMP')
    session.replay()
    enterApproach(session)
    session.tick(0, READY)
    expect(session.getState().phase).toBe('APPROACH')

    const beforeFailure = session.getState()
    session.tick(1_000, FAILED)
    expect(session.getState()).toBe(beforeFailure)
  })

  it('allows a fresh post-recovery JUMP and uses occurrence only, not action value', async () => {
    const { provider, session } = await setup()
    enterApproach(session)
    session.tick(250, NOT_READY)
    provider.triggerAction('player-1', 'JUMP')
    session.tick(0, NOT_READY)
    session.tick(250, READY)
    expect(session.getState().phase).toBe('APPROACH')

    provider.update(400)
    provider.update(16)
    provider.triggerAction('player-1', 'JUMP')
    session.tick(0, READY)
    expect(session.getState().phase).toBe('TAKEOFF')
    expect(session.getState().lastAttempt?.takeoffValue).toBeGreaterThan(0)
  })
})
