import { describe, expect, it } from 'vitest'

import { gameRegistry } from '../../game/registry/gameRegistry'
import { validateGameRegistry } from '../../game/registry/validateRegistry'

describe('Tennis registry entry', () => {
  it('registers Tennis as a single-player Sports Motion upper-body sports game', async () => {
    const tennis = gameRegistry.find(({ id }) => id === 'tennis')

    expect(validateGameRegistry(gameRegistry)).toEqual({ valid: true, errors: [] })
    expect(tennis).toMatchObject({
      id: 'tennis',
      title: '網球對決',
      category: 'SPORTS',
      subcategory: 'RACKET_BALL',
      supportedTeams: [1],
      simultaneousPlayers: { min: 1, max: 1 },
      difficulty: { reactionDemand: 'MEDIUM' },
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
    await expect(tennis?.load()).resolves.toMatchObject({ id: 'tennis' })
  })
})
