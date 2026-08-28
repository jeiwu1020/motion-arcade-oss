import { describe, expect, it, vi } from 'vitest'

import { InferenceScheduler } from './InferenceScheduler'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('InferenceScheduler', () => {
  it('respects the target interval and processes only new video frames', async () => {
    const infer = vi.fn(async (frame: string) => frame)
    const scheduler = new InferenceScheduler({ targetHz: 20, infer })
    scheduler.start()

    expect(await scheduler.tick(0, 0.01, async () => 'first')).toBe(true)
    expect(await scheduler.tick(20, 0.02, async () => 'too-soon')).toBe(false)
    expect(await scheduler.tick(50, 0.01, async () => 'duplicate')).toBe(false)
    expect(await scheduler.tick(50, 0.03, async () => 'second')).toBe(true)

    expect(infer).toHaveBeenCalledTimes(2)
  })

  it('never overlaps inference and drops rather than queues opportunities', async () => {
    const pending = deferred<string>()
    const infer = vi.fn(() => pending.promise)
    const scheduler = new InferenceScheduler({ targetHz: 20, infer })
    scheduler.start()

    const first = scheduler.tick(0, 0.01, async () => 'first')
    expect(await scheduler.tick(50, 0.02, async () => 'dropped')).toBe(false)
    expect(scheduler.getStats().droppedInferenceFrames).toBe(1)
    expect(infer).toHaveBeenCalledOnce()

    pending.resolve('done')
    await first
  })

  it('does not create a frame when inference is not due', async () => {
    const createFrame = vi.fn(async () => 'frame')
    const scheduler = new InferenceScheduler({
      targetHz: 10,
      infer: vi.fn(async () => undefined),
    })
    scheduler.start()

    await scheduler.tick(0, 0.01, createFrame)
    await scheduler.tick(20, 0.02, createFrame)

    expect(createFrame).toHaveBeenCalledOnce()
  })

  it('stops future work and ignores a result that completes after stop', async () => {
    const pending = deferred<string>()
    const onResult = vi.fn()
    const scheduler = new InferenceScheduler({
      targetHz: 20,
      infer: vi.fn(() => pending.promise),
      onResult,
    })
    scheduler.start()

    const inFlight = scheduler.tick(0, 0.01, async () => 'frame')
    scheduler.stop()
    expect(await scheduler.tick(100, 0.02, async () => 'never')).toBe(false)
    pending.resolve('stale')
    await inFlight

    expect(onResult).not.toHaveBeenCalled()
  })

  it('resets stale timing and duplicate-frame state when restarted', async () => {
    const infer = vi.fn(async () => undefined)
    const scheduler = new InferenceScheduler({ targetHz: 20, infer })
    scheduler.start()
    await scheduler.tick(1_000, 3, async () => 'first')
    scheduler.stop()
    scheduler.start()

    expect(await scheduler.tick(1, 3, async () => 'restart')).toBe(true)
    expect(infer).toHaveBeenCalledTimes(2)
  })
})
