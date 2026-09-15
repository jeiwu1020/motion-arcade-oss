import { afterEach, describe, expect, it, vi } from 'vitest'

import { PoseWorkerClient } from './PoseWorkerClient'

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  readonly messages: unknown[] = []
  terminated = false

  postMessage(message: unknown): void {
    this.messages.push(message)
  }

  terminate(): void {
    this.terminated = true
  }

  emit(message: unknown): void {
    this.onmessage?.({ data: message } as MessageEvent)
  }

  emitError(): void {
    this.onerror?.(new Event('error'))
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('PoseWorkerClient', () => {
  it('resolves once the worker reports READY', async () => {
    const worker = new FakeWorker()
    const client = new PoseWorkerClient({
      createWorker: () => worker as unknown as Worker,
      initializationTimeoutMs: 10,
    })

    const initialization = client.initialize()
    worker.emit({ type: 'READY' })

    await expect(initialization).resolves.toBeUndefined()
    expect(worker.messages).toContainEqual(expect.objectContaining({ type: 'INIT' }))
  })

  it('rejects typed worker INIT errors and terminates the worker', async () => {
    const worker = new FakeWorker()
    const client = new PoseWorkerClient({
      createWorker: () => worker as unknown as Worker,
      initializationTimeoutMs: 10,
    })

    const initialization = client.initialize()
    worker.emit({ type: 'ERROR', code: 'WORKER_INIT_FAILED', message: 'unsupported' })

    await expect(initialization).rejects.toMatchObject({ code: 'WORKER_INIT_FAILED' })
    expect(worker.terminated).toBe(true)
  })

  it('rejects worker.onerror during initialization and terminates the worker', async () => {
    const worker = new FakeWorker()
    const client = new PoseWorkerClient({
      createWorker: () => worker as unknown as Worker,
      initializationTimeoutMs: 10,
    })

    const initialization = client.initialize()
    worker.emitError()

    await expect(initialization).rejects.toMatchObject({ code: 'WORKER_INIT_FAILED' })
    expect(worker.terminated).toBe(true)
  })

  it('bounds initialization, terminates the timed-out worker, and can retry cleanly', async () => {
    vi.useFakeTimers()
    const first = new FakeWorker()
    const second = new FakeWorker()
    const workers = [first, second]
    const client = new PoseWorkerClient({
      createWorker: () => workers.shift() as unknown as Worker,
      initializationTimeoutMs: 10,
    })

    const timedOut = client.initialize()
    await vi.advanceTimersByTimeAsync(10)

    await expect(timedOut).rejects.toMatchObject({ code: 'WORKER_INIT_TIMEOUT' })
    expect(first.terminated).toBe(true)

    const retry = client.initialize()
    second.emit({ type: 'READY' })
    await expect(retry).resolves.toBeUndefined()
  })
})
