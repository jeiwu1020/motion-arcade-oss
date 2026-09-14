import { describe, expect, it } from 'vitest'

import { SportsMotionTestProvider } from '../../motion/sports/SportsMotionTestProvider'
import { TENNIS_RULES } from './TennisCore'
import { TennisSession } from './TennisSession'

function sessionReady(provider = new SportsMotionTestProvider()): readonly [SportsMotionTestProvider, TennisSession] {
  const session = new TennisSession(provider)
  void session.start()
  session.tick(TENNIS_RULES.countdownMs, { setupReady: true, hardFailure: false })
  session.tick(TENNIS_RULES.visualLeadMs, { setupReady: true, hardFailure: false })
  return [provider, session]
}

function swing(provider: SportsMotionTestProvider, hand: 'LEFT' | 'RIGHT', timestampMs: number, vectorX = 0.8): void {
  provider.triggerSwing(hand, {
    timestampMs,
    vectorX,
    vectorY: 0,
    intensity: 0.75,
  })
}

describe('TennisSession Sports Motion event consumption', () => {
  it('consumes one retained left or right event once and tracks sides independently', () => {
    const [provider, session] = sessionReady()
    swing(provider, 'LEFT', TENNIS_RULES.visualLeadMs)
    session.tick(0, { setupReady: true, hardFailure: false })
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(1)
    expect(session.getState().leftHandReturns).toBe(1)

    swing(provider, 'RIGHT', TENNIS_RULES.visualLeadMs + 1_900)
    session.tick(1_900, { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(2)
    expect(session.getState().rightHandReturns).toBe(1)
  })

  it('marks a pre-existing event at start and does not replay it', () => {
    const provider = new SportsMotionTestProvider()
    swing(provider, 'LEFT', 0)
    const session = new TennisSession(provider)
    void session.start()
    session.tick(TENNIS_RULES.countdownMs + TENNIS_RULES.visualLeadMs, { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(0)
  })

  it('marks retained events again on replay', () => {
    const [provider, session] = sessionReady()
    swing(provider, 'LEFT', TENNIS_RULES.visualLeadMs)
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(1)
    session.replay()
    session.tick(TENNIS_RULES.countdownMs + TENNIS_RULES.visualLeadMs, { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(0)
  })

  it('consumes new events while not ready without scoring or replaying them on recovery', () => {
    const [provider, session] = sessionReady()
    swing(provider, 'LEFT', TENNIS_RULES.visualLeadMs)
    session.tick(0, { setupReady: false, hardFailure: false })
    session.tick(5_000, { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(0)

    const target = session.getState().shots.find((shot) => shot.resolution === 'PENDING')!.targetTimeMs
    swing(provider, 'RIGHT', target)
    session.tick(Math.max(0, target - session.getState().elapsedMs), { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(1)
  })

  it('does not advance Core time on hard failure and resumes from the same game state', () => {
    const [provider, session] = sessionReady()
    const before = session.getState()
    session.tick(2_000, { setupReady: false, hardFailure: true })
    expect(session.getState()).toEqual(before)
    swing(provider, 'LEFT', before.elapsedMs)
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().returns).toBe(1)
  })
})
