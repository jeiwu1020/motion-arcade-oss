import {
  FilesetResolver,
  PoseLandmarker,
} from '@mediapipe/tasks-vision'

import { copyPoseLandmarkerResult } from './mediapipePoseAdapter'
import type {
  PoseWorkerInboundMessage,
  PoseWorkerOutboundMessage,
} from './workerProtocol'

interface WorkerScope {
  onmessage: ((event: MessageEvent<PoseWorkerInboundMessage>) => void) | null
  postMessage(message: PoseWorkerOutboundMessage): void
  close(): void
}

const workerScope = self as unknown as WorkerScope
let landmarker: PoseLandmarker | null = null
let closed = false

function postError(
  code: 'MODEL_LOAD_FAILED' | 'WORKER_INIT_FAILED' | 'INFERENCE_FAILED',
  message: string,
  requestId?: number,
): void {
  workerScope.postMessage({ type: 'ERROR', code, message, requestId })
}

async function initialize(
  wasmBaseUrl: string,
  modelAssetUrl: string,
): Promise<void> {
  if (typeof OffscreenCanvas === 'undefined') {
    postError(
      'WORKER_INIT_FAILED',
      'OffscreenCanvas is unavailable in this worker runtime.',
    )
    return
  }

  let fileset
  try {
    fileset = await FilesetResolver.forVisionTasks(wasmBaseUrl, true)
  } catch {
    postError(
      'WORKER_INIT_FAILED',
      'Pose worker runtime could not be initialized.',
    )
    return
  }

  try {
    landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelAssetUrl },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    })
    workerScope.postMessage({ type: 'READY' })
  } catch {
    postError(
      'MODEL_LOAD_FAILED',
      'Pose Landmarker Lite model could not be initialized.',
    )
  }
}

function infer(message: Extract<PoseWorkerInboundMessage, { type: 'FRAME' }>): void {
  if (!landmarker || closed) {
    message.bitmap.close()
    postError(
      'INFERENCE_FAILED',
      'Pose worker is not ready.',
      message.requestId,
    )
    return
  }

  const startedAt = performance.now()
  try {
    const result = landmarker.detectForVideo(message.bitmap, message.timestampMs)
    try {
      workerScope.postMessage({
        type: 'RESULT',
        requestId: message.requestId,
        inferenceDurationMs: performance.now() - startedAt,
        frame: copyPoseLandmarkerResult(
          result,
          message.timestampMs,
          message.sourceWidth,
          message.sourceHeight,
        ),
      })
    } finally {
      result.close()
    }
  } catch {
    postError('INFERENCE_FAILED', 'Pose inference failed.', message.requestId)
  } finally {
    message.bitmap.close()
  }
}

async function closeWorker(): Promise<void> {
  closed = true
  landmarker?.close()
  landmarker = null
  workerScope.postMessage({ type: 'CLOSED' })
  workerScope.close()
}

workerScope.onmessage = (event) => {
  const message = event.data
  if (message.type === 'INIT') {
    void initialize(message.wasmBaseUrl, message.modelAssetUrl)
  } else if (message.type === 'FRAME') {
    infer(message)
  } else {
    void closeWorker()
  }
}
