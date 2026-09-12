import { describe, expect, it } from 'vitest'

import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import type { MotionInputRequest } from '../../motion/contracts/motion'
import { REACTION_ARENA_RULES } from './ReactionArenaCore'
import { ReactionArenaSession } from './ReactionArenaSession'

const REQUEST: MotionInputRequest = Object.freeze({
  players: Object.freeze([{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) }]),
  actions: Object.freeze(['MOVE_LEFT', 'MOVE_RIGHT', 'REACH_LEFT', 'REACH_RIGHT', 'SQUAT'] as const),
  sensors: Object.freeze({ pose: false, hands: false, audio: false }),
})

async function setup() {
  const provider = new KeyboardMouseTestInputProvider({ keyboardTarget: new EventTarget() })
  await provider.start(REQUEST)
  const session = new ReactionArenaSession(provider, { seed: 4 })
  await session.start()
  return { provider, session }
}

function tickToPlaying(session: ReactionArenaSession) {
  session.tick(REACTION_ARENA_RULES.countdownMs, { setupReady: true, hardFailure: false })
}

describe('ReactionArenaSession', () => {
  it('consumes only new action sequences after the cue is active', async () => {
    const { provider, session } = await setup()
    provider.triggerAction('player-1', 'MOVE_LEFT')
    provider.update(16)
    session.tick(16, { setupReady: false, hardFailure: false })
    tickToPlaying(session)
    const cue = session.getState().currentCue!
    if (cue.kind !== 'LEFT') {
      provider.triggerAction('player-1', cue.kind === 'RIGHT' ? 'MOVE_RIGHT' : cue.kind)
      provider.update(16)
      session.tick(16, { setupReady: true, hardFailure: false })
    }
    const before = session.getState().successfulCues
    provider.triggerAction('player-1', cue.kind === 'LEFT' ? 'MOVE_LEFT' : cue.kind === 'RIGHT' ? 'MOVE_RIGHT' : cue.kind)
    provider.update(16)
    session.tick(16, { setupReady: true, hardFailure: false })
    expect(session.getState().successfulCues).toBeGreaterThanOrEqual(before)
  })

  it('pauses on runtime tracking loss and resumes without reusing a held sequence', async () => {
    const { provider, session } = await setup()
    tickToPlaying(session)
    const elapsed = session.getState().elapsedMs
    session.tick(500, { setupReady: true, hardFailure: false })
    provider.triggerAction('player-1', 'MOVE_LEFT')
    provider.update(16)
    session.tick(16, { setupReady: false, hardFailure: false })
    const pausedElapsed = session.getState().elapsedMs
    expect(pausedElapsed).toBe(elapsed + 500)
    session.tick(500, { setupReady: false, hardFailure: false })
    expect(session.getState().elapsedMs).toBe(pausedElapsed)
    session.tick(16, { setupReady: true, hardFailure: false })
    expect(session.getState().elapsedMs).toBeGreaterThan(pausedElapsed)
  })

  it('replay clears consumed action sequences and restarts the round', async () => {
    const { session } = await setup()
    tickToPlaying(session)
    session.replay()
    expect(session.getState().phase).toBe('COUNTDOWN')
    expect(session.getState().elapsedMs).toBe(0)
  })
})
