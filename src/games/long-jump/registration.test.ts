import { describe, expect, it } from 'vitest'

import { longJumpRegistration } from './registration'

describe('Long Jump registry entry', () => {
  it('declares the dual normalized locomotion plus JUMP control boundary', async () => {
    const scheme = longJumpRegistration.controlSchemes[0]
    expect(longJumpRegistration).toMatchObject({
      id: 'long-jump',
      title: '飛躍挑戰',
      category: 'SPORTS',
      subcategory: 'TRACK_FIELD',
    })
    expect(scheme).toMatchObject({
      requiredActions: ['JUMP'],
      requiresLocomotion: true,
      bodyAreas: ['FULL_BODY', 'LOWER_BODY'],
      sensorRequirements: { pose: true, hands: false, audio: false },
    })
    await expect(longJumpRegistration.load()).resolves.toMatchObject({ id: 'long-jump' })
  })
})
