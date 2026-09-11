import type { PoseGameplayInputSnapshot } from '../../motion/runtime/PoseGameplayInputRuntime'

export type CameraPresentationGamePhase =
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'RESULT'

export type CameraPresentationMode =
  | 'SETUP'
  | 'STARTING'
  | 'BASELINING'
  | 'READY'
  | 'PLAYING'
  | 'TRACKING_LOST'
  | 'ERROR'
  | 'RESULT'

export type CameraTreatment =
  | 'HIDDEN'
  | 'DOMINANT'
  | 'SUBDUED'
  | 'DIMMED'

export type FramingGuideVisibility =
  | 'HIDDEN'
  | 'PROMINENT'
  | 'CONFIRMED'
  | 'SUBTLE'

export type CameraPresentationOverlay =
  | 'NONE'
  | 'BLOCKING'
  | 'GUIDANCE'
  | 'READY_BADGE'

export type CameraFramingRequirement = 'FULL_BODY' | 'UPPER_BODY'

export interface CameraPresentation {
  readonly mode: CameraPresentationMode
  readonly cameraTreatment: CameraTreatment
  readonly framingGuide: FramingGuideVisibility
  readonly framingRequirement: CameraFramingRequirement
  readonly overlay: CameraPresentationOverlay
  readonly statusLabel: string
  readonly eyebrow: string | null
  readonly headline: string | null
  readonly detail: string | null
  readonly actionLabel: string | null
  readonly alert: boolean
}

function presentation(
  value: Omit<CameraPresentation, 'framingRequirement'>,
  framingRequirement: CameraFramingRequirement,
): CameraPresentation {
  return Object.freeze({ ...value, framingRequirement })
}

export function resolveCameraPresentation(
  snapshot: PoseGameplayInputSnapshot,
  gamePhase: CameraPresentationGamePhase,
  framingRequirement: CameraFramingRequirement = 'FULL_BODY',
): CameraPresentation {
  const createPresentation = (
    value: Omit<CameraPresentation, 'framingRequirement'>,
  ) => presentation(value, framingRequirement)
  const upperBody = framingRequirement === 'UPPER_BODY'
  if (gamePhase === 'RESULT') {
    return createPresentation({
      mode: 'RESULT',
      cameraTreatment:
        snapshot.status === 'CAMERA_NOT_STARTED' || snapshot.status === 'ERROR'
          ? 'HIDDEN'
          : 'DIMMED',
      framingGuide: 'HIDDEN',
      overlay: 'NONE',
      statusLabel: '本局完成',
      eyebrow: null,
      headline: null,
      detail: null,
      actionLabel: null,
      alert: false,
    })
  }

  if (snapshot.status === 'READY' && gamePhase === 'PLAYING') {
    return createPresentation({
      mode: 'PLAYING',
      cameraTreatment: 'SUBDUED',
      framingGuide: 'SUBTLE',
      overlay: 'NONE',
      statusLabel: '遊戲進行中',
      eyebrow: null,
      headline: null,
      detail: null,
      actionLabel: null,
      alert: false,
    })
  }

  if (snapshot.status === 'CAMERA_NOT_STARTED') {
    return createPresentation({
      mode: 'SETUP',
      cameraTreatment: 'HIDDEN',
      framingGuide: 'HIDDEN',
      overlay: 'BLOCKING',
      statusLabel: '相機尚未啟動',
      eyebrow: 'FRONT CAMERA',
      headline: '準備好後啟動相機',
      detail: upperBody
        ? '按下後站到鏡頭前，讓頭部、肩膀與雙手都看得見。'
        : '按下後站到鏡頭前，讓頭頂到腳尖都看得見。',
      actionLabel: '啟動相機',
      alert: false,
    })
  }

  if (snapshot.status === 'PERMISSION_STARTING') {
    return createPresentation({
      mode: 'STARTING',
      cameraTreatment: 'DOMINANT',
      framingGuide: 'PROMINENT',
      overlay: 'GUIDANCE',
      statusLabel: '正在啟動相機',
      eyebrow: '準備鏡頭',
      headline: '正在開啟相機',
      detail: upperBody
        ? '允許相機後，讓頭部、肩膀與雙手保持在框內。'
        : '允許相機後，站到全身都在框內的位置。',
      actionLabel: null,
      alert: false,
    })
  }

  if (snapshot.status === 'BASELINING') {
    return createPresentation({
      mode: 'BASELINING',
      cameraTreatment: 'DOMINANT',
      framingGuide: 'PROMINENT',
      overlay: 'GUIDANCE',
      statusLabel: '正在確認站位',
      eyebrow: '站位確認',
      headline: upperBody ? '上半身保持在框內' : '全身保持在框內',
      detail: upperBody
        ? '讓頭部、肩膀與雙手清楚可見，左右留出揮手空間。'
        : '面向鏡頭，讓肩膀、髖部、膝蓋與腳踝都清楚可見。',
      actionLabel: null,
      alert: false,
    })
  }

  if (snapshot.status === 'READY') {
    return createPresentation({
      mode: 'READY',
      cameraTreatment: 'DOMINANT',
      framingGuide: 'CONFIRMED',
      overlay: 'READY_BADGE',
      statusLabel: '準備完成',
      eyebrow: 'READY',
      headline: '準備完成',
      detail: '保持站位，倒數後開始。',
      actionLabel: null,
      alert: false,
    })
  }

  if (snapshot.status === 'TRACKING_LOST') {
    return createPresentation({
      mode: 'TRACKING_LOST',
      cameraTreatment: 'DOMINANT',
      framingGuide: 'PROMINENT',
      overlay: 'GUIDANCE',
      statusLabel: '遊戲已暫停',
      eyebrow: '遊戲已暫停',
      headline: '請回到畫面中',
      detail: upperBody
        ? '讓頭部、肩膀與雙手重新回到框內，準備好後會自動繼續。'
        : '讓頭頂到腳尖重新回到框內，準備好後會自動繼續。',
      actionLabel: null,
      alert: false,
    })
  }

  return createPresentation({
    mode: 'ERROR',
    cameraTreatment: 'HIDDEN',
    framingGuide: 'HIDDEN',
    overlay: 'BLOCKING',
    statusLabel: '需要重新啟動',
    eyebrow: '相機需要處理',
    headline: '無法使用姿勢辨識',
    detail: snapshot.error?.message ?? '相機或姿勢辨識已停止。',
    actionLabel: '重新啟動相機',
    alert: true,
  })
}
