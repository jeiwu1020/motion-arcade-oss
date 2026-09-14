import { describe, expect, it } from 'vitest'

import { runningRaceRegistration } from './registration'

describe('Running Race registration', () => {
  it('declares a single-player locomotion-driven FULL_BODY KNEES game', async () => {
    expect(runningRaceRegistration).toMatchObject({
      id: 'running-race',
      title: '原地衝刺王',
      category: 'SPORTS',
      subcategory: 'TRACK_FIELD',
      supportedTeams: [1],
      simultaneousPlayers: { min: 1, max: 1 },
      controlSchemes: [{
        requiredActions: [],
        requiresLocomotion: true,
        inputTypes: ['BODY'],
        bodyAreas: ['FULL_BODY', 'LOWER_BODY'],
        posture: ['STANDING'],
        activityLevel: 'HIGH',
        supportedAbilityProfiles: ['STANDARD'],
        sensorRequirements: { pose: true, hands: false, audio: false },
      }],
    })
    await expect(runningRaceRegistration.load()).resolves.toMatchObject({ id: 'running-race' })
  })
})
