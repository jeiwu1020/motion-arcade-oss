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

export interface CameraPresentation {
  readonly mode: CameraPresentationMode
  readonly cameraTreatment: CameraTreatment
  readonly framingGuide: FramingGuideVisibility
  readonly overlay: CameraPresentationOverlay
  readonly statusLabel: string
  readonly eyebrow: string | null
  readonly headline: string | null
  readonly detail: string | null
  readonly actionLabel: string | null
  readonly alert: boolean
}

function presentation(
  value: CameraPresentation,
): CameraPresentation {
  return Object.freeze(value)
}

export function resolveCameraPresentation(
  snapshot: PoseGameplayInputSnapshot,
  gamePhase: CameraPresentationGamePhase,
): CameraPresentation {
  if (gamePhase === 'RESULT') {
    return presentation({
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
    return presentation({
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
    return presentation({
      mode: 'SETUP',
      cameraTreatment: 'HIDDEN',
      framingGuide: 'HIDDEN',
      overlay: 'BLOCKING',
      statusLabel: '相機尚未啟動',
      eyebrow: 'FRONT CAMERA',
      headline: '準備好後啟動相機',
      detail: '按下後站到鏡頭前，讓頭頂到腳尖都看得見。',
      actionLabel: '啟動相機',
      alert: false,
    })
  }

  if (snapshot.status === 'PERMISSION_STARTING') {
    return presentation({
      mode: 'STARTING',
      cameraTreatment: 'DOMINANT',
      framingGuide: 'PROMINENT',
      overlay: 'GUIDANCE',
      statusLabel: '正在啟動相機',
      eyebrow: '準備鏡頭',
      headline: '正在開啟相機',
      detail: '允許相機後，站到全身都在框內的位置。',
      actionLabel: null,
      alert: false,
    })
  }

  if (snapshot.status === 'BASELINING') {
    return presentation({
      mode: 'BASELINING',
      cameraTreatment: 'DOMINANT',
      framingGuide: 'PROMINENT',
      overlay: 'GUIDANCE',
      statusLabel: '正在確認站位',
      eyebrow: '站位確認',
      headline: '全身保持在框內',
      detail: '面向鏡頭，讓肩膀、髖部、膝蓋與腳踝都清楚可見。',
      actionLabel: null,
      alert: false,
    })
  }

  if (snapshot.status === 'READY') {
    return presentation({
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
    return presentation({
      mode: 'TRACKING_LOST',
      cameraTreatment: 'DOMINANT',
      framingGuide: 'PROMINENT',
      overlay: 'GUIDANCE',
      statusLabel: '遊戲已暫停',
      eyebrow: '遊戲已暫停',
      headline: '請回到畫面中',
      detail: '讓頭頂到腳尖重新回到框內，準備好後會自動繼續。',
      actionLabel: null,
      alert: false,
    })
  }

  return presentation({
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
