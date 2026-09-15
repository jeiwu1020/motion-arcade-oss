import {
  CAMERA_CONSTRAINTS,
  type CameraEnvironment,
  type CameraErrorCode,
  type CameraSettings,
} from './cameraTypes'
import {
  POSE_STARTUP_TIMEOUTS,
  type PoseStartupTimeoutPolicy,
  withStartupTimeout,
} from '../startup/StartupTimeouts'

const CAMERA_ERROR_MESSAGES: Readonly<Record<CameraErrorCode, string>> = {
  UNSUPPORTED: 'This browser does not provide camera access.',
  INSECURE_CONTEXT: 'Camera access requires HTTPS or localhost.',
  PERMISSION_DENIED: 'Camera permission was denied.',
  NO_CAMERA: 'No camera is available.',
  CAMERA_BUSY: 'The camera is unavailable or already in use.',
  CAMERA_PERMISSION_TIMEOUT: 'Camera permission did not complete in time.',
  VIDEO_START_FAILED: 'The camera opened, but the preview could not start.',
  VIDEO_START_TIMEOUT: 'The camera preview did not start in time.',
  CAMERA_START_FAILED: 'The camera could not be started.',
  STOPPED: 'Camera startup was cancelled.',
}

export class CameraControllerError extends Error {
  readonly code: CameraErrorCode

  constructor(code: CameraErrorCode) {
    super(CAMERA_ERROR_MESSAGES[code])
    this.name = 'CameraControllerError'
    this.code = code
  }
}

function defaultEnvironment(): CameraEnvironment {
  return {
    isSecureContext: window.isSecureContext,
    mediaDevices: navigator.mediaDevices,
  }
}

function mapCameraError(error: unknown): CameraControllerError {
  if (error instanceof CameraControllerError) return error

  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new CameraControllerError('PERMISSION_DENIED')
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return new CameraControllerError('NO_CAMERA')
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return new CameraControllerError('CAMERA_BUSY')
  }
  return new CameraControllerError('CAMERA_START_FAILED')
}

export class CameraController {
  private stream: MediaStream | null = null
  private startPromise: Promise<MediaStream> | null = null
  private lifecycleGeneration = 0
  private readonly video: HTMLVideoElement
  private readonly environment: CameraEnvironment
  private readonly startupTimeouts: Pick<
    PoseStartupTimeoutPolicy,
    'cameraPermissionMs' | 'cameraPreviewMs'
  >

  constructor(
    video: HTMLVideoElement,
    environment: CameraEnvironment = defaultEnvironment(),
    startupTimeouts: Pick<
      PoseStartupTimeoutPolicy,
      'cameraPermissionMs' | 'cameraPreviewMs'
    > = POSE_STARTUP_TIMEOUTS,
  ) {
    this.video = video
    this.environment = environment
    this.startupTimeouts = startupTimeouts
  }

  start(): Promise<MediaStream> {
    if (this.stream) return Promise.resolve(this.stream)
    if (this.startPromise) return this.startPromise
    if (!this.environment.isSecureContext) {
      return Promise.reject(new CameraControllerError('INSECURE_CONTEXT'))
    }
    if (!this.environment.mediaDevices?.getUserMedia) {
      return Promise.reject(new CameraControllerError('UNSUPPORTED'))
    }

    const generation = this.lifecycleGeneration
    const startPromise = this.acquireAndAttach(generation)
    this.startPromise = startPromise
    void startPromise.finally(() => {
      if (this.startPromise === startPromise) this.startPromise = null
    }).catch(() => undefined)
    return startPromise
  }

  stop(): void {
    this.lifecycleGeneration += 1
    this.startPromise = null
    this.stopStream(this.stream)
    this.stream = null
    this.video.srcObject = null
  }

  isRunning(): boolean {
    return this.stream !== null
  }

  getStream(): MediaStream | null {
    return this.stream
  }

  getSettings(): CameraSettings | null {
    const settings = this.stream?.getVideoTracks()[0]?.getSettings()
    if (!settings) return null
    return {
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate,
      facingMode: settings.facingMode,
    }
  }

  private async acquireAndAttach(generation: number): Promise<MediaStream> {
    let acquiredStream: MediaStream
    try {
      acquiredStream = await withStartupTimeout(
        this.environment.mediaDevices!.getUserMedia(CAMERA_CONSTRAINTS),
        this.startupTimeouts.cameraPermissionMs,
        () => new CameraControllerError('CAMERA_PERMISSION_TIMEOUT'),
        () => this.cancelGeneration(generation),
      )
    } catch (error) {
      throw mapCameraError(error)
    }

    if (generation !== this.lifecycleGeneration) {
      this.stopStream(acquiredStream)
      throw new CameraControllerError('STOPPED')
    }

    this.stream = acquiredStream
    this.video.muted = true
    this.video.playsInline = true
    this.video.srcObject = acquiredStream

    try {
      await withStartupTimeout(
        this.video.play(),
        this.startupTimeouts.cameraPreviewMs,
        () => new CameraControllerError('VIDEO_START_TIMEOUT'),
        () => this.cancelGeneration(generation),
      )
    } catch (error) {
      this.stopStream(acquiredStream)
      if (this.stream === acquiredStream) this.stream = null
      if (this.video.srcObject === acquiredStream) this.video.srcObject = null
      if (error instanceof CameraControllerError) throw error
      throw new CameraControllerError('VIDEO_START_FAILED')
    }

    if (generation !== this.lifecycleGeneration) {
      this.stopStream(acquiredStream)
      if (this.stream === acquiredStream) this.stream = null
      if (this.video.srcObject === acquiredStream) this.video.srcObject = null
      throw new CameraControllerError('STOPPED')
    }

    return acquiredStream
  }

  private stopStream(stream: MediaStream | null): void {
    for (const track of stream?.getTracks() ?? []) track.stop()
  }

  private cancelGeneration(generation: number): void {
    if (this.lifecycleGeneration === generation) this.lifecycleGeneration += 1
  }
}
