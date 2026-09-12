import { describe, expect, it } from 'vitest'

import type { PoseGameplayInputSnapshot } from '../../motion/runtime/PoseGameplayInputRuntime'
import {
  resolveCameraPresentation,
  type CameraPresentationGamePhase,
} from './cameraPresentationModel'

function snapshot(
  status: PoseGameplayInputSnapshot['status'],
): PoseGameplayInputSnapshot {
  return {
    status,
    error:
      status === 'ERROR'
        ? { code: 'CAMERA_BUSY', message: '相機正在被其他程式使用。' }
        : null,
  }
}

describe('camera presentation model', () => {
  it.each<
    readonly [
      PoseGameplayInputSnapshot['status'],
      CameraPresentationGamePhase,
      {
        readonly mode: string
        readonly cameraTreatment: string
        readonly framingGuide: string
        readonly overlay: string
        readonly headline: string | null
      },
    ]
  >([
    [
      'CAMERA_NOT_STARTED',
      'COUNTDOWN',
      {
        mode: 'SETUP',
        cameraTreatment: 'HIDDEN',
        framingGuide: 'HIDDEN',
        overlay: 'BLOCKING',
        headline: '準備好後啟動相機',
      },
    ],
    [
      'PERMISSION_STARTING',
      'COUNTDOWN',
      {
        mode: 'STARTING',
        cameraTreatment: 'DOMINANT',
        framingGuide: 'PROMINENT',
        overlay: 'GUIDANCE',
        headline: '正在開啟相機',
      },
    ],
    [
      'BASELINING',
      'COUNTDOWN',
      {
        mode: 'BASELINING',
        cameraTreatment: 'DOMINANT',
        framingGuide: 'PROMINENT',
        overlay: 'GUIDANCE',
        headline: '全身保持在框內',
      },
    ],
    [
      'READY',
      'COUNTDOWN',
      {
        mode: 'READY',
        cameraTreatment: 'DOMINANT',
        framingGuide: 'CONFIRMED',
        overlay: 'READY_BADGE',
        headline: '準備完成',
      },
    ],
    [
      'READY',
      'PLAYING',
      {
        mode: 'PLAYING',
        cameraTreatment: 'SUBDUED',
        framingGuide: 'SUBTLE',
        overlay: 'NONE',
        headline: null,
      },
    ],
    [
      'TRACKING_LOST',
      'PLAYING',
      {
        mode: 'TRACKING_LOST',
        cameraTreatment: 'DOMINANT',
        framingGuide: 'PROMINENT',
        overlay: 'GUIDANCE',
        headline: '請回到畫面中',
      },
    ],
    [
      'ERROR',
      'COUNTDOWN',
      {
        mode: 'ERROR',
        cameraTreatment: 'HIDDEN',
        framingGuide: 'HIDDEN',
        overlay: 'BLOCKING',
        headline: '無法使用姿勢辨識',
      },
    ],
  ])(
    'maps %s during %s to a projector-readable presentation',
    (status, phase, expected) => {
      expect(resolveCameraPresentation(snapshot(status), phase)).toMatchObject(
        expected,
      )
    },
  )

  it('keeps a healthy camera dimmed behind results', () => {
    expect(
      resolveCameraPresentation(snapshot('READY'), 'RESULT'),
    ).toMatchObject({
      mode: 'RESULT',
      cameraTreatment: 'DIMMED',
      framingGuide: 'HIDDEN',
      overlay: 'NONE',
    })
  })

  it('preserves the readable runtime error and offers retry', () => {
    expect(
      resolveCameraPresentation(snapshot('ERROR'), 'COUNTDOWN'),
    ).toMatchObject({
      detail: '相機正在被其他程式使用。',
      actionLabel: '重新啟動相機',
      alert: true,
    })
  })

  it('uses upper-body-specific setup and recovery guidance without changing the default full-body presentation', () => {
    const upperBodyBaseline = resolveCameraPresentation(
      snapshot('BASELINING'),
      'COUNTDOWN',
      'UPPER_BODY',
    )
    const upperBodyLoss = resolveCameraPresentation(
      snapshot('TRACKING_LOST'),
      'PLAYING',
      'UPPER_BODY',
    )

    expect(upperBodyBaseline).toMatchObject({
      framingRequirement: 'UPPER_BODY',
        headline: '請將上半身移到人形範圍內',
      detail: '讓頭部、肩膀與雙手清楚可見，雙手保持在畫面內。',
    })
    expect(upperBodyLoss.detail).toContain('頭部、肩膀與雙手')
    expect(resolveCameraPresentation(snapshot('BASELINING'), 'COUNTDOWN'))
      .toMatchObject({ framingRequirement: 'FULL_BODY', headline: '全身保持在框內' })
  })

  it('keeps brief active degradation non-blocking, uses a small soft-recovery hint, and reserves dominant recovery for hard pause', () => {
    const resolveActiveTracking = resolveCameraPresentation as unknown as (
      value: PoseGameplayInputSnapshot,
      phase: CameraPresentationGamePhase,
      framing: 'UPPER_BODY',
      tracking: 'DEGRADED' | 'SOFT_RECOVERY' | 'HARD_PAUSE',
    ) => ReturnType<typeof resolveCameraPresentation>

    expect(resolveActiveTracking(snapshot('TRACKING_LOST'), 'PLAYING', 'UPPER_BODY', 'DEGRADED'))
      .toMatchObject({ mode: 'PLAYING', overlay: 'NONE', framingGuide: 'SUBTLE' })
    expect(resolveActiveTracking(snapshot('TRACKING_LOST'), 'PLAYING', 'UPPER_BODY', 'SOFT_RECOVERY'))
      .toMatchObject({ mode: 'PLAYING', overlay: 'RECOVERY_HINT', headline: null, detail: '雙手回到畫面即可繼續拍擊' })
    expect(resolveActiveTracking(snapshot('TRACKING_LOST'), 'PLAYING', 'UPPER_BODY', 'HARD_PAUSE'))
      .toMatchObject({ mode: 'TRACKING_LOST', overlay: 'GUIDANCE', framingGuide: 'PROMINENT' })
  })
})
