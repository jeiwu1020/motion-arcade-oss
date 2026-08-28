import { describe, expect, it, vi } from 'vitest'

import { CameraController, CameraControllerError } from './CameraController'
import { CAMERA_CONSTRAINTS } from './cameraTypes'

function createTrack(settings: MediaTrackSettings = {}) {
  return {
    getSettings: vi.fn(() => settings),
    stop: vi.fn(),
  }
}

function createStream(tracks = [createTrack()]) {
  return {
    getTracks: vi.fn(() => tracks),
    getVideoTracks: vi.fn(() => tracks),
  } as unknown as MediaStream
}

function createVideo() {
  return {
    srcObject: null,
    muted: false,
    playsInline: false,
    play: vi.fn(async () => undefined),
  } as unknown as HTMLVideoElement
}

describe('CameraController', () => {
  it('requests front-facing video with audio disabled and attaches the stream', async () => {
    const stream = createStream()
    const getUserMedia = vi.fn(async () => stream)
    const video = createVideo()
    const controller = new CameraController(video, {
      isSecureContext: true,
      mediaDevices: { getUserMedia },
    })

    await expect(controller.start()).resolves.toBe(stream)

    expect(getUserMedia).toHaveBeenCalledWith(CAMERA_CONSTRAINTS)
    expect(CAMERA_CONSTRAINTS.audio).toBe(false)
    expect(CAMERA_CONSTRAINTS.video).toMatchObject({
      facingMode: { ideal: 'user' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
    })
    expect(video.srcObject).toBe(stream)
    expect(video.muted).toBe(true)
    expect(video.playsInline).toBe(true)
    expect(video.play).toHaveBeenCalledOnce()
    expect(controller.isRunning()).toBe(true)
  })

  it('reuses an active stream rather than requesting another one', async () => {
    const stream = createStream()
    const getUserMedia = vi.fn(async () => stream)
    const controller = new CameraController(createVideo(), {
      isSecureContext: true,
      mediaDevices: { getUserMedia },
    })

    await controller.start()
    await expect(controller.start()).resolves.toBe(stream)
    expect(getUserMedia).toHaveBeenCalledOnce()
  })

  it('stops every track, detaches the stream, and is safe to stop twice', async () => {
    const tracks = [createTrack(), createTrack()]
    const stream = createStream(tracks)
    const video = createVideo()
    const controller = new CameraController(video, {
      isSecureContext: true,
      mediaDevices: { getUserMedia: vi.fn(async () => stream) },
    })

    await controller.start()
    controller.stop()
    controller.stop()

    expect(tracks[0]?.stop).toHaveBeenCalledOnce()
    expect(tracks[1]?.stop).toHaveBeenCalledOnce()
    expect(video.srcObject).toBeNull()
    expect(controller.getStream()).toBeNull()
    expect(controller.isRunning()).toBe(false)
  })

  it('supports start, stop, and start with a fresh stream', async () => {
    const first = createStream()
    const second = createStream()
    const getUserMedia = vi
      .fn<() => Promise<MediaStream>>()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
    const controller = new CameraController(createVideo(), {
      isSecureContext: true,
      mediaDevices: { getUserMedia },
    })

    await expect(controller.start()).resolves.toBe(first)
    controller.stop()
    await expect(controller.start()).resolves.toBe(second)
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })

  it('reports actual video track settings without exposing labels', async () => {
    const track = createTrack({
      width: 1280,
      height: 720,
      frameRate: 30,
      facingMode: 'user',
      deviceId: 'private-device-id',
    })
    const controller = new CameraController(createVideo(), {
      isSecureContext: true,
      mediaDevices: { getUserMedia: vi.fn(async () => createStream([track])) },
    })

    await controller.start()

    expect(controller.getSettings()).toEqual({
      width: 1280,
      height: 720,
      frameRate: 30,
      facingMode: 'user',
    })
  })

  it('maps permission denial to a typed error', async () => {
    const denied = new Error('denied')
    denied.name = 'NotAllowedError'
    const controller = new CameraController(createVideo(), {
      isSecureContext: true,
      mediaDevices: { getUserMedia: vi.fn(async () => Promise.reject(denied)) },
    })

    await expect(controller.start()).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    })
  })

  it('maps an unavailable mediaDevices API and insecure context', async () => {
    const unsupported = new CameraController(createVideo(), {
      isSecureContext: true,
      mediaDevices: undefined,
    })
    const insecure = new CameraController(createVideo(), {
      isSecureContext: false,
      mediaDevices: { getUserMedia: vi.fn() },
    })

    await expect(unsupported.start()).rejects.toEqual(
      new CameraControllerError('UNSUPPORTED'),
    )
    await expect(insecure.start()).rejects.toEqual(
      new CameraControllerError('INSECURE_CONTEXT'),
    )
  })

  it('stops acquired tracks if video playback fails', async () => {
    const track = createTrack()
    const video = createVideo()
    vi.mocked(video.play).mockRejectedValueOnce(new Error('play failed'))
    const controller = new CameraController(video, {
      isSecureContext: true,
      mediaDevices: {
        getUserMedia: vi.fn(async () => createStream([track])),
      },
    })

    await expect(controller.start()).rejects.toMatchObject({
      code: 'VIDEO_START_FAILED',
    })
    expect(track.stop).toHaveBeenCalledOnce()
    expect(video.srcObject).toBeNull()
  })
})
