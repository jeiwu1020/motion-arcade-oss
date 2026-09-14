import { describe, expect, it } from 'vitest'

import { gameRegistry } from '../../game/registry/gameRegistry'
import { validateGameRegistry } from '../../game/registry/validateRegistry'

describe('Swimming registry entry', () => {
  it('registers a single-player Sports Motion UPPER_BODY aquatic game', async () => {
    const swimming = gameRegistry.find(({ id }) => id === 'swimming')
    expect(validateGameRegistry(gameRegistry)).toEqual({ valid: true, errors: [] })
    expect(swimming).toMatchObject({
      id: 'swimming',
      title: '泳池衝刺',
      description: '左右手交替划動，加快節奏一路游向終點！',
      category: 'SPORTS',
      subcategory: 'AQUATIC',
      supportedTeams: [1],
      simultaneousPlayers: { min: 1, max: 1 },
      difficulty: { reactionDemand: 'LOW', cognitiveComplexity: 'LOW' },
      controlSchemes: [{
        requiresSportsMotion: true,
        requiredActions: [],
        bodyAreas: ['UPPER_BODY', 'LEFT_HAND', 'RIGHT_HAND'],
        posture: ['STANDING'],
        activityLevel: 'MEDIUM',
        supportedAbilityProfiles: ['UPPER_BODY'],
        sensorRequirements: { pose: true, hands: false, audio: false },
      }],
    })
    await expect(swimming?.load()).resolves.toMatchObject({ id: 'swimming' })
  })
})
