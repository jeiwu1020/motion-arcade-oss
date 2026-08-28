import {
  CAMERA_CONSTRAINTS,
  type CameraEnvironment,
  type CameraErrorCode,
  type CameraSettings,
} from './cameraTypes'

const CAMERA_ERROR_MESSAGES: Readonly<Record<CameraErrorCode, string>> = {
  UNSUPPORTED: 'This browser does not provide camera access.',
  INSECURE_CONTEXT: 'Camera access requires HTTPS or localhost.',
  PERMISSION_DENIED: 'Camera permission was denied.',
  NO_CAMERA: 'No camera is available.',
  CAMERA_BUSY: 'The camera is unavailable or already in use.',
  VIDEO_START_FAILED: 'The camera opened, but the preview could not start.',
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

  constructor(
    video: HTMLVideoElement,
    environment: CameraEnvironment = defaultEnvironment(),
  ) {
    this.video = video
    this.environment = environment
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
      acquiredStream = await this.environment.mediaDevices!.getUserMedia(
        CAMERA_CONSTRAINTS,
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
      await this.video.play()
    } catch {
      this.stopStream(acquiredStream)
      this.stream = null
      this.video.srcObject = null
      throw new CameraControllerError('VIDEO_START_FAILED')
    }

    if (generation !== this.lifecycleGeneration) {
      this.stopStream(acquiredStream)
      if (this.stream === acquiredStream) this.stream = null
      this.video.srcObject = null
      throw new CameraControllerError('STOPPED')
    }

    return acquiredStream
  }

  private stopStream(stream: MediaStream | null): void {
    for (const track of stream?.getTracks() ?? []) track.stop()
  }
}
