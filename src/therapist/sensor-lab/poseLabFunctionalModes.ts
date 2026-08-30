import type { AbilityProfileId } from '../../motion/adaptive/profiles'

export type PoseLabFunctionalProfileId = Extract<
  AbilityProfileId,
  'STANDARD' | 'LOW_MOTION' | 'SLOW_RESPONSE'
>

const FUNCTIONAL_PROFILE_ORDER = [
  'LOW_MOTION',
  'SLOW_RESPONSE',
] as const satisfies readonly PoseLabFunctionalProfileId[]

export function toggleFunctionalProfile(
  current: readonly PoseLabFunctionalProfileId[],
  selected: PoseLabFunctionalProfileId,
): readonly PoseLabFunctionalProfileId[] {
  if (selected === 'STANDARD') return ['STANDARD']
  const active = new Set(current.filter((profile) => profile !== 'STANDARD'))
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
  if (profiles.includes('LOW_MOTION')) labels.push('較小動作範圍')
  if (profiles.includes('SLOW_RESPONSE')) labels.push('較慢反應速度')
  if (labels.length === 1) labels.push('標準動作')
  return labels.join(' · ')
}
