import {
  POSE_STARTUP_TIMEOUTS,
  type PoseStartupTimeoutPolicy,
  withStartupTimeout,
} from '../../startup/StartupTimeouts'
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

export interface PoseWorkerClientOptions {
  readonly createWorker?: (() => Worker) | undefined
  readonly initializationTimeoutMs?: number | undefined
}

export class PoseWorkerClient implements PoseInferenceBackend {
  readonly mode = 'WORKER' as const
  private worker: Worker | null = null
  private readyPromise: Promise<void> | null = null
  private resolveReady: (() => void) | null = null
  private rejectReady: ((error: PoseBackendError) => void) | null = null
  private initializing = false
  private requestId = 0
  private readonly pending = new Map<number, PendingRequest>()
  private readonly createWorker: () => Worker
  private readonly initializationTimeoutMs: PoseStartupTimeoutPolicy['workerInitializationMs']

  constructor(options: PoseWorkerClientOptions = {}) {
    this.createWorker = options.createWorker ?? (() => new Worker(
      new URL('./pose.worker.ts', import.meta.url),
      { type: 'module', name: 'motion-arcade-pose' },
    ))
    this.initializationTimeoutMs =
      options.initializationTimeoutMs ?? POSE_STARTUP_TIMEOUTS.workerInitializationMs
  }

  initialize(): Promise<void> {
    if (this.readyPromise) return this.readyPromise

    let worker: Worker
    try {
      worker = this.createWorker()
    } catch {
      return Promise.reject(
        new PoseBackendError('WORKER_INIT_FAILED', 'Pose worker could not start.'),
      )
    }
    this.worker = worker
    this.initializing = true
    worker.onmessage = this.handleMessage
    worker.onerror = () => {
      const error = new PoseBackendError(
        this.initializing ? 'WORKER_INIT_FAILED' : 'INFERENCE_FAILED',
        this.initializing
          ? 'Pose worker could not start.'
          : 'Pose worker stopped unexpectedly.',
      )
      if (this.initializing) this.failInitialization(worker, error)
      else this.failActiveWorker(worker, error)
    }

    const ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })
    const readyPromise = withStartupTimeout(
      ready,
      this.initializationTimeoutMs,
      () => new PoseBackendError(
        'WORKER_INIT_TIMEOUT',
        'Pose worker initialization timed out.',
      ),
      () => this.failInitialization(
        worker,
        new PoseBackendError(
          'WORKER_INIT_TIMEOUT',
          'Pose worker initialization timed out.',
        ),
      ),
    )
    this.readyPromise = readyPromise
    void readyPromise.catch(() => {
      if (this.readyPromise === readyPromise) this.readyPromise = null
    })

    try {
      worker.postMessage({
        type: 'INIT',
        wasmBaseUrl: POSE_WASM_BASE_URL,
        modelAssetUrl: POSE_MODEL_ASSET_URL,
      })
    } catch {
      this.failInitialization(
        worker,
        new PoseBackendError('WORKER_INIT_FAILED', 'Pose worker could not start.'),
      )
    }
    return readyPromise
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
        reject(new PoseBackendError(
          'INFERENCE_FAILED',
          'The video frame could not be transferred to the pose worker.',
        ))
      }
    })
  }

  async close(): Promise<void> {
    const worker = this.worker
    this.worker = null
    this.readyPromise = null
    this.initializing = false
    const closedError = new PoseBackendError('CLOSED', 'Pose worker was closed.')
    this.rejectReady?.(closedError)
    this.resolveReady = null
    this.rejectReady = null
    this.rejectAll(closedError)
    if (!worker) return
    worker.onmessage = null
    worker.onerror = null
    try {
      worker.postMessage({ type: 'CLOSE' })
    } catch {
      // Termination below is the deterministic cleanup path.
    }
    worker.terminate()
  }

  private readonly handleMessage = (
    event: MessageEvent<PoseWorkerOutboundMessage>,
  ): void => {
    const message = event.data
    if (!isPoseWorkerOutboundMessage(message)) return
    if (message.type === 'READY') {
      this.initializing = false
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
    if (message.type === 'ERROR') this.handleError(message)
  }

  private handleError(message: PoseWorkerErrorMessage): void {
    const error = new PoseBackendError(message.code, message.message)
    if (message.requestId !== undefined) {
      const request = this.pending.get(message.requestId)
      this.pending.delete(message.requestId)
      request?.reject(error)
      return
    }
    if (this.initializing && this.worker) {
      this.failInitialization(this.worker, error)
      return
    }
    this.rejectAll(error)
  }

  private failInitialization(worker: Worker, error: PoseBackendError): void {
    if (this.worker !== worker) return
    this.worker = null
    this.initializing = false
    worker.onmessage = null
    worker.onerror = null
    worker.terminate()
    this.rejectReady?.(error)
    this.resolveReady = null
    this.rejectReady = null
    this.rejectAll(error)
  }

  private failActiveWorker(worker: Worker, error: PoseBackendError): void {
    if (this.worker !== worker) return
    this.worker = null
    worker.onmessage = null
    worker.onerror = null
    worker.terminate()
    this.rejectAll(error)
  }

  private rejectAll(error: PoseBackendError): void {
    for (const request of this.pending.values()) request.reject(error)
    this.pending.clear()
  }
}
