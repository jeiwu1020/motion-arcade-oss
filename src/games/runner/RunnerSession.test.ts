import { describe, expect, it } from 'vitest'

import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import type { MotionInputRequest } from '../../motion/contracts/motion'
import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { RUNNER_RULES } from './RunnerCore'
import { RunnerSession } from './RunnerSession'

const REQUEST: MotionInputRequest = Object.freeze({
  players: Object.freeze([{
    playerId: 'player-1',
    abilityProfile: resolveAbilityProfile(['STANDARD']),
  }]),
  actions: Object.freeze(['MOVE_LEFT', 'MOVE_RIGHT', 'JUMP', 'SQUAT'] as const),
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

async function setup() {
  const keyboard = new EventTarget()
  const provider = new KeyboardMouseTestInputProvider({ keyboardTarget: keyboard })
  await provider.start(REQUEST)
  const session = new RunnerSession(provider, { seed: 21 })
  await session.start()
  return { keyboard, provider, session }
}

function startPlaying(session: RunnerSession): void {
  session.tick(RUNNER_RULES.countdownMs, READY)
  expect(session.getState().phase).toBe('PLAYING')
}

describe('RunnerSession normalized action bridge', () => {
  it('does not trigger an action that was already held when the session starts', async () => {
    const keyboard = new EventTarget()
    const provider = new KeyboardMouseTestInputProvider({ keyboardTarget: keyboard })
    await provider.start(REQUEST)
    keyboard.dispatchEvent(new KeyEventForTest('keydown', 'KeyA'))
    const session = new RunnerSession(provider, { seed: 21 })

    await session.start()
    startPlaying(session)
    provider.update(16)
    session.tick(16, READY)

    expect(session.getState().lane).toBe('CENTER')
  })

  it('consumes only new sequences and does not repeat a held lateral action', async () => {
    const { keyboard, provider, session } = await setup()
    startPlaying(session)

    keyboard.dispatchEvent(new KeyEventForTest('keydown', 'KeyA'))
    session.tick(16, READY)
    expect(session.getState().lane).toBe('LEFT')

    provider.update(16)
    session.tick(16, READY)
    expect(session.getState().lane).toBe('LEFT')
  })

  it('pauses countdown and gameplay time until setup readiness returns', async () => {
    const { provider, session } = await setup()

    session.tick(500, NOT_READY)
    expect(session.getState().countdownRemainingMs).toBe(3_000)
    session.tick(500, READY)
    expect(session.getState().countdownRemainingMs).toBe(2_500)
    session.tick(250, NOT_READY)
    expect(session.getState().countdownRemainingMs).toBe(2_500)

    session.tick(2_500, READY)
    session.tick(400, READY)
    const elapsedBeforeLoss = session.getState().elapsedMs
    provider.triggerAction('player-1', 'MOVE_LEFT')
    session.tick(800, NOT_READY)
    expect(session.getState().elapsedMs).toBe(elapsedBeforeLoss)
    session.tick(200, READY)
    expect(session.getState().elapsedMs).toBe(elapsedBeforeLoss + 200)
    expect(session.getState().lane).toBe('CENTER')
  })

  it('consumes current sequences on replay so they cannot leak into the next round', async () => {
    const { provider, session } = await setup()
    startPlaying(session)
    provider.triggerAction('player-1', 'MOVE_RIGHT')
    session.replay()
    startPlaying(session)
    provider.update(16)
    session.tick(16, READY)

    expect(session.getState().lane).toBe('CENTER')
  })

  it('does not advance Core time during a hard runtime failure', async () => {
    const { session } = await setup()
    session.tick(1_000, FAILED)

    expect(session.getState().countdownRemainingMs).toBe(3_000)
    expect(session.getState().elapsedMs).toBe(0)
  })

  it('drives all four Runner actions through the developer keyboard provider', async () => {
    const { keyboard, session } = await setup()
    startPlaying(session)

    keyboard.dispatchEvent(new KeyEventForTest('keydown', 'KeyA'))
    session.tick(0, READY)
    expect(session.getState().lane).toBe('LEFT')

    keyboard.dispatchEvent(new KeyEventForTest('keydown', 'KeyD'))
    session.tick(0, READY)
    expect(session.getState().lane).toBe('CENTER')

    keyboard.dispatchEvent(new KeyEventForTest('keydown', 'KeyW'))
    session.tick(0, READY)
    expect(session.getState().jumpElapsedMs).toBe(0)
    session.tick(RUNNER_RULES.jumpDurationMs, READY)

    keyboard.dispatchEvent(new KeyEventForTest('keydown', 'KeyS'))
    session.tick(0, READY)
    expect(session.getState().duckElapsedMs).toBe(0)
  })
})
