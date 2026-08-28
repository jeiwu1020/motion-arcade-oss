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
  const documentTarget = new LifecycleTarget()
  const windowTarget = new LifecycleTarget()
  const session = new PoseSensorSession({
    camera,
    createBackend: () => backend,
    createScheduler: () => scheduler,
    documentTarget,
    windowTarget,
  })

  return { camera, backend, scheduler, documentTarget, windowTarget, session }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
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

  it('suspends immediately when the document becomes hidden', async () => {
    const { camera, backend, scheduler, documentTarget, session } = createHarness()
    await session.start()

    documentTarget.visibilityState = 'hidden'
    documentTarget.dispatch('visibilitychange')
    await Promise.resolve()

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
    await Promise.resolve()
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
})
