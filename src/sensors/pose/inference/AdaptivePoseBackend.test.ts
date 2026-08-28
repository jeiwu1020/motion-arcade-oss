import { describe, expect, it, vi } from 'vitest'

import { PoseBackendError } from './PoseBackendError'
import { AdaptivePoseBackend } from './AdaptivePoseBackend'
import type { PoseInferenceBackend } from './PoseInferenceBackend'

type AdaptiveBackendOptions = {
  readonly workerAvailable: () => boolean
  readonly createWorkerBackend: () => PoseInferenceBackend
  readonly createFallbackBackend: () => PoseInferenceBackend
}

const TestableAdaptivePoseBackend = AdaptivePoseBackend as unknown as {
  new (options: AdaptiveBackendOptions): AdaptivePoseBackend
}

function createBackend(mode: PoseInferenceBackend['mode']): PoseInferenceBackend {
  return {
    mode,
    initialize: vi.fn(async () => undefined),
    infer: vi.fn(),
    close: vi.fn(async () => undefined),
  }
}

describe('AdaptivePoseBackend', () => {
  it('uses the main-thread fallback when Worker is unavailable', async () => {
    const fallback = createBackend('MAIN_THREAD_FALLBACK')
    const backend = new TestableAdaptivePoseBackend({
      workerAvailable: () => false,
      createWorkerBackend: () => createBackend('WORKER'),
      createFallbackBackend: () => fallback,
    })

    await backend.initialize()

    expect(backend.mode).toBe('MAIN_THREAD_FALLBACK')
    expect(backend.fallbackReason).toBe('Web Worker is unavailable.')
    expect(fallback.initialize).toHaveBeenCalledOnce()
  })

  it('uses the main-thread fallback for a worker runtime initialization failure', async () => {
    const worker = createBackend('WORKER')
    worker.initialize = vi.fn(async () => {
      throw new PoseBackendError('WORKER_INIT_FAILED', 'Worker runtime unsupported.')
    })
    const fallback = createBackend('MAIN_THREAD_FALLBACK')
    const backend = new TestableAdaptivePoseBackend({
      workerAvailable: () => true,
      createWorkerBackend: () => worker,
      createFallbackBackend: () => fallback,
    })

    await backend.initialize()

    expect(worker.close).toHaveBeenCalledOnce()
    expect(fallback.initialize).toHaveBeenCalledOnce()
    expect(backend.mode).toBe('MAIN_THREAD_FALLBACK')
  })

  it('does not hide a genuine model load failure behind the fallback', async () => {
    const worker = createBackend('WORKER')
    worker.initialize = vi.fn(async () => {
      throw new PoseBackendError('MODEL_LOAD_FAILED', 'Model is invalid.')
    })
    const fallback = createBackend('MAIN_THREAD_FALLBACK')
    const backend = new TestableAdaptivePoseBackend({
      workerAvailable: () => true,
      createWorkerBackend: () => worker,
      createFallbackBackend: () => fallback,
    })

    await expect(backend.initialize()).rejects.toMatchObject({
      code: 'MODEL_LOAD_FAILED',
    })
    expect(worker.close).toHaveBeenCalledOnce()
    expect(fallback.initialize).not.toHaveBeenCalled()
  })
})
