import { describe, expect, it } from 'vitest'

import { gameRegistry } from '../../game/registry/gameRegistry'
import { validateGameRegistry } from '../../game/registry/validateRegistry'

describe('High Jump registry entry', () => {
  it('registers a single-player STANDARD JUMP timing game', async () => {
    const highJump = gameRegistry.find(({ id }) => id === 'high-jump')

    expect(validateGameRegistry(gameRegistry)).toEqual({ valid: true, errors: [] })
    expect(highJump).toMatchObject({
      id: 'high-jump',
      title: '跳高挑戰',
      description: '抓準起跳時機，輕輕一跳挑戰越來越高的關卡！',
      category: 'SPORTS',
      subcategory: 'TRACK_FIELD',
      supportedTeams: [1],
      simultaneousPlayers: { min: 1, max: 1 },
      difficulty: { reactionDemand: 'MEDIUM', cognitiveComplexity: 'LOW' },
      controlSchemes: [{
        requiredActions: ['JUMP'],
        bodyAreas: ['FULL_BODY', 'LOWER_BODY'],
        posture: ['STANDING'],
        activityLevel: 'HIGH',
        supportedAbilityProfiles: ['STANDARD'],
        sensorRequirements: { pose: true, hands: false, audio: false },
      }],
    })
    await expect(highJump?.load()).resolves.toMatchObject({ id: 'high-jump' })
  })
})
