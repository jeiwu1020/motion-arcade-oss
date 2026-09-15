import { afterEach, describe, expect, it, vi } from 'vitest'

import { MainThreadPoseBackend } from './MainThreadPoseBackend'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function createLandmarker() {
  return { close: vi.fn(), detectForVideo: vi.fn() }
}

afterEach(() => vi.useRealTimers())

describe('MainThreadPoseBackend', () => {
  it('bounds fallback initialization and closes a late-created landmarker', async () => {
    vi.useFakeTimers()
    const pending = deferred<ReturnType<typeof createLandmarker>>()
    const backend = new MainThreadPoseBackend({
      initializationTimeoutMs: 10,
      createLandmarker: () => pending.promise as never,
    })

    const initialization = backend.initialize()
    await vi.advanceTimersByTimeAsync(10)
    await expect(initialization).rejects.toMatchObject({ code: 'MODEL_LOAD_TIMEOUT' })

    const lateLandmarker = createLandmarker()
    pending.resolve(lateLandmarker)
    await Promise.resolve()
    expect(lateLandmarker.close).toHaveBeenCalledOnce()
  })

  it('can initialize cleanly after a timed-out fallback attempt', async () => {
    vi.useFakeTimers()
    const pending = deferred<ReturnType<typeof createLandmarker>>()
    const readyLandmarker = createLandmarker()
    const createLandmarkerAttempt = vi
      .fn<() => Promise<ReturnType<typeof createLandmarker>>>()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(readyLandmarker)
    const backend = new MainThreadPoseBackend({
      initializationTimeoutMs: 10,
      createLandmarker: () => createLandmarkerAttempt() as never,
    })

    const timedOut = backend.initialize()
    await vi.advanceTimersByTimeAsync(10)
    await expect(timedOut).rejects.toMatchObject({ code: 'MODEL_LOAD_TIMEOUT' })
    await expect(backend.initialize()).resolves.toBeUndefined()

    await backend.close()
    expect(readyLandmarker.close).toHaveBeenCalledOnce()
  })
})
