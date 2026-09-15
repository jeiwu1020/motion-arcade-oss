import { describe, expect, it } from 'vitest'
import { SOUND_CANNON_RULES } from './SoundCannonCore'
import { SoundCannonVoiceCycle } from './SoundCannonVoiceCycle'

describe('SoundCannonVoiceCycle', () => {
  it('maps comfort and duration into bounded charge', () => {
    const cycle = new SoundCannonVoiceCycle()
    cycle.start(0, 1)
    const snapshot = cycle.update(375, 0.3, 0.375, null, true)
    expect(snapshot.comfortLevel).toBeCloseTo(Math.sqrt(0.5))
    expect(snapshot.charge).toBeCloseTo((0.375 / 0.75) * (0.75 + Math.sqrt(0.5) * 0.25))
  })

  it('fires once on quiet release and re-arms only after quiet', () => {
    const cycle = new SoundCannonVoiceCycle()
    expect(cycle.update(0, 0.4, 0, 1, true).cannonState).toBe('CHARGING')
    expect(cycle.update(300, 0.4, 0.3, null, true).fireEvent).toBeNull()
    const released = cycle.update(350, 0.05, 0, null, true)
    expect(released.fireEvent).not.toBeNull()
    expect(cycle.update(500, 0.4, 0.3, 2, true).fireEvent).toBeNull()
    expect(cycle.update(600, 0.05, 0, null, true).cannonState).toBe('ARMED')
    expect(cycle.update(700, 0.4, 0.1, 3, true).fireEvent).toBeNull()
    expect(cycle.update(800, 0.05, 0, null, true).fireEvent).not.toBeNull()
  })

  it('auto-fires at 900ms and sustained sound cannot repeat', () => {
    const cycle = new SoundCannonVoiceCycle()
    cycle.update(0, 0.5, 0, 1, true)
    const fired = cycle.update(SOUND_CANNON_RULES.maximumChargeVoiceMs, 0.5, 0.9, null, true)
    expect(fired.fireEvent).not.toBeNull()
    expect(cycle.update(1_800, 0.5, 2, null, true).fireEvent).toBeNull()
  })
})
