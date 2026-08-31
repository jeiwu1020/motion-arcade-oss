import { describe, expect, it } from 'vitest'

import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { BALLOON_POP_RULES } from './BalloonPopCore'
import { BalloonPopSession } from './BalloonPopSession'

function keyboardEvent(type: 'keydown' | 'keyup', code: string): Event {
  const event = new Event(type, { cancelable: true })
  Object.defineProperties(event, {
    code: { value: code },
    repeat: { value: false },
  })
  return event
}

describe('BalloonPopSession test-provider integration', () => {
  it('maps Z/C test input through normalized REACH actions into the core', async () => {
    const keyboard = new EventTarget()
    const provider = new KeyboardMouseTestInputProvider({
      keyboardTarget: keyboard,
      now: () => 0,
    })
    const session = new BalloonPopSession(provider, { seed: 2 })
    await session.start()
    session.tick(BALLOON_POP_RULES.countdownMs)

    keyboard.dispatchEvent(keyboardEvent('keydown', 'KeyZ'))
    session.tick(0)
    session.tick(BALLOON_POP_RULES.nextTargetDelayMs)
    session.tick(0)

    expect(session.getState().score).toBe(1)
    expect(session.getState().target?.side).toBe('RIGHT')

    keyboard.dispatchEvent(keyboardEvent('keyup', 'KeyZ'))
    keyboard.dispatchEvent(keyboardEvent('keydown', 'KeyC'))
    session.tick(0)

    expect(session.getState()).toMatchObject({ score: 2, hits: 2 })
    await session.stop()
    expect(provider.isRunning()).toBe(false)
  })

  it('replay resets the core while keeping the running test provider', async () => {
    const provider = new KeyboardMouseTestInputProvider({
      keyboardTarget: new EventTarget(),
      now: () => 0,
    })
    const session = new BalloonPopSession(provider, { seed: 2 })
    await session.start()
    session.tick(BALLOON_POP_RULES.countdownMs + BALLOON_POP_RULES.roundMs)

    session.replay()

    expect(session.getState()).toMatchObject({
      phase: 'COUNTDOWN',
      countdownRemainingMs: BALLOON_POP_RULES.countdownMs,
      score: 0,
      hits: 0,
      misses: 0,
    })
    expect(provider.isRunning()).toBe(true)
    await session.stop()
  })

  it('can restart cleanly after a StrictMode-style start and immediate stop', async () => {
    const provider = new KeyboardMouseTestInputProvider({
      keyboardTarget: new EventTarget(),
      now: () => 0,
    })
    const session = new BalloonPopSession(provider, { seed: 2 })

    const firstStart = session.start()
    const firstStop = session.stop()
    await Promise.all([firstStart, firstStop])
    await session.start()
    session.tick(BALLOON_POP_RULES.countdownMs)

    expect(provider.isRunning()).toBe(true)
    expect(session.getState()).toMatchObject({
      phase: 'PLAYING',
      target: { side: 'LEFT' },
    })
    await session.stop()
  })
})
