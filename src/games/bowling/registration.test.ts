import { describe, expect, it } from 'vitest'
import { bowlingRegistration } from './registration'

describe('bowling registration', () => {
  it('declares the five-frame Sports Motion upper-body game', () => {
    expect(bowlingRegistration).toMatchObject({
      id: 'bowling',
      title: '保齡球大賽',
      category: 'SPORTS',
      subcategory: 'BALL',
      supportedTeams: [1],
      simultaneousPlayers: { min: 1, max: 1 },
    })
    expect(bowlingRegistration.controlSchemes[0]).toMatchObject({
      requiresSportsMotion: true,
      inputTypes: ['BODY'],
      bodyAreas: ['UPPER_BODY', 'LEFT_HAND', 'RIGHT_HAND'],
      supportedAbilityProfiles: ['UPPER_BODY'],
      sensorRequirements: { pose: true, hands: false, audio: false },
    })
  })
})
