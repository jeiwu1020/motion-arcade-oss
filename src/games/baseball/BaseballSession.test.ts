import { describe, expect, it } from 'vitest'

import { SportsMotionTestProvider } from '../../motion/sports/SportsMotionTestProvider'
import { BASEBALL_RULES } from './BaseballCore'
import { BaseballSession } from './BaseballSession'

function readySession(
  provider = new SportsMotionTestProvider(),
): readonly [SportsMotionTestProvider, BaseballSession] {
  const session = new BaseballSession(provider)
  void session.start()
  session.tick(BASEBALL_RULES.countdownMs, { setupReady: true, hardFailure: false })
  session.tick(BASEBALL_RULES.visualLeadMs, { setupReady: true, hardFailure: false })
  return [provider, session]
}

function swing(
  provider: SportsMotionTestProvider,
  hand: 'LEFT' | 'RIGHT',
  timestampMs: number,
  intensity = 0.72,
): void {
  provider.triggerSwing(hand, {
    timestampMs,
    vectorX: hand === 'LEFT' ? -0.7 : 0.7,
    vectorY: -0.15,
    intensity,
  })
}

describe('BaseballSession retained Sports Motion safety', () => {
  it('ignores retained left and right events present before start', () => {
    const provider = new SportsMotionTestProvider()
    swing(provider, 'LEFT', 10)
    swing(provider, 'RIGHT', 20)
    const session = new BaseballSession(provider)
    void session.start()

    session.tick(BASEBALL_RULES.countdownMs + BASEBALL_RULES.visualLeadMs, {
      setupReady: true,
      hardFailure: false,
    })

    expect(session.getState().hits).toBe(0)
    expect(session.getState().leftHandHits).toBe(0)
    expect(session.getState().rightHandHits).toBe(0)
  })

  it('tracks left and right sequences independently and consumes each event once', () => {
    const [provider, session] = readySession()
    swing(provider, 'LEFT', BASEBALL_RULES.visualLeadMs)
    session.tick(0, { setupReady: true, hardFailure: false })
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState()).toMatchObject({ hits: 1, leftHandHits: 1, rightHandHits: 0 })

    const nextTarget = session.getState().pitches.find((pitch) => pitch.resolution === 'PENDING')!.targetTimeMs
    swing(provider, 'RIGHT', nextTarget)
    session.tick(nextTarget - session.getState().elapsedMs, {
      setupReady: true,
      hardFailure: false,
    })
    expect(session.getState()).toMatchObject({ hits: 2, leftHandHits: 1, rightHandHits: 1 })
  })

  it('marks current retained events again on replay', () => {
    const [provider, session] = readySession()
    swing(provider, 'LEFT', BASEBALL_RULES.visualLeadMs)
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().hits).toBe(1)

    session.replay()
    session.tick(BASEBALL_RULES.countdownMs + BASEBALL_RULES.visualLeadMs, {
      setupReady: true,
      hardFailure: false,
    })
    expect(session.getState().hits).toBe(0)
  })

  it('marks and ignores events while setup is not ready, then accepts a fresh recovered swing', () => {
    const [provider, session] = readySession()
    const before = session.getState()
    swing(provider, 'LEFT', before.elapsedMs)
    session.tick(2_000, { setupReady: false, hardFailure: false })
    expect(session.getState()).toEqual(before)

    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().hits).toBe(0)

    swing(provider, 'RIGHT', before.elapsedMs)
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState()).toMatchObject({ hits: 1, rightHandHits: 1 })
  })

  it('marks and ignores hard-failure events without advancing or replaying them', () => {
    const [provider, session] = readySession()
    const before = session.getState()
    swing(provider, 'RIGHT', before.elapsedMs)
    session.tick(5_000, { setupReady: false, hardFailure: true })
    expect(session.getState()).toEqual(before)

    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().hits).toBe(0)
  })

  it('maps one newer event to at most one pitch resolution', () => {
    const [provider, session] = readySession()
    swing(provider, 'LEFT', BASEBALL_RULES.visualLeadMs)
    session.tick(0, { setupReady: true, hardFailure: false })
    session.tick(10_000, { setupReady: true, hardFailure: false })

    expect(session.getState().hits).toBe(1)
    expect(session.getState().pitches.filter((pitch) => pitch.resolution !== 'PENDING' && pitch.resolution !== 'MISS'))
      .toHaveLength(1)
  })
})
