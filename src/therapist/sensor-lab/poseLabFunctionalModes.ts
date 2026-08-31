import type { AbilityProfileId } from '../../motion/adaptive/profiles'
import type { MotionActionId } from '../../motion/contracts/motion'

export type PoseLabFunctionalProfileId = Extract<
  AbilityProfileId,
  | 'STANDARD'
  | 'SEATED'
  | 'UPPER_BODY'
  | 'LOW_MOTION'
  | 'SLOW_RESPONSE'
>

const FUNCTIONAL_PROFILE_ORDER = [
  'SEATED',
  'UPPER_BODY',
  'LOW_MOTION',
  'SLOW_RESPONSE',
] as const satisfies readonly PoseLabFunctionalProfileId[]

const UPPER_BODY_ACTIONS = [
  'MOVE_LEFT',
  'MOVE_RIGHT',
  'LEAN_LEFT',
  'LEAN_RIGHT',
  'REACH',
  'REACH_LEFT',
  'REACH_RIGHT',
] as const satisfies readonly MotionActionId[]

const LOWER_BODY_ACTIONS = [
  'SQUAT',
  'JUMP',
] as const satisfies readonly MotionActionId[]

export function toggleFunctionalProfile(
  current: readonly PoseLabFunctionalProfileId[],
  selected: PoseLabFunctionalProfileId,
): readonly PoseLabFunctionalProfileId[] {
  if (selected === 'STANDARD') return ['STANDARD']
  const active = new Set(current.filter((profile) => profile !== 'STANDARD'))
  if (selected === 'SEATED' || selected === 'UPPER_BODY') {
    active.delete('SEATED')
    active.delete('UPPER_BODY')
    active.add(selected)
    return FUNCTIONAL_PROFILE_ORDER.filter((profile) => active.has(profile))
  }
  if (active.has(selected)) active.delete(selected)
  else active.add(selected)
  const ordered = FUNCTIONAL_PROFILE_ORDER.filter((profile) => active.has(profile))
  return ordered.length > 0 ? ordered : ['STANDARD']
}

export function describePoseTestMode(
  source: 'STANDARD' | 'CALIBRATION_V1',
  profiles: readonly PoseLabFunctionalProfileId[],
): string {
  const isStandardProfile = profiles.includes('STANDARD')
  const labels = [
    source === 'CALIBRATION_V1'
      ? '校正值'
      : isStandardProfile
        ? 'STANDARD 固定門檻'
        : 'STANDARD 基準',
  ]
  if (profiles.includes('SEATED')) labels.push('坐姿模式')
  if (profiles.includes('UPPER_BODY')) labels.push('上半身模式')
  if (profiles.includes('LOW_MOTION')) labels.push('較小動作範圍')
  if (profiles.includes('SLOW_RESPONSE')) labels.push('較慢反應速度')
  if (labels.length === 1) labels.push('標準動作')
  return labels.join(' · ')
}

export function getPoseModeCapabilities(
  profiles: readonly PoseLabFunctionalProfileId[],
): {
  readonly available: readonly MotionActionId[]
  readonly unavailable: readonly MotionActionId[]
} {
  const upperBodyMode =
    profiles.includes('SEATED') || profiles.includes('UPPER_BODY')
  return upperBodyMode
    ? { available: UPPER_BODY_ACTIONS, unavailable: LOWER_BODY_ACTIONS }
    : {
        available: [...UPPER_BODY_ACTIONS, ...LOWER_BODY_ACTIONS],
        unavailable: [],
      }
}
