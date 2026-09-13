import { describe, expect, it } from 'vitest'

import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import type { MotionInputRequest } from '../../motion/contracts/motion'
import { PRACTICE_SUCCESS_FEEDBACK_MS } from './ReactionArenaPracticeCore'
import { ReactionArenaPracticeSession } from './ReactionArenaPracticeSession'

const REQUEST: MotionInputRequest = Object.freeze({
  players: Object.freeze([{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) }]),
  actions: Object.freeze(['MOVE_LEFT', 'MOVE_RIGHT', 'REACH_LEFT', 'REACH_RIGHT', 'SQUAT'] as const),
  sensors: Object.freeze({ pose: false, hands: false, audio: false }),
})

async function setup() {
  const provider = new KeyboardMouseTestInputProvider({ keyboardTarget: new EventTarget() })
  await provider.start(REQUEST)
  const session = new ReactionArenaPracticeSession(provider)
  await session.start()
  return { provider, session }
}

function trigger(
  provider: KeyboardMouseTestInputProvider,
  session: ReactionArenaPracticeSession,
  action: 'MOVE_LEFT' | 'MOVE_RIGHT' | 'REACH_LEFT' | 'REACH_RIGHT' | 'SQUAT',
) {
  provider.triggerAction('player-1', action)
  provider.update(16)
  session.tick(16, { setupReady: true, hardFailure: false })
}

describe('ReactionArenaPracticeSession', () => {
  it('does not reuse a pre-held or wrong action and reports the latest normalized action', async () => {
    const { provider, session } = await setup()
    provider.triggerAction('player-1', 'MOVE_LEFT')
    provider.update(16)
    await session.start()
    session.tick(16, { setupReady: true, hardFailure: false })
    expect(session.getState().currentAction).toBe('LEFT')

    trigger(provider, session, 'MOVE_RIGHT')
    expect(session.getState().currentAction).toBe('LEFT')
    expect(session.getState().lastRecognizedAction).toBe('RIGHT')
  })

  it('requires a new matching sequence and advances only after success feedback', async () => {
    const { provider, session } = await setup()
    trigger(provider, session, 'MOVE_LEFT')
    expect(session.getState().phase).toBe('SUCCESS_FEEDBACK')
    expect(session.getState().currentAction).toBe('LEFT')

    session.tick(PRACTICE_SUCCESS_FEEDBACK_MS, { setupReady: true, hardFailure: false })
    expect(session.getState().currentAction).toBe('RIGHT')
    expect(session.getState().successCount).toBe(1)

    session.tick(16, { setupReady: true, hardFailure: false })
    expect(session.getState().currentAction).toBe('RIGHT')
  })

  it('does not expire without input and replay resets the ordered practice', async () => {
    const { session } = await setup()
    session.tick(120_000, { setupReady: true, hardFailure: false })
    expect(session.getState().phase).toBe('PRACTICING')
    expect(session.getState().currentAction).toBe('LEFT')
    session.replay()
    expect(session.getState().currentAction).toBe('LEFT')
    expect(session.getState().successCount).toBe(0)
  })
})
