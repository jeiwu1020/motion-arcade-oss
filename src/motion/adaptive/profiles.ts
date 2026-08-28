import type { AnatomicalSide, MotionActionId } from '../contracts/motion'

export const ABILITY_PROFILE_IDS = [
  'STANDARD',
  'LOW_MOTION',
  'SEATED',
  'UPPER_BODY',
  'LEFT_SIDE',
  'RIGHT_SIDE',
  'SLOW_RESPONSE',
] as const

export type AbilityProfileId = (typeof ABILITY_PROFILE_IDS)[number]

export interface ResolvedAbilityProfile {
  readonly profileIds: readonly AbilityProfileId[]
  readonly posture: 'FLEXIBLE' | 'SEATED'
  readonly bodyRange: 'FULL_BODY' | 'UPPER_BODY'
  readonly allowedAnatomicalSides: readonly AnatomicalSide[]
  readonly requiredMotionRangeScale: number
  readonly reactionWindowScale: number
}

const ANATOMICAL_ACTION_SIDE: Readonly<
  Partial<Record<MotionActionId, AnatomicalSide>>
> = {
  STRIKE_LEFT: 'LEFT',
  STRIKE_RIGHT: 'RIGHT',
  REACH_LEFT: 'LEFT',
  REACH_RIGHT: 'RIGHT',
  ARM_SWING_LEFT: 'LEFT',
  ARM_SWING_RIGHT: 'RIGHT',
  HAND_POSITION_LEFT: 'LEFT',
  HAND_POSITION_RIGHT: 'RIGHT',
}

export function resolveAbilityProfile(
  requestedIds: readonly AbilityProfileId[],
): ResolvedAbilityProfile {
  const unique = [...new Set(requestedIds)]
  let profileIds: AbilityProfileId[]
  if (unique.length === 0) {
    profileIds = ['STANDARD']
  } else if (unique.length > 1) {
    profileIds = unique.filter((id) => id !== 'STANDARD')
  } else {
    profileIds = unique
  }
  const leftOnly = profileIds.includes('LEFT_SIDE')
  const rightOnly = profileIds.includes('RIGHT_SIDE')
  const allowedAnatomicalSides: readonly AnatomicalSide[] =
    leftOnly && !rightOnly
      ? ['LEFT']
      : rightOnly && !leftOnly
        ? ['RIGHT']
        : ['LEFT', 'RIGHT']

  return {
    profileIds,
    posture: profileIds.includes('SEATED') ? 'SEATED' : 'FLEXIBLE',
    bodyRange:
      profileIds.includes('UPPER_BODY') || profileIds.includes('SEATED')
        ? 'UPPER_BODY'
        : 'FULL_BODY',
    allowedAnatomicalSides,
    requiredMotionRangeScale: profileIds.includes('LOW_MOTION') ? 0.6 : 1,
    reactionWindowScale: profileIds.includes('SLOW_RESPONSE') ? 1.75 : 1,
  }
}

export function actionAllowedForProfile(
  actionId: MotionActionId,
  profile: ResolvedAbilityProfile,
): boolean {
  const side = ANATOMICAL_ACTION_SIDE[actionId]
  return side ? profile.allowedAnatomicalSides.includes(side) : true
}
