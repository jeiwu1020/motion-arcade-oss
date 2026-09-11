import { describe, expect, it } from 'vitest'

import { gameRegistry } from './gameRegistry'
import { validateGameRegistry } from './validateRegistry'

describe('production game registry', () => {
  it('registers Balloon Pop as a valid single-player PARTY game', async () => {
    const result = validateGameRegistry(gameRegistry)
    const balloonPop = gameRegistry.find(({ id }) => id === 'balloon-pop')

    expect(result).toEqual({ valid: true, errors: [] })
    expect(balloonPop).toMatchObject({
      id: 'balloon-pop',
      title: '氣球拍拍樂',
      category: 'PARTY',
      supportedTeams: [1],
      simultaneousPlayers: { min: 1, max: 1 },
      controlSchemes: [
        {
          requiredActions: [],
          requiresSpatialHands: true,
          inputTypes: ['BODY'],
        },
      ],
    })
    await expect(balloonPop?.load()).resolves.toMatchObject({
      id: 'balloon-pop',
    })
  })
})
