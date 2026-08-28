import type { PoseSensorFrame } from '../poseTypes'

export interface PoseWorkerInitMessage {
  readonly type: 'INIT'
  readonly wasmBaseUrl: string
  readonly modelAssetUrl: string
}

export interface PoseWorkerFrameMessage {
  readonly type: 'FRAME'
  readonly requestId: number
  readonly timestampMs: number
  readonly sourceWidth: number
  readonly sourceHeight: number
  readonly bitmap: ImageBitmap
}

export interface PoseWorkerCloseMessage {
  readonly type: 'CLOSE'
}

export type PoseWorkerInboundMessage =
  | PoseWorkerInitMessage
  | PoseWorkerFrameMessage
  | PoseWorkerCloseMessage

export interface PoseWorkerReadyMessage {
  readonly type: 'READY'
}

export interface PoseWorkerResultMessage {
  readonly type: 'RESULT'
  readonly requestId: number
  readonly inferenceDurationMs: number
  readonly frame: PoseSensorFrame
}

export interface PoseWorkerErrorMessage {
  readonly type: 'ERROR'
  readonly code: 'MODEL_LOAD_FAILED' | 'WORKER_INIT_FAILED' | 'INFERENCE_FAILED'
  readonly message: string
  readonly requestId?: number | undefined
}

export interface PoseWorkerClosedMessage {
  readonly type: 'CLOSED'
}

export type PoseWorkerOutboundMessage =
  | PoseWorkerReadyMessage
  | PoseWorkerResultMessage
  | PoseWorkerErrorMessage
  | PoseWorkerClosedMessage

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPoseSensorFrame(value: unknown): value is PoseSensorFrame {
  if (!isRecord(value)) return false
  return (
    typeof value.timestampMs === 'number' &&
    typeof value.sourceWidth === 'number' &&
    typeof value.sourceHeight === 'number' &&
    Array.isArray(value.poses)
  )
}

export function isPoseWorkerInboundMessage(
  value: unknown,
): value is PoseWorkerInboundMessage {
  if (!isRecord(value) || typeof value.type !== 'string') return false
  if (value.type === 'CLOSE') return true
  if (value.type === 'INIT') {
    return (
      typeof value.wasmBaseUrl === 'string' &&
      typeof value.modelAssetUrl === 'string'
    )
  }
  if (value.type === 'FRAME') {
    return (
      typeof value.requestId === 'number' &&
      typeof value.timestampMs === 'number' &&
      typeof value.sourceWidth === 'number' &&
      typeof value.sourceHeight === 'number' &&
      isRecord(value.bitmap)
    )
  }
  return false
}

export function isPoseWorkerOutboundMessage(
  value: unknown,
): value is PoseWorkerOutboundMessage {
  if (!isRecord(value) || typeof value.type !== 'string') return false
  if (value.type === 'READY' || value.type === 'CLOSED') return true
  if (value.type === 'RESULT') {
    return (
      typeof value.requestId === 'number' &&
      typeof value.inferenceDurationMs === 'number' &&
      isPoseSensorFrame(value.frame)
    )
  }
  if (value.type === 'ERROR') {
    return (
      typeof value.code === 'string' &&
      typeof value.message === 'string' &&
      (value.requestId === undefined || typeof value.requestId === 'number')
    )
  }
  return false
}
