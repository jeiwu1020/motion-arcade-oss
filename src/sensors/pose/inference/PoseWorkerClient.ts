import { PoseBackendError } from './PoseBackendError'
import {
  POSE_MODEL_ASSET_URL,
  POSE_WASM_BASE_URL,
  type PoseInferenceBackend,
  type PoseInferenceInput,
} from './PoseInferenceBackend'
import type { PoseInferenceResult } from '../poseTypes'
import type {
  PoseWorkerErrorMessage,
  PoseWorkerOutboundMessage,
} from './workerProtocol'
import { isPoseWorkerOutboundMessage } from './workerProtocol'

interface PendingRequest {
  readonly resolve: (result: PoseInferenceResult) => void
  readonly reject: (error: PoseBackendError) => void
}

export class PoseWorkerClient implements PoseInferenceBackend {
  readonly mode = 'WORKER' as const
  private worker: Worker | null = null
  private readyPromise: Promise<void> | null = null
  private resolveReady: (() => void) | null = null
  private rejectReady: ((error: PoseBackendError) => void) | null = null
  private resolveClosed: (() => void) | null = null
  private requestId = 0
  private readonly pending = new Map<number, PendingRequest>()

  initialize(): Promise<void> {
    if (this.readyPromise) return this.readyPromise

    const worker = new Worker(new URL('./pose.worker.ts', import.meta.url), {
      type: 'module',
      name: 'motion-arcade-pose',
    })
    this.worker = worker
    worker.onmessage = this.handleMessage
    worker.onerror = () => {
      const error = new PoseBackendError(
        'WORKER_INIT_FAILED',
        'Pose worker could not start.',
      )
      this.rejectReady?.(error)
      this.rejectAll(error)
    }
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })
    worker.postMessage({
      type: 'INIT',
      wasmBaseUrl: POSE_WASM_BASE_URL,
      modelAssetUrl: POSE_MODEL_ASSET_URL,
    })
    return this.readyPromise
  }

  async infer(input: PoseInferenceInput): Promise<PoseInferenceResult> {
    if (!this.worker || !this.readyPromise) {
      input.bitmap.close()
      throw new PoseBackendError('CLOSED', 'Pose worker is not initialized.')
    }
    try {
      await this.readyPromise
    } catch (error) {
      input.bitmap.close()
      throw error
    }

    const requestId = ++this.requestId
    return new Promise<PoseInferenceResult>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      try {
        this.worker!.postMessage(
          {
            type: 'FRAME',
            requestId,
            timestampMs: input.timestampMs,
            sourceWidth: input.sourceWidth,
            sourceHeight: input.sourceHeight,
            bitmap: input.bitmap,
          },
          [input.bitmap],
        )
      } catch {
        this.pending.delete(requestId)
        input.bitmap.close()
        reject(
          new PoseBackendError(
            'INFERENCE_FAILED',
            'The video frame could not be transferred to the pose worker.',
          ),
        )
      }
    })
  }

  async close(): Promise<void> {
    const worker = this.worker
    const closedError = new PoseBackendError('CLOSED', 'Pose worker was closed.')
    this.rejectReady?.(closedError)
    this.worker = null
    this.readyPromise = null
    this.resolveReady = null
    this.rejectReady = null
    this.rejectAll(closedError)
    if (!worker) return
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const closed = new Promise<void>((resolve) => {
      this.resolveClosed = resolve
      timeoutId = setTimeout(resolve, 1_000)
    })
    worker.postMessage({ type: 'CLOSE' })
    await closed
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    this.resolveClosed = null
    worker.terminate()
  }

  private readonly handleMessage = (
    event: MessageEvent<PoseWorkerOutboundMessage>,
  ): void => {
    const message = event.data
    if (!isPoseWorkerOutboundMessage(message)) return
    if (message.type === 'READY') {
      this.resolveReady?.()
      this.resolveReady = null
      this.rejectReady = null
      return
    }
    if (message.type === 'RESULT') {
      const request = this.pending.get(message.requestId)
      this.pending.delete(message.requestId)
      request?.resolve({
        frame: message.frame,
        inferenceDurationMs: message.inferenceDurationMs,
      })
      return
    }
    if (message.type === 'ERROR') {
      this.handleError(message)
      return
    }
    if (message.type === 'CLOSED') {
      this.resolveClosed?.()
    }
  }

  private handleError(message: PoseWorkerErrorMessage): void {
    const error = new PoseBackendError(message.code, message.message)
    if (message.requestId !== undefined) {
      const request = this.pending.get(message.requestId)
      this.pending.delete(message.requestId)
      request?.reject(error)
    } else {
      this.rejectReady?.(error)
    }
  }

  private rejectAll(error: PoseBackendError): void {
    for (const request of this.pending.values()) request.reject(error)
    this.pending.clear()
  }
}
