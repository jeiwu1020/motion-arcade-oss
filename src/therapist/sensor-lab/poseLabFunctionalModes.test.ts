import { describe, expect, it } from 'vitest'

import {
  describePoseTestMode,
  toggleFunctionalProfile,
} from './poseLabFunctionalModes'

describe('Pose Lab functional mode selection', () => {
  it('composes LOW_MOTION and SLOW_RESPONSE in canonical order', () => {
    const lowMotion = toggleFunctionalProfile(['STANDARD'], 'LOW_MOTION')
    const combined = toggleFunctionalProfile(lowMotion, 'SLOW_RESPONSE')

    expect(lowMotion).toEqual(['LOW_MOTION'])
    expect(combined).toEqual(['LOW_MOTION', 'SLOW_RESPONSE'])
    expect(
      toggleFunctionalProfile(['SLOW_RESPONSE'], 'LOW_MOTION'),
    ).toEqual(['LOW_MOTION', 'SLOW_RESPONSE'])
  })

  it('removes one dimension without resetting the other', () => {
    expect(
      toggleFunctionalProfile(
        ['LOW_MOTION', 'SLOW_RESPONSE'],
        'LOW_MOTION',
      ),
    ).toEqual(['SLOW_RESPONSE'])
  })

  it('returns to STANDARD explicitly', () => {
    expect(
      toggleFunctionalProfile(
        ['LOW_MOTION', 'SLOW_RESPONSE'],
        'STANDARD',
      ),
    ).toEqual(['STANDARD'])
  })

  it('describes calibration and functional dimensions without raw enum names', () => {
    expect(describePoseTestMode('STANDARD', ['STANDARD'])).toBe(
      'STANDARD 固定門檻 · 標準動作',
    )
    expect(describePoseTestMode('STANDARD', ['LOW_MOTION'])).toBe(
      'STANDARD 基準 · 較小動作範圍',
    )
    expect(
      describePoseTestMode('CALIBRATION_V1', [
        'LOW_MOTION',
        'SLOW_RESPONSE',
      ]),
    ).toBe('校正值 · 較小動作範圍 · 較慢反應速度')
  })
})
