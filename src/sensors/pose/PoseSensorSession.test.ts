import { describe, expect, it, vi } from 'vitest'

import { PoseSensorSession } from './PoseSensorSession'

class LifecycleTarget {
  visibilityState: DocumentVisibilityState = 'visible'
  private readonly listeners = new Map<string, Set<() => void>>()

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener()
  }
}

function createHarness() {
  const camera = {
    start: vi.fn(async () => ({} as MediaStream)),
    stop: vi.fn(),
    getSettings: vi.fn(() => ({ width: 1280, height: 720 })),
  }
  const backend = {
    mode: 'WORKER' as const,
    initialize: vi.fn(async () => undefined),
    infer: vi.fn(async () => ({
      frame: {
        timestampMs: 0,
        sourceWidth: 1280,
        sourceHeight: 720,
        poses: [],
      },
      inferenceDurationMs: 1,
    })),
    close: vi.fn(async () => undefined),
  }
  const scheduler = {
    start: vi.fn(),
    stop: vi.fn(),
    tick: vi.fn(async () => false),
    getStats: vi.fn(() => ({
      targetHz: 20,
      completedInferences: 0,
      droppedInferenceFrames: 0,
    })),
  }
  let fatalInferenceError: ((error: unknown) => Promise<void>) | undefined
  const documentTarget = new LifecycleTarget()
  const windowTarget = new LifecycleTarget()
  const session = new PoseSensorSession({
    camera,
    createBackend: () => backend,
    createScheduler: (_backend, onFatalError) => {
      fatalInferenceError = onFatalError
      return scheduler
    },
    documentTarget,
    windowTarget,
  })

  return {
    camera,
    backend,
    scheduler,
    documentTarget,
    windowTarget,
    session,
    triggerFatalInferenceError: async (error: unknown) => {
      if (!fatalInferenceError) throw new Error('Fatal inference callback missing.')
      await fatalInferenceError(error)
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function flushLifecycleCleanup(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

describe('PoseSensorSession', () => {
  it('starts camera, backend, and scheduler in order and stops all three', async () => {
    const { camera, backend, scheduler, session } = createHarness()

    await session.start()
    expect(camera.start).toHaveBeenCalledOnce()
    expect(backend.initialize).toHaveBeenCalledOnce()
    expect(scheduler.start).toHaveBeenCalledOnce()
    expect(session.getState()).toBe('RUNNING')

    await session.stop()
    expect(scheduler.stop).toHaveBeenCalledOnce()
    expect(camera.stop).toHaveBeenCalledOnce()
    expect(backend.close).toHaveBeenCalledOnce()
    expect(session.getState()).toBe('STOPPED')
  })

  it('reports camera then pose initialization stages before baselining can begin', async () => {
    const cameraReady = deferred<MediaStream>()
    const backendReady = deferred<undefined>()
    const stages: string[] = []
    const harness = createHarness()
    harness.camera.start.mockReturnValueOnce(cameraReady.promise)
    vi.mocked(harness.backend.initialize).mockReturnValueOnce(backendReady.promise)
    const session = new PoseSensorSession({
      camera: harness.camera,
      createBackend: () => harness.backend,
      createScheduler: () => harness.scheduler,
      documentTarget: harness.documentTarget,
      windowTarget: harness.windowTarget,
      onStartupStageChange: (stage) => stages.push(stage),
    })

    const starting = session.start()
    await Promise.resolve()
    expect(stages).toEqual(['REQUESTING_CAMERA'])
    cameraReady.resolve({} as MediaStream)
    await Promise.resolve()
    await Promise.resolve()
    expect(stages).toEqual(['REQUESTING_CAMERA', 'INITIALIZING_POSE'])
    backendReady.resolve(undefined)
    await starting
  })

  it('releases camera if backend initialization fails', async () => {
    const { camera, backend, session } = createHarness()
    backend.initialize.mockRejectedValueOnce(new Error('model failed'))

    await expect(session.start()).rejects.toThrow('model failed')
    expect(camera.stop).toHaveBeenCalledOnce()
    expect(backend.close).toHaveBeenCalledOnce()
  })

  it('does not turn a cancelled, pending camera start into an error', async () => {
    const pendingCamera = deferred<MediaStream>()
    const harness = createHarness()
    harness.camera.start.mockReturnValueOnce(pendingCamera.promise)

    const starting = harness.session.start()
    await Promise.resolve()
    await harness.session.stop()
    pendingCamera.resolve({} as MediaStream)
    await starting

    expect(harness.session.getState()).toBe('STOPPED')
  })

  it('stops and releases a backend that finishes after startup was cancelled', async () => {
    const pendingBackend = deferred<undefined>()
    const harness = createHarness()
    vi.mocked(harness.backend.initialize).mockReturnValueOnce(pendingBackend.promise)

    const starting = harness.session.start()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    await harness.session.stop()
    pendingBackend.resolve(undefined)
    await starting

    expect(harness.backend.close).toHaveBeenCalledOnce()
    expect(harness.session.getState()).toBe('STOPPED')
  })

  it('suspends immediately when the document becomes hidden', async () => {
    const { camera, backend, scheduler, documentTarget, session } = createHarness()
    await session.start()

    documentTarget.visibilityState = 'hidden'
    documentTarget.dispatch('visibilitychange')
    await flushLifecycleCleanup()

    expect(scheduler.stop).toHaveBeenCalledOnce()
    expect(camera.stop).toHaveBeenCalledOnce()
    expect(backend.close).toHaveBeenCalledOnce()
    expect(session.getState()).toBe('SUSPENDED')
  })

  it('does not automatically restart when the page becomes visible again', async () => {
    const { camera, documentTarget, session } = createHarness()
    await session.start()
    documentTarget.visibilityState = 'hidden'
    documentTarget.dispatch('visibilitychange')
    await flushLifecycleCleanup()
    documentTarget.visibilityState = 'visible'
    documentTarget.dispatch('visibilitychange')
    await Promise.resolve()

    expect(camera.start).toHaveBeenCalledOnce()
    expect(session.getState()).toBe('SUSPENDED')
  })

  it('cleans up on pagehide and when disposed after leaving the lab', async () => {
    const first = createHarness()
    await first.session.start()
    first.windowTarget.dispatch('pagehide')
    await Promise.resolve()
    expect(first.camera.stop).toHaveBeenCalledOnce()

    const second = createHarness()
    await second.session.start()
    await second.session.dispose()
    expect(second.scheduler.stop).toHaveBeenCalledOnce()
    expect(second.camera.stop).toHaveBeenCalledOnce()
    expect(second.backend.close).toHaveBeenCalledOnce()
  })

  it('fails closed when a runtime inference error occurs', async () => {
    const { camera, backend, scheduler, session, triggerFatalInferenceError } =
      createHarness()
    await session.start()

    await triggerFatalInferenceError(new Error('inference failed'))

    expect(scheduler.stop).toHaveBeenCalledOnce()
    expect(camera.stop).toHaveBeenCalledOnce()
    expect(backend.close).toHaveBeenCalledOnce()
    expect(session.getState()).toBe('ERROR')
  })

  it('makes fatal inference cleanup idempotent', async () => {
    const { camera, backend, scheduler, session, triggerFatalInferenceError } =
      createHarness()
    await session.start()
    await triggerFatalInferenceError(new Error('inference failed'))
    await triggerFatalInferenceError(new Error('inference failed again'))

    expect(scheduler.stop).toHaveBeenCalledOnce()
    expect(camera.stop).toHaveBeenCalledOnce()
    expect(backend.close).toHaveBeenCalledOnce()
  })

  it('starts fresh resources after an inference failure', async () => {
    const camera = {
      start: vi.fn(async () => ({} as MediaStream)),
      stop: vi.fn(),
      getSettings: vi.fn(() => ({ width: 1280, height: 720 })),
    }
    const backends = [
      {
        mode: 'WORKER' as const,
        initialize: vi.fn(async () => undefined),
        infer: vi.fn(),
        close: vi.fn(async () => undefined),
      },
      {
        mode: 'WORKER' as const,
        initialize: vi.fn(async () => undefined),
        infer: vi.fn(),
        close: vi.fn(async () => undefined),
      },
    ]
    const schedulers = [
      { start: vi.fn(), stop: vi.fn(), tick: vi.fn(), getStats: vi.fn() },
      { start: vi.fn(), stop: vi.fn(), tick: vi.fn(), getStats: vi.fn() },
    ]
    let fatalInferenceError: ((error: unknown) => Promise<void>) | undefined
    const session = new PoseSensorSession({
      camera,
      createBackend: () => backends.shift()!,
      createScheduler: (_backend, onFatalError) => {
        fatalInferenceError = onFatalError
        return schedulers.shift()!
      },
      documentTarget: new LifecycleTarget(),
      windowTarget: new LifecycleTarget(),
    })

    await session.start()
    await fatalInferenceError!(new Error('inference failed'))
    await session.start()

    expect(camera.start).toHaveBeenCalledTimes(2)
    expect(session.getState()).toBe('RUNNING')
  })

  it('does not automatically reacquire the camera after an error', async () => {
    const {
      camera,
      documentTarget,
      session,
      triggerFatalInferenceError,
    } = createHarness()
    await session.start()
    await triggerFatalInferenceError(new Error('inference failed'))
    documentTarget.visibilityState = 'visible'
    documentTarget.dispatch('visibilitychange')
    await Promise.resolve()

    expect(camera.start).toHaveBeenCalledOnce()
    expect(session.getState()).toBe('ERROR')
  })
})
