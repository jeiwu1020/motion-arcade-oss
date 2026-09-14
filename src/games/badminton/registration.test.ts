import { describe, expect, it } from 'vitest'

import { gameRegistry } from '../../game/registry/gameRegistry'
import { validateGameRegistry } from '../../game/registry/validateRegistry'

describe('Badminton registry entry', () => {
  it('registers Badminton as a single-player Sports Motion upper-body game', async () => {
    const badminton = gameRegistry.find(({ id }) => id === 'badminton')

    expect(validateGameRegistry(gameRegistry)).toEqual({ valid: true, errors: [] })
    expect(badminton).toMatchObject({
      id: 'badminton',
      title: '羽球快打',
      category: 'SPORTS',
      subcategory: 'RACKET_BALL',
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
    await expect(badminton?.load()).resolves.toMatchObject({ id: 'badminton' })
  })
})
