import { afterEach, describe, expect, it, vi } from 'vitest'

import { MicrophoneAudioSource } from './MicrophoneAudioSource'

class FakeTrack extends EventTarget {
  stopCalls = 0

  stop(): void {
    this.stopCalls += 1
  }
}

class FakeStream {
  readonly track: FakeTrack

  constructor(track = new FakeTrack()) {
    this.track = track
  }

  getTracks(): readonly FakeTrack[] {
    return [this.track]
  }
}

class FakeNode {
  readonly connections: unknown[] = []
  disconnectCalls = 0

  connect(destination: unknown): unknown {
    this.connections.push(destination)
    return destination
  }

  disconnect(): void {
    this.disconnectCalls += 1
  }
}

class FakeAnalyser extends FakeNode {
  fftSize = 0
  samples = new Float32Array([0.1, -0.1, 0.1, -0.1])

  getFloatTimeDomainData(target: Float32Array): void {
    target.set(this.samples.subarray(0, target.length))
  }
}

class FakeAudioContext {
  readonly source = new FakeNode()
  readonly analyser = new FakeAnalyser()
  closeCalls = 0
  resumeCalls = 0
  failResume = false

  async resume(): Promise<void> {
    this.resumeCalls += 1
    if (this.failResume) throw new Error('resume failed')
  }

  async close(): Promise<void> {
    this.closeCalls += 1
  }

  createMediaStreamSource(_stream: unknown): FakeNode {
    return this.source
  }

  createAnalyser(): FakeAnalyser {
    return this.analyser
  }
}

class FakeDocumentTarget extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible'

  setVisibility(state: DocumentVisibilityState): void {
    this.visibilityState = state
    this.dispatchEvent(new Event('visibilitychange'))
  }
}

class FakeWindowTarget extends EventTarget {
  hidePage(): void {
    this.dispatchEvent(new Event('pagehide'))
  }
}

describe('MicrophoneAudioSource', () => {
  const sources: MicrophoneAudioSource[] = []

  afterEach(async () => {
    await Promise.all(sources.map((source) => source.dispose()))
  })

  function setup() {
    const stream = new FakeStream()
    const context = new FakeAudioContext()
    const documentTarget = new FakeDocumentTarget()
    const windowTarget = new FakeWindowTarget()
    const getUserMedia = vi.fn(async () => stream)
    const source = new MicrophoneAudioSource({
      mediaDevices: { getUserMedia },
      createAudioContext: () => context,
      documentTarget,
      windowTarget,
    })
    sources.push(source)
    return { source, stream, context, documentTarget, windowTarget, getUserMedia }
  }

  it('acquires the microphone only during explicit start and never routes it to speakers', async () => {
    const { source, context, getUserMedia } = setup()

    expect(getUserMedia).not.toHaveBeenCalled()
    expect(source.readTimeDomainSamples()).toBeNull()
    await source.start()

    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(getUserMedia).toHaveBeenCalledWith({
      video: false,
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    expect(context.source.connections).toEqual([context.analyser])
    expect(context.analyser.connections).toEqual([])
    expect(source.readTimeDomainSamples()).toEqual(context.analyser.samples)
  })

  it('stops tracks, disconnects the graph, closes context, and clears samples idempotently', async () => {
    const { source, stream, context } = setup()
    await source.start()

    await source.stop()
    await source.stop()

    expect(stream.track.stopCalls).toBe(1)
    expect(context.source.disconnectCalls).toBe(1)
    expect(context.analyser.disconnectCalls).toBe(1)
    expect(context.closeCalls).toBe(1)
    expect(source.isRunning()).toBe(false)
    expect(source.readTimeDomainSamples()).toBeNull()
  })

  it('cleans partial setup if audio context initialization fails', async () => {
    const { source, stream, context } = setup()
    context.failResume = true

    await expect(source.start()).rejects.toThrow('resume failed')

    expect(stream.track.stopCalls).toBe(1)
    expect(context.closeCalls).toBe(1)
    expect(source.isRunning()).toBe(false)
  })

  it('stops capture on hidden and does not reacquire it when visible again', async () => {
    const { source, stream, documentTarget, getUserMedia } = setup()
    await source.start()

    documentTarget.setVisibility('hidden')
    await Promise.resolve()

    expect(stream.track.stopCalls).toBe(1)
    expect(source.isRunning()).toBe(false)
    documentTarget.setVisibility('visible')
    await Promise.resolve()
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('stops capture on pagehide and on microphone device loss', async () => {
    const first = setup()
    await first.source.start()
    first.windowTarget.hidePage()
    await Promise.resolve()
    expect(first.stream.track.stopCalls).toBe(1)

    const second = setup()
    await second.source.start()
    second.stream.track.dispatchEvent(new Event('ended'))
    await Promise.resolve()
    expect(second.source.isRunning()).toBe(false)
    expect(second.source.readTimeDomainSamples()).toBeNull()
  })

  it('uses a fresh stream after stop and later explicit start', async () => {
    const first = new FakeStream()
    const second = new FakeStream()
    const contexts = [new FakeAudioContext(), new FakeAudioContext()]
    const getUserMedia = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
    const source = new MicrophoneAudioSource({
      mediaDevices: { getUserMedia },
      createAudioContext: () => contexts.shift()!,
    })
    sources.push(source)

    await source.start()
    await source.stop()
    await source.start()

    expect(getUserMedia).toHaveBeenCalledTimes(2)
    expect(first.track.stopCalls).toBe(1)
    expect(second.track.stopCalls).toBe(0)
  })
})
