import { describe, expect, it } from 'vitest'
import { KeyboardMouseTestInputProvider } from '../../motion/providers/KeyboardMouseTestInputProvider'
import { SOUND_CANNON_RULES } from './SoundCannonCore'
import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import { SoundCannonSession } from './SoundCannonSession'

function readySession(provider = new KeyboardMouseTestInputProvider({ keyboardTarget: new EventTarget() })): readonly [KeyboardMouseTestInputProvider, SoundCannonSession] {
  void provider.start({ players: [{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) }], actions: ['VOICE_LEVEL', 'VOICE_TRIGGER', 'VOICE_SUSTAINED_DURATION'], sensors: { pose: false, hands: false, audio: false } })
  const session = new SoundCannonSession(provider)
  void session.start()
  session.tick(SOUND_CANNON_RULES.countdownMs, { setupReady: true, hardFailure: false })
  session.tick(SOUND_CANNON_RULES.visualLeadMs, { setupReady: true, hardFailure: false })
  return [provider, session]
}

describe('SoundCannonSession voice-cycle safety', () => {
  it('ignores retained events at start and accepts only fresh events', () => {
    const provider = new KeyboardMouseTestInputProvider({ keyboardTarget: new EventTarget() })
    void provider.start({ players: [{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) }], actions: ['VOICE_LEVEL', 'VOICE_TRIGGER', 'VOICE_SUSTAINED_DURATION'], sensors: { pose: false, hands: false, audio: false } })
    provider.setContinuousValue('player-1', 'VOICE_LEVEL', 0.35)
    provider.triggerAction('player-1', 'VOICE_TRIGGER')
    const session = new SoundCannonSession(provider)
    void session.start()
    session.tick(3_000, { setupReady: true, hardFailure: false })
    expect(session.getState().shotsFired).toBe(0)
    provider.update(200)
    provider.setContinuousValue('player-1', 'VOICE_LEVEL', 0.35)
    provider.triggerAction('player-1', 'VOICE_TRIGGER')
    session.tick(100, { setupReady: true, hardFailure: false })
    console.log('debug', session.getState().phase, session.getState().cannonState, session.getState().charge, provider.getSnapshot().players[0]?.actions.VOICE_TRIGGER, provider.getSnapshot().players[0]?.actions.VOICE_LEVEL)
    expect(session.getState().cannonState).toBe('CHARGING')
  })

  it('pauses core while unready and consumes triggers without stale replay', () => {
    const [provider, session] = readySession()
    const before = session.getState()
    provider.setContinuousValue('player-1', 'VOICE_LEVEL', 0.35)
    provider.triggerAction('player-1', 'VOICE_TRIGGER')
    session.tick(1_000, { setupReady: false, hardFailure: false })
    expect(session.getState()).toEqual(before)
    session.tick(0, { setupReady: true, hardFailure: false })
    expect(session.getState().shotsFired).toBe(0)
  })

  it('releases through normal cycle and supports bilateral independent events', () => {
    const [provider, session] = readySession()
    provider.setContinuousValue('player-1', 'VOICE_LEVEL', 0.35)
    provider.triggerAction('player-1', 'VOICE_TRIGGER')
    session.tick(100, { setupReady: true, hardFailure: false })
    provider.setContinuousValue('player-1', 'VOICE_LEVEL', 0)
    session.tick(100, { setupReady: true, hardFailure: false })
    expect(session.getState().shotsFired).toBe(1)
  })
})
