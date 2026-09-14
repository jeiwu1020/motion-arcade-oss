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

  it('registers Reaction Arena as the second normalized-action PARTY game', async () => {
    const reaction = gameRegistry.find(({ id }) => id === 'reaction-arena')
    expect(reaction).toMatchObject({
      id: 'reaction-arena',
      title: '光速反應王',
      category: 'PARTY',
      controlSchemes: [{
        requiredActions: ['MOVE_LEFT', 'MOVE_RIGHT', 'REACH_LEFT', 'REACH_RIGHT', 'SQUAT'],
        inputTypes: ['BODY'],
        bodyAreas: ['FULL_BODY'],
      }],
    })
    await expect(reaction?.load()).resolves.toMatchObject({ id: 'reaction-arena' })
  })

  it('registers Runner as a single-player SPORTS track-field game', async () => {
    const runner = gameRegistry.find(({ id }) => id === 'runner')

    expect(validateGameRegistry(gameRegistry)).toEqual({ valid: true, errors: [] })
    expect(runner).toMatchObject({
      id: 'runner',
      title: '跑酷衝刺',
      category: 'SPORTS',
      subcategory: 'TRACK_FIELD',
      supportedTeams: [1],
      simultaneousPlayers: { min: 1, max: 1 },
      controlSchemes: [{
        requiredActions: ['MOVE_LEFT', 'MOVE_RIGHT', 'JUMP', 'SQUAT'],
        inputTypes: ['BODY'],
        bodyAreas: ['FULL_BODY', 'LOWER_BODY'],
        posture: ['STANDING'],
        activityLevel: 'HIGH',
        supportedAbilityProfiles: ['STANDARD'],
        sensorRequirements: { pose: true, hands: false, audio: false },
      }],
    })
    await expect(runner?.load()).resolves.toMatchObject({ id: 'runner' })
  })

  it('registers Running Race as a locomotion-driven single-player game', async () => {
    const runningRace = gameRegistry.find(({ id }) => id === 'running-race')
    expect(runningRace).toMatchObject({
      id: 'running-race',
      title: '原地衝刺王',
      category: 'SPORTS',
      subcategory: 'TRACK_FIELD',
      controlSchemes: [{
        requiredActions: [],
        requiresLocomotion: true,
        bodyAreas: ['FULL_BODY', 'LOWER_BODY'],
      }],
    })
    await expect(runningRace?.load()).resolves.toMatchObject({ id: 'running-race' })
  })

  it('registers Long Jump as a dual locomotion and JUMP track-field game', async () => {
    const longJump = gameRegistry.find(({ id }) => id === 'long-jump')
    expect(longJump).toMatchObject({
      id: 'long-jump',
      title: '飛躍挑戰',
      category: 'SPORTS',
      subcategory: 'TRACK_FIELD',
      controlSchemes: [{
        requiredActions: ['JUMP'],
        requiresLocomotion: true,
        bodyAreas: ['FULL_BODY', 'LOWER_BODY'],
      }],
    })
    await expect(longJump?.load()).resolves.toMatchObject({ id: 'long-jump' })
  })
})
