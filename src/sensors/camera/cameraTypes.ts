export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'user' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  },
}

export type CameraErrorCode =
  | 'UNSUPPORTED'
  | 'INSECURE_CONTEXT'
  | 'PERMISSION_DENIED'
  | 'NO_CAMERA'
  | 'CAMERA_BUSY'
  | 'CAMERA_PERMISSION_TIMEOUT'
  | 'VIDEO_START_FAILED'
  | 'VIDEO_START_TIMEOUT'
  | 'CAMERA_START_FAILED'
  | 'STOPPED'

export interface CameraSettings {
  readonly width?: number | undefined
  readonly height?: number | undefined
  readonly frameRate?: number | undefined
  readonly facingMode?: string | undefined
}

export interface CameraEnvironment {
  readonly isSecureContext: boolean
  readonly mediaDevices?: Pick<MediaDevices, 'getUserMedia'> | undefined
}
