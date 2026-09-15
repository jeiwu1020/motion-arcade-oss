import { describe, expect, it } from 'vitest'
import { soundCannonRegistration } from './registration'
import { validateGameRegistry } from '../../game/registry/validateRegistry'

describe('Sound Cannon registration', () => {
  it('declares the voice-only production contract', async () => {
    expect(validateGameRegistry([soundCannonRegistration]).valid).toBe(true)
    const scheme = soundCannonRegistration.controlSchemes[0]!
    expect(soundCannonRegistration).toMatchObject({ id: 'sound-cannon', category: 'VOICE' })
    expect(scheme.requiredActions).toEqual(['VOICE_LEVEL', 'VOICE_TRIGGER', 'VOICE_SUSTAINED_DURATION'])
    expect(scheme.sensorRequirements).toEqual({ pose: false, hands: false, audio: true })
    expect(scheme.posture).toEqual(['STANDING', 'SEATED'])
    await expect(soundCannonRegistration.load()).resolves.toMatchObject({ id: 'sound-cannon' })
  })
})
