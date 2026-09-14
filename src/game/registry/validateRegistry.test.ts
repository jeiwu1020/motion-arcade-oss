import { describe, expect, it } from 'vitest'

import type { GameRegistration } from './types'
import { validateGameRegistry } from './validateRegistry'

const validFixture: GameRegistration = {
  id: 'registry-contract-fixture',
  title: 'Registry Contract Fixture',
  description: 'Test-only metadata; this is not a formal game.',
  category: 'SPORTS',
  subcategory: 'OTHER',
  tags: ['upper-body', 'simple-rules'],
  difficulty: {
    cognitiveComplexity: 'LOW',
    reactionDemand: 'LOW',
  },
  supportedTeams: [1, 2, 3, 4],
  simultaneousPlayers: { min: 1, max: 4 },
  controlSchemes: [
    {
      id: 'seated-upper-body',
      label: 'Seated upper body',
      requiredActions: ['LEAN_LEFT', 'LEAN_RIGHT'],
      optionalActions: ['VOICE_LEVEL'],
      inputTypes: ['BODY', 'VOICE'],
      bodyAreas: ['UPPER_BODY'],
      posture: ['SEATED'],
      activityLevel: 'LOW',
      supportedAbilityProfiles: ['SEATED', 'LOW_MOTION'],
      supportsSingleSide: false,
      sensorRequirements: { pose: true, hands: false, audio: true },
    },
  ],
  load: async () => ({ id: 'registry-contract-fixture' }),
}

describe('game registry validation', () => {
  it('accepts a valid control-scheme-based registration', () => {
    expect(validateGameRegistry([validFixture])).toEqual({
      valid: true,
      errors: [],
    })
  })

  it('treats the optional Sports Motion capability as absent by default and accepts it when declared', () => {
    expect(validFixture.controlSchemes[0]?.requiresSportsMotion ?? false).toBe(false)
    const sportsFixture = {
      ...validFixture,
      controlSchemes: [{
        ...validFixture.controlSchemes[0]!,
        requiredActions: [],
        requiresSportsMotion: true,
        requiresSpatialHands: false,
      }],
    }

    expect(validateGameRegistry([sportsFixture])).toEqual({ valid: true, errors: [] })
  })

  it('reports duplicate IDs and empty control schemes with useful paths', () => {
    const invalid = {
      ...validFixture,
      controlSchemes: [],
    }
    const result = validateGameRegistry([invalid, invalid])

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_GAME_ID' }),
        expect.objectContaining({
          code: 'EMPTY_CONTROL_SCHEMES',
          path: 'games[0].controlSchemes',
        }),
      ]),
    )
  })

  it('rejects invalid teams, impossible player ranges, and category mismatches', () => {
    const invalid = {
      ...validFixture,
      category: 'VOICE',
      supportedTeams: [0, 5],
      simultaneousPlayers: { min: 4, max: 2 },
    } as unknown as GameRegistration
    const codes = validateGameRegistry([invalid]).errors.map(({ code }) => code)

    expect(codes).toEqual(
      expect.arrayContaining([
        'INVALID_TEAM_COUNT',
        'IMPOSSIBLE_PLAYER_RANGE',
        'UNSUPPORTED_SUBCATEGORY',
      ]),
    )
  })

  it('catches required-action input declarations and seated inconsistencies', () => {
    const invalid = {
      ...validFixture,
      controlSchemes: [
        {
          ...validFixture.controlSchemes[0],
          requiredActions: ['HAND_POSITION_RIGHT'],
          inputTypes: ['BODY'],
          supportedAbilityProfiles: ['STANDARD'],
        },
      ],
    } as GameRegistration
    const result = validateGameRegistry([invalid])

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MISSING_REQUIRED_INPUT_TYPE' }),
        expect.objectContaining({ code: 'SEATED_PROFILE_MISMATCH' }),
      ]),
    )
  })
})
