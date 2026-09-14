import { describe, expect, it } from 'vitest'

import { LocomotionTestProvider } from '../../motion/locomotion/LocomotionTestProvider'
import { RUNNING_RACE_RULES } from './RunningRaceCore'
import { RunningRaceSession } from './RunningRaceSession'

const READY = Object.freeze({ setupReady: true, hardFailure: false })
const NOT_READY = Object.freeze({ setupReady: false, hardFailure: false })
const FAILED = Object.freeze({ setupReady: false, hardFailure: true })

describe('RunningRaceSession D0 bridge', () => {
  it('marks a retained step before start and does not replay it', async () => {
    const source = new LocomotionTestProvider()
    source.triggerStep('LEFT', { timestampMs: 100 })
    const session = new RunningRaceSession(source)

    await session.start()
    session.tick(RUNNING_RACE_RULES.countdownMs, READY)
    expect(session.getState().gameSteps).toBe(0)
  })

  it('consumes fresh LEFT/RIGHT step sequences once and independently', async () => {
    const source = new LocomotionTestProvider()
    const session = new RunningRaceSession(source)
    await session.start()
    session.tick(RUNNING_RACE_RULES.countdownMs, READY)

    source.triggerStep('LEFT', { timestampMs: 100 })
    session.tick(100, READY)
    expect(session.getState()).toMatchObject({ gameSteps: 1, latestStep: { side: 'LEFT' } })
    session.tick(100, READY)
    expect(session.getState().gameSteps).toBe(1)

    source.triggerStep('RIGHT', { timestampMs: 700 })
    session.tick(100, READY)
    expect(session.getState()).toMatchObject({ gameSteps: 2, latestStep: { side: 'RIGHT' } })
  })

  it('marks new steps while unready or failed, pauses Core time, and does not replay after recovery', async () => {
    const source = new LocomotionTestProvider()
    const session = new RunningRaceSession(source)
    await session.start()
    session.tick(RUNNING_RACE_RULES.countdownMs, READY)
    const beforeLoss = session.getState().elapsedMs

    source.triggerStep('LEFT', { timestampMs: 100 })
    session.tick(500, NOT_READY)
    expect(session.getState()).toMatchObject({ elapsedMs: beforeLoss, gameSteps: 0 })
    session.tick(500, READY)
    expect(session.getState()).toMatchObject({ elapsedMs: beforeLoss + 500, gameSteps: 0 })

    source.triggerStep('RIGHT', { timestampMs: 700 })
    session.tick(100, FAILED)
    expect(session.getState()).toMatchObject({ elapsedMs: beforeLoss + 500, gameSteps: 0 })
    session.tick(100, READY)
    expect(session.getState().gameSteps).toBe(0)

    source.triggerStep('LEFT', { timestampMs: 1_000 })
    session.tick(100, READY)
    expect(session.getState().gameSteps).toBe(1)
  })

  it('replay marks the retained D0 step before the new round', async () => {
    const source = new LocomotionTestProvider()
    const session = new RunningRaceSession(source)
    await session.start()
    session.tick(RUNNING_RACE_RULES.countdownMs, READY)
    source.triggerStep('LEFT', { timestampMs: 100 })
    session.tick(100, READY)
    session.replay()
    session.tick(RUNNING_RACE_RULES.countdownMs, READY)
    expect(session.getState().gameSteps).toBe(0)
  })

  it('accepts a fresh post-recovery step after D0 has cleared its retained event sequence', async () => {
    const source = new LocomotionTestProvider()
    const session = new RunningRaceSession(source)
    await session.start()
    session.tick(RUNNING_RACE_RULES.countdownMs, READY)
    source.triggerStep('LEFT', { timestampMs: 100 })
    session.tick(100, READY)
    expect(session.getState().gameSteps).toBe(1)

    source.reset(500)
    session.tick(0, NOT_READY)
    source.triggerStep('LEFT', { timestampMs: 600 })
    session.tick(100, READY)
    expect(session.getState().gameSteps).toBe(2)
  })
})
