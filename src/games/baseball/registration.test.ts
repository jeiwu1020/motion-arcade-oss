import { describe, expect, it } from 'vitest'

import { gameRegistry } from '../../game/registry/gameRegistry'
import { validateGameRegistry } from '../../game/registry/validateRegistry'

describe('Baseball registry entry', () => {
  it('registers a launchable single-player upper-body Sports Motion ball game', async () => {
    const baseball = gameRegistry.find(({ id }) => id === 'baseball')

    expect(validateGameRegistry(gameRegistry)).toEqual({ valid: true, errors: [] })
    expect(baseball).toMatchObject({
      id: 'baseball',
      title: '全壘打王',
      category: 'SPORTS',
      subcategory: 'BALL',
      supportedTeams: [1],
      simultaneousPlayers: { min: 1, max: 1 },
      difficulty: { reactionDemand: 'MEDIUM', cognitiveComplexity: 'LOW' },
      controlSchemes: [{
        requiresSportsMotion: true,
        requiredActions: [],
        inputTypes: ['BODY'],
        bodyAreas: ['UPPER_BODY', 'LEFT_HAND', 'RIGHT_HAND'],
        posture: ['STANDING'],
        activityLevel: 'MEDIUM',
        supportedAbilityProfiles: ['UPPER_BODY'],
        supportsSingleSide: false,
        sensorRequirements: { pose: true, hands: false, audio: false },
      }],
    })
    await expect(baseball?.load()).resolves.toMatchObject({ id: 'baseball' })
  })
})
