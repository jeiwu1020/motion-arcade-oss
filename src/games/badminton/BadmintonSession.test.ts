import { describe, expect, it } from 'vitest'

import { SportsMotionTestProvider } from '../../motion/sports/SportsMotionTestProvider'
import { BADMINTON_RULES } from './BadmintonCore'
import { BadmintonSession } from './BadmintonSession'

function sessionReady(provider = new SportsMotionTestProvider()): readonly [SportsMotionTestProvider, BadmintonSession] {
  const session = new BadmintonSession(provider)
  void session.start()
  session.tick(BADMINTON_RULES.countdownMs, { setupReady: true, hardFailure: false })
  session.tick(BADMINTON_RULES.visualLeadMs, { setupReady: true, hardFailure: false })
  return [provider, session]
}

function swing(
  provider: SportsMotionTestProvider,
  hand: 'LEFT' | 'RIGHT',
  timestampMs: number,
  intensity = 0.75,
): void {
  provider.triggerSwing(hand, {
    timestampMs,
    vectorX: hand === 'LEFT' ? -0.8 : 0.8,
    vectorY: 0,
    intensity,
  })
}

describe('BadmintonSession Sports Motion event consumption', () => {
  it('consumes retained left/right events once and tracks both sequences independently', () => {
    const [provider, session] = sessionReady()
    swing(provider, 'LEFT', BADMINTON_RULES.visualLeadMs)
    session.tick(0, { setupReady: true, hardFailure: false })
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(1)
    expect(session.getState().leftHandReturns).toBe(1)

    swing(provider, 'RIGHT', BADMINTON_RULES.visualLeadMs + 1_650)
    session.tick(1_650, { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(2)
    expect(session.getState().rightHandReturns).toBe(1)
  })

  it('ignores pre-existing retained events at start and replay', () => {
    const provider = new SportsMotionTestProvider()
    swing(provider, 'LEFT', 0)
    const session = new BadmintonSession(provider)
    void session.start()
    session.tick(BADMINTON_RULES.countdownMs + BADMINTON_RULES.visualLeadMs, { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(0)

    swing(provider, 'RIGHT', session.getState().elapsedMs)
    session.replay()
    session.tick(BADMINTON_RULES.countdownMs + BADMINTON_RULES.visualLeadMs, { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(0)
  })

  it('marks unready events without scoring or replaying them after recovery', () => {
    const [provider, session] = sessionReady()
    swing(provider, 'LEFT', BADMINTON_RULES.visualLeadMs)
    session.tick(0, { setupReady: false, hardFailure: false })
    session.tick(5_000, { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(0)

    const target = session.getState().shuttles.find((shuttle) => shuttle.resolution === 'PENDING')!.targetTimeMs
    swing(provider, 'RIGHT', target)
    session.tick(Math.max(0, target - session.getState().elapsedMs), { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(1)
  })

  it('freezes Core time on hard failure and resumes the same state', () => {
    const [provider, session] = sessionReady()
    const before = session.getState()
    session.tick(2_000, { setupReady: false, hardFailure: true })
    expect(session.getState()).toEqual(before)
    const target = before.shuttles[0]!.targetTimeMs
    swing(provider, 'LEFT', target)
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(1)
  })
})
