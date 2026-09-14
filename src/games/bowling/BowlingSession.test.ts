import { describe, expect, it } from 'vitest'
import { SportsMotionTestProvider } from '../../motion/sports/SportsMotionTestProvider'
import { BOWLING_RULES } from './BowlingCore'
import { BowlingSession } from './BowlingSession'

function readySession(provider: SportsMotionTestProvider, seed = 1): BowlingSession {
  const session = new BowlingSession(provider, { seed })
  return session
}

const swingOptions = (overrides: Partial<{ timestampMs: number; vectorX: number; vectorY: number; intensity: number }> = {}) => ({
  timestampMs: 0,
  vectorX: 0,
  vectorY: 0,
  intensity: 0.75,
  ...overrides,
})

describe('BowlingSession', () => {
  it('ignores retained pre-existing left/right events at start and replay', async () => {
    const provider = new SportsMotionTestProvider()
    provider.triggerSwing('LEFT', swingOptions())
    provider.triggerSwing('RIGHT', swingOptions())
    const session = readySession(provider)
    await session.start()
    session.tick(BOWLING_RULES.countdownMs, { setupReady: true, hardFailure: false })
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().phase).toBe('AIMING')
    expect(session.getState().lastRoll).toBeNull()
    session.replay()
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().lastRoll).toBeNull()
  })

  it('consumes retained left and right sequences independently exactly once', async () => {
    const provider = new SportsMotionTestProvider()
    const session = readySession(provider)
    await session.start()
    session.tick(BOWLING_RULES.countdownMs, { setupReady: true, hardFailure: false })
    provider.triggerSwing('LEFT', swingOptions({ intensity: 1 }))
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().phase).toBe('BALL_ROLLING')
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().phase).toBe('BALL_ROLLING')
    const leftSequence = provider.getSnapshot().leftSwing?.sequence
    session.tick(BOWLING_RULES.ballRollingMs + BOWLING_RULES.pinsSettlingMs, { setupReady: true, hardFailure: false })
    provider.triggerSwing('RIGHT', swingOptions({ intensity: 1 }))
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().lastRoll?.hand).toBe('RIGHT')
    expect(leftSequence).toBeDefined()
    expect(session.getState().leftHandRolls).toBe(1)
    expect(session.getState().rightHandRolls).toBe(1)
  })

  it('marks unready and non-aiming events without scoring, then accepts a fresh recovery event', async () => {
    const provider = new SportsMotionTestProvider()
    const session = readySession(provider)
    await session.start()
    session.tick(BOWLING_RULES.countdownMs, { setupReady: true, hardFailure: false })
    provider.triggerSwing('LEFT', swingOptions())
    session.tick(100, { setupReady: false, hardFailure: false })
    expect(session.getState().phase).toBe('AIMING')
    expect(session.getState().lastRoll).toBeNull()
    session.tick(100, { setupReady: true, hardFailure: false })
    expect(session.getState().lastRoll).toBeNull()
    provider.triggerSwing('LEFT', swingOptions({ intensity: 1 }))
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().phase).toBe('BALL_ROLLING')
  })

  it('pauses countdown, aim, and roll timing during hard failure', async () => {
    const provider = new SportsMotionTestProvider()
    const session = readySession(provider)
    await session.start()
    session.tick(100, { setupReady: true, hardFailure: false })
    const countdown = session.getState()
    session.tick(5_000, { setupReady: false, hardFailure: true })
    expect(session.getState()).toEqual(countdown)
    session.tick(BOWLING_RULES.countdownMs - 100, { setupReady: true, hardFailure: false })
    expect(session.getState().phase).toBe('AIMING')
    provider.triggerSwing('RIGHT', swingOptions({ intensity: 1 }))
    session.tick(0, { setupReady: true, hardFailure: false })
    const rolling = session.getState()
    session.tick(10_000, { setupReady: false, hardFailure: true })
    expect(session.getState()).toEqual(rolling)
  })

  it('does not advance when stopped and replay marks the retained snapshot', async () => {
    const provider = new SportsMotionTestProvider()
    provider.triggerSwing('LEFT', swingOptions())
    const session = readySession(provider)
    await session.start()
    await session.stop()
    session.tick(5_000, { setupReady: true, hardFailure: false })
    expect(session.getState().phase).toBe('COUNTDOWN')
    session.replay()
    expect(session.getState().phase).toBe('COUNTDOWN')
  })
})
