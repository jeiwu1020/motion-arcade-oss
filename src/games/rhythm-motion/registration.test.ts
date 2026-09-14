import { describe, expect, it } from 'vitest'

import { gameRegistry } from '../../game/registry/gameRegistry'
import { validateGameRegistry } from '../../game/registry/validateRegistry'

describe('Rhythm Motion registry entry', () => {
  it('registers a valid single-player PARTY upper-body game', async () => {
    const rhythm = gameRegistry.find(({ id }) => id === 'rhythm-motion')

    expect(validateGameRegistry(gameRegistry)).toEqual({ valid: true, errors: [] })
    expect(rhythm).toMatchObject({
      id: 'rhythm-motion',
      title: '節奏動一動',
      category: 'PARTY',
      supportedTeams: [1],
      simultaneousPlayers: { min: 1, max: 1 },
      controlSchemes: [{
        requiredActions: [
          'MOVE_LEFT',
          'MOVE_RIGHT',
          'LEAN_LEFT',
          'LEAN_RIGHT',
          'REACH_LEFT',
          'REACH_RIGHT',
        ],
        inputTypes: ['BODY'],
        bodyAreas: ['UPPER_BODY'],
        posture: ['STANDING'],
        activityLevel: 'MEDIUM',
        supportedAbilityProfiles: ['UPPER_BODY'],
        sensorRequirements: { pose: true, hands: false, audio: false },
      }],
    })
    await expect(rhythm?.load()).resolves.toMatchObject({ id: 'rhythm-motion' })
  })
})
