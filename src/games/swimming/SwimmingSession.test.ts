import { describe, expect, it } from 'vitest'

import { SportsMotionTestProvider } from '../../motion/sports/SportsMotionTestProvider'
import { SWIMMING_RULES } from './SwimmingCore'
import { SwimmingSession } from './SwimmingSession'

const READY = Object.freeze({ setupReady: true, hardFailure: false })
const UNREADY = Object.freeze({ setupReady: false, hardFailure: false })
const FAILED = Object.freeze({ setupReady: false, hardFailure: true })

function swing(provider: SportsMotionTestProvider, side: 'LEFT' | 'RIGHT', timestampMs: number, intensity = 0.7): void {
  provider.triggerSwing(side, {
    timestampMs,
    vectorX: side === 'LEFT' ? -0.8 : 0.8,
    vectorY: side === 'LEFT' ? -0.4 : 0.4,
    intensity,
  })
}

async function readySession(provider = new SportsMotionTestProvider()): Promise<SwimmingSession> {
  const session = new SwimmingSession(provider)
  await session.start()
  session.tick(SWIMMING_RULES.countdownMs, READY)
  return session
}

describe('SwimmingSession C0 retained-event bridge', () => {
  it('marks retained left/right events on start and consumes new sequences independently once', async () => {
    const provider = new SportsMotionTestProvider()
    swing(provider, 'LEFT', 0)
    swing(provider, 'RIGHT', 1)
    const session = await readySession(provider)
    session.tick(400, READY)
    expect(session.getState().acceptedStrokeCount).toBe(0)

    swing(provider, 'LEFT', 500)
    session.tick(400, READY)
    session.tick(400, READY)
    expect(session.getState()).toMatchObject({ acceptedStrokeCount: 1, leftStrokeCount: 1 })
    swing(provider, 'RIGHT', 900)
    session.tick(400, READY)
    expect(session.getState()).toMatchObject({ acceptedStrokeCount: 2, rightStrokeCount: 1 })
  })

  it('rejects same-side propulsion while accepting a fresh opposite stroke', async () => {
    const provider = new SportsMotionTestProvider()
    const session = await readySession(provider)
    swing(provider, 'LEFT', 0)
    session.tick(400, READY)
    const afterFirst = session.getState().acceptedStrokeCount
    swing(provider, 'LEFT', 400)
    session.tick(400, READY)
    expect(session.getState().acceptedStrokeCount).toBe(afterFirst)
    expect(session.getState().presentationEvents.at(-1)).toMatchObject({ kind: 'OTHER_HAND_HINT' })
    swing(provider, 'RIGHT', 800)
    session.tick(400, READY)
    expect(session.getState().acceptedStrokeCount).toBe(afterFirst + 1)
  })

  it('marks unready and failed events without advancing Core or replaying after recovery', async () => {
    const provider = new SportsMotionTestProvider()
    const session = await readySession(provider)
    const elapsedMs = session.getState().elapsedMs
    swing(provider, 'LEFT', 100)
    session.tick(500, UNREADY)
    swing(provider, 'RIGHT', 200)
    session.tick(500, FAILED)
    expect(session.getState()).toMatchObject({ elapsedMs, acceptedStrokeCount: 0 })
    session.tick(500, READY)
    expect(session.getState()).toMatchObject({ elapsedMs: elapsedMs + 500, acceptedStrokeCount: 0 })
    swing(provider, 'LEFT', 300)
    session.tick(400, READY)
    expect(session.getState().acceptedStrokeCount).toBe(1)
  })

  it('marks retained events on replay and resets cycle state', async () => {
    const provider = new SportsMotionTestProvider()
    const session = await readySession(provider)
    swing(provider, 'RIGHT', 100)
    session.tick(400, READY)
    expect(session.getState().acceptedStrokeCount).toBe(1)
    session.replay()
    session.tick(SWIMMING_RULES.countdownMs, READY)
    session.tick(400, READY)
    expect(session.getState().acceptedStrokeCount).toBe(0)
  })

  it('lets propulsion decay to zero without camera or direct speed controls', async () => {
    const provider = new SportsMotionTestProvider()
    const session = await readySession(provider)
    swing(provider, 'LEFT', 0, 1)
    session.tick(400, READY)
    swing(provider, 'RIGHT', 400, 1)
    session.tick(400, READY)
    expect(session.getState().playerSpeed).toBeGreaterThan(0)
    session.tick(1_500, READY)
    expect(session.getState()).toMatchObject({ playerSpeed: 0, speedMeter: 0 })
  })
})
