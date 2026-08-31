import { describe, expect, it } from 'vitest'

import {
  describePoseTestMode,
  getPoseModeCapabilities,
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

  it('selects seated and upper-body base modes without dropping range or timing modifiers', () => {
    expect(
      toggleFunctionalProfile(
        ['LOW_MOTION', 'SLOW_RESPONSE'],
        'SEATED',
      ),
    ).toEqual(['SEATED', 'LOW_MOTION', 'SLOW_RESPONSE'])
    expect(
      toggleFunctionalProfile(
        ['SEATED', 'LOW_MOTION'],
        'UPPER_BODY',
      ),
    ).toEqual(['UPPER_BODY', 'LOW_MOTION'])
  })

  it('labels all three base modes clearly', () => {
    expect(describePoseTestMode('STANDARD', ['SEATED'])).toBe(
      'STANDARD 基準 · 坐姿模式',
    )
    expect(describePoseTestMode('STANDARD', ['UPPER_BODY'])).toBe(
      'STANDARD 基準 · 上半身模式',
    )
  })

  it('reports exact available and unavailable actions for upper-body modes', () => {
    expect(getPoseModeCapabilities(['SEATED'])).toEqual({
      available: [
        'MOVE_LEFT',
        'MOVE_RIGHT',
        'LEAN_LEFT',
        'LEAN_RIGHT',
        'REACH',
        'REACH_LEFT',
        'REACH_RIGHT',
      ],
      unavailable: ['SQUAT', 'JUMP'],
    })
  })
})
