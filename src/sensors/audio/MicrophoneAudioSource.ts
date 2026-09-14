interface MicrophoneTrack extends EventTarget {
  stop(): void
}

interface MicrophoneStream {
  getTracks(): readonly MicrophoneTrack[]
}

interface MediaDevicesSource {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MicrophoneStream>
}

interface AudioNodeLike {
  connect(destinationNode: unknown): unknown
  disconnect(): void
}

interface AnalyserNodeLike extends AudioNodeLike {
  readonly fftSize: number
  getFloatTimeDomainData(array: Float32Array): void
}

interface AudioContextLike {
  resume(): Promise<void>
  close(): Promise<void>
  createMediaStreamSource(stream: MicrophoneStream): AudioNodeLike
  createAnalyser(): AnalyserNodeLike
}

interface LifecycleDocument {
  readonly visibilityState: DocumentVisibilityState
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

interface LifecycleWindow {
  addEventListener(type: 'pagehide', listener: () => void): void
  removeEventListener(type: 'pagehide', listener: () => void): void
}

interface AudioContextConstructor {
  new (): AudioContextLike
}

export interface MicrophoneAudioSourceOptions {
  readonly mediaDevices?: MediaDevicesSource
  readonly createAudioContext?: () => AudioContextLike
  readonly documentTarget?: LifecycleDocument
  readonly windowTarget?: LifecycleWindow
}

export interface VoiceAudioSource {
  start(): Promise<void>
  stop(): Promise<void>
  dispose(): Promise<void>
  isRunning(): boolean
  readTimeDomainSamples(): Float32Array | null
  subscribeStopped(listener: () => void): () => void
}

function defaultMediaDevices(): MediaDevicesSource | undefined {
  return globalThis.navigator?.mediaDevices as MediaDevicesSource | undefined
}

function defaultAudioContextFactory(): (() => AudioContextLike) | undefined {
  const scope = globalThis as typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor
  }
  const Constructor = scope.AudioContext as unknown as AudioContextConstructor | undefined
    ?? scope.webkitAudioContext
  return Constructor ? () => new Constructor() : undefined
}

function defaultDocumentTarget(): LifecycleDocument | undefined {
  return typeof document === 'undefined' ? undefined : document
}

function defaultWindowTarget(): LifecycleWindow | undefined {
  return typeof window === 'undefined' ? undefined : window
}

/**
 * Explicitly-owned microphone capture. It routes the input only to an
 * analyser, never to speakers, and clears capture when hidden or page-hidden.
 */
export class MicrophoneAudioSource implements VoiceAudioSource {
  readonly #mediaDevices: MediaDevicesSource | undefined
  readonly #createAudioContext: (() => AudioContextLike) | undefined
  readonly #documentTarget: LifecycleDocument | undefined
  readonly #windowTarget: LifecycleWindow | undefined
  readonly #stoppedListeners = new Set<() => void>()

  #stream: MicrophoneStream | null = null
  #context: AudioContextLike | null = null
  #sourceNode: AudioNodeLike | null = null
  #analyser: AnalyserNodeLike | null = null
  #samples: Float32Array | null = null
  #running = false
  #disposed = false
  #generation = 0
  #stopPromise: Promise<void> | null = null

  constructor(options: MicrophoneAudioSourceOptions = {}) {
    this.#mediaDevices = options.mediaDevices ?? defaultMediaDevices()
    this.#createAudioContext = options.createAudioContext ?? defaultAudioContextFactory()
    this.#documentTarget = options.documentTarget ?? defaultDocumentTarget()
    this.#windowTarget = options.windowTarget ?? defaultWindowTarget()
    this.#documentTarget?.addEventListener('visibilitychange', this.#onVisibilityChange)
    this.#windowTarget?.addEventListener('pagehide', this.#onPageHide)
  }

  async start(): Promise<void> {
    if (this.#disposed) throw new Error('Microphone audio source is disposed.')
    if (this.#running) return
    if (this.#stopPromise) await this.#stopPromise
    const mediaDevices = this.#mediaDevices
    const createAudioContext = this.#createAudioContext
    if (!mediaDevices || !createAudioContext) {
      throw new Error('Microphone audio is unavailable in this browser.')
    }

    const generation = this.#generation
    const stream = await mediaDevices.getUserMedia({
      video: false,
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    let context: AudioContextLike | null = null
    let sourceNode: AudioNodeLike | null = null
    let analyser: AnalyserNodeLike | null = null
    try {
      context = createAudioContext()
      await context.resume()
      sourceNode = context.createMediaStreamSource(stream)
      analyser = context.createAnalyser()
      sourceNode.connect(analyser)
      if (generation !== this.#generation || this.#disposed) {
        throw new Error('Microphone start was cancelled.')
      }

      this.#stream = stream
      this.#context = context
      this.#sourceNode = sourceNode
      this.#analyser = analyser
      this.#samples = new Float32Array(Math.max(4, analyser.fftSize))
      this.#running = true
      this.#attachTrackListeners(stream)
    } catch (error) {
      sourceNode?.disconnect()
      analyser?.disconnect()
      for (const track of stream.getTracks()) track.stop()
      await context?.close().catch(() => undefined)
      throw error
    }
  }

  async stop(): Promise<void> {
    this.#generation += 1
    if (this.#stopPromise) return this.#stopPromise
    const stopPromise = this.#release()
    this.#stopPromise = stopPromise
    try {
      await stopPromise
    } finally {
      if (this.#stopPromise === stopPromise) this.#stopPromise = null
    }
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return
    this.#disposed = true
    this.#documentTarget?.removeEventListener('visibilitychange', this.#onVisibilityChange)
    this.#windowTarget?.removeEventListener('pagehide', this.#onPageHide)
    await this.stop()
    this.#stoppedListeners.clear()
  }

  isRunning(): boolean {
    return this.#running
  }

  readTimeDomainSamples(): Float32Array | null {
    const analyser = this.#analyser
    const samples = this.#samples
    if (!this.#running || !analyser || !samples) return null
    analyser.getFloatTimeDomainData(samples)
    return samples
  }

  subscribeStopped(listener: () => void): () => void {
    this.#stoppedListeners.add(listener)
    return () => this.#stoppedListeners.delete(listener)
  }

  async #release(): Promise<void> {
    const stream = this.#stream
    const context = this.#context
    const sourceNode = this.#sourceNode
    const analyser = this.#analyser
    const hadResources = Boolean(stream || context || sourceNode || analyser || this.#running)
    this.#stream = null
    this.#context = null
    this.#sourceNode = null
    this.#analyser = null
    this.#samples = null
    this.#running = false
    if (stream) this.#detachTrackListeners(stream)
    if (hadResources) this.#notifyStopped()
    sourceNode?.disconnect()
    analyser?.disconnect()
    for (const track of stream?.getTracks() ?? []) track.stop()
    await context?.close().catch(() => undefined)
  }

  #attachTrackListeners(stream: MicrophoneStream): void {
    for (const track of stream.getTracks()) {
      track.addEventListener('ended', this.#onTrackEnded)
    }
  }

  #detachTrackListeners(stream: MicrophoneStream): void {
    for (const track of stream.getTracks()) {
      track.removeEventListener('ended', this.#onTrackEnded)
    }
  }

  #notifyStopped(): void {
    for (const listener of this.#stoppedListeners) listener()
  }

  readonly #onVisibilityChange = (): void => {
    if (this.#documentTarget?.visibilityState === 'hidden') void this.stop()
  }

  readonly #onPageHide = (): void => {
    void this.stop()
  }

  readonly #onTrackEnded = (): void => {
    void this.stop()
  }
}
