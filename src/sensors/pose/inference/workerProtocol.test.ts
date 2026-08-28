import { describe, expect, it } from 'vitest'

import {
  isPoseWorkerInboundMessage,
  isPoseWorkerOutboundMessage,
} from './workerProtocol'

describe('pose worker protocol', () => {
  it('recognizes an init message with deterministic asset URLs', () => {
    expect(
      isPoseWorkerInboundMessage({
        type: 'INIT',
        wasmBaseUrl: '/vendor/mediapipe/wasm',
        modelAssetUrl:
          '/vendor/mediapipe/models/pose_landmarker_lite.task',
      }),
    ).toBe(true)
  })

  it('recognizes a frame message', () => {
    expect(
      isPoseWorkerInboundMessage({
        type: 'FRAME',
        requestId: 4,
        timestampMs: 120,
        sourceWidth: 1280,
        sourceHeight: 720,
        bitmap: {} as ImageBitmap,
      }),
    ).toBe(true)
  })

  it('recognizes close and closed lifecycle messages', () => {
    expect(isPoseWorkerInboundMessage({ type: 'CLOSE' })).toBe(true)
    expect(isPoseWorkerOutboundMessage({ type: 'CLOSED' })).toBe(true)
  })

  it('recognizes a MediaPipe-independent result DTO', () => {
    const message = {
      type: 'RESULT',
      requestId: 4,
      inferenceDurationMs: 8.5,
      frame: {
        timestampMs: 120,
        sourceWidth: 1280,
        sourceHeight: 720,
        poses: [
          {
            landmarks: [
              { x: 0.2, y: 0.3, z: -0.1, visibility: 0.9, presence: 0.8 },
            ],
          },
        ],
      },
    }

    expect(isPoseWorkerOutboundMessage(message)).toBe(true)
    expect(message.frame.poses[0]?.landmarks[0]).toEqual({
      x: 0.2,
      y: 0.3,
      z: -0.1,
      visibility: 0.9,
      presence: 0.8,
    })
  })

  it('recognizes concise errors and rejects unknown protocol data', () => {
    expect(
      isPoseWorkerOutboundMessage({
        type: 'ERROR',
        code: 'INFERENCE_FAILED',
        message: 'Pose inference failed.',
        requestId: 2,
      }),
    ).toBe(true)
    expect(isPoseWorkerInboundMessage({ type: 'SCREENSHOT' })).toBe(false)
    expect(isPoseWorkerOutboundMessage({ type: 'RAW_FRAME' })).toBe(false)
  })
})
