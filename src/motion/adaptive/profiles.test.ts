import { describe, expect, it } from 'vitest'

import {
  actionAllowedForProfile,
  resolveAbilityProfile,
} from './profiles'

describe('ability profiles', () => {
  it('composes posture and side adaptations without diagnosis labels', () => {
    const profile = resolveAbilityProfile(['SEATED', 'RIGHT_SIDE'])

    expect(profile.profileIds).toEqual(['SEATED', 'RIGHT_SIDE'])
    expect(profile.posture).toBe('SEATED')
    expect(profile.allowedAnatomicalSides).toEqual(['RIGHT'])
  })

  it('applies left and right restrictions predictably', () => {
    const rightOnly = resolveAbilityProfile(['RIGHT_SIDE'])

    expect(actionAllowedForProfile('STRIKE_LEFT', rightOnly)).toBe(false)
    expect(actionAllowedForProfile('HAND_POSITION_LEFT', rightOnly)).toBe(false)
    expect(actionAllowedForProfile('REACH_LEFT', rightOnly)).toBe(false)
    expect(actionAllowedForProfile('ARM_SWING_LEFT', rightOnly)).toBe(false)
    expect(actionAllowedForProfile('STRIKE_RIGHT', rightOnly)).toBe(true)
    expect(actionAllowedForProfile('MOVE_LEFT', rightOnly)).toBe(true)
  })

  it('does not confuse screen direction with anatomical side', () => {
    const leftOnly = resolveAbilityProfile(['LEFT_SIDE'])

    expect(actionAllowedForProfile('MOVE_RIGHT', leftOnly)).toBe(true)
    expect(actionAllowedForProfile('LEAN_RIGHT', leftOnly)).toBe(true)
    expect(actionAllowedForProfile('HAND_POSITION_RIGHT', leftOnly)).toBe(false)
    expect(actionAllowedForProfile('REACH_RIGHT', leftOnly)).toBe(false)
  })

  it('describes physical adaptation without changing game-facing action semantics', () => {
    const lowMotion = resolveAbilityProfile(['LOW_MOTION'])
    const slowResponse = resolveAbilityProfile(['SLOW_RESPONSE'])

    expect(lowMotion.requiredMotionRangeScale).toBe(0.6)
    expect(lowMotion.reactionWindowScale).toBe(1)
    expect(slowResponse.requiredMotionRangeScale).toBe(1)
    expect(slowResponse.reactionWindowScale).toBe(1.75)
  })
})
