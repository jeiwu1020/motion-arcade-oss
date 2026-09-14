import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveAbilityProfile } from '../adaptive/profiles'
import type { MotionInputRequest } from '../contracts/motion'
import { VoiceSignalAnalyzer } from '../voice/VoiceSignalAnalyzer'
import type { VoiceAudioSource } from '../../sensors/audio/MicrophoneAudioSource'
import { MicrophoneVoiceInputProvider } from './MicrophoneVoiceInputProvider'

class FakeVoiceAudioSource implements VoiceAudioSource {
  startCalls = 0
  stopCalls = 0
  running = false
  samples: Float32Array | null = null
  readonly #listeners = new Set<() => void>()

  async start(): Promise<void> {
    this.startCalls += 1
    this.running = true
  }

  async stop(): Promise<void> {
    this.stopCalls += 1
    this.running = false
    for (const listener of this.#listeners) listener()
  }

  async dispose(): Promise<void> {
    await this.stop()
  }

  isRunning(): boolean {
    return this.running
  }

  readTimeDomainSamples(): Float32Array | null {
    return this.samples
  }

  subscribeStopped(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  loseDevice(): void {
    this.running = false
    for (const listener of this.#listeners) listener()
  }
}

const voiceActions = [
  'VOICE_LEVEL',
  'VOICE_TRIGGER',
  'VOICE_SUSTAINED_DURATION',
] as const

function request(
  overrides: Partial<MotionInputRequest> = {},
): MotionInputRequest {
  return {
    players: [{ playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) }],
    actions: voiceActions,
    sensors: { pose: false, hands: false, audio: true },
    ...overrides,
  }
}

function action(
  provider: MicrophoneVoiceInputProvider,
  id: (typeof voiceActions)[number],
) {
  const state = provider.getSnapshot().players[0]?.actions[id]
  if (!state) throw new Error(`Missing ${id}`)
  return state
}

describe('MicrophoneVoiceInputProvider', () => {
  const providers: MicrophoneVoiceInputProvider[] = []

  afterEach(async () => {
    await Promise.all(providers.map((provider) => provider.dispose()))
  })

  function setup() {
    let timestampMs = 0
    const source = new FakeVoiceAudioSource()
    const provider = new MicrophoneVoiceInputProvider({
      source,
      now: () => timestampMs,
      analyzer: new VoiceSignalAnalyzer({ smoothingAlpha: 1 }),
    })
    providers.push(provider)
    return {
      source,
      provider,
      advance: (deltaMs: number) => { timestampMs += deltaMs; provider.update(deltaMs) },
    }
  }

  it('does not start microphone capture during construction, snapshot reads, or updates', () => {
    const { source, provider, advance } = setup()

    provider.getSnapshot()
    advance(16)

    expect(source.startCalls).toBe(0)
    expect(provider.isRunning()).toBe(false)
  })

  it('starts one-player audio input explicitly with existing normalized voice actions', async () => {
    const { source, provider } = setup()

    await provider.start(request())

    expect(source.startCalls).toBe(1)
    expect(provider.isRunning()).toBe(true)
    expect(provider.getSnapshot().players).toHaveLength(1)
    expect(action(provider, 'VOICE_LEVEL')).toMatchObject({ value: 0, phase: 'idle' })
    expect(action(provider, 'VOICE_TRIGGER')).toMatchObject({ value: 0, phase: 'idle' })
    expect(action(provider, 'VOICE_SUSTAINED_DURATION')).toMatchObject({ value: 0, phase: 'idle' })
    expect(provider.getSnapshot().players[0]?.actions).not.toHaveProperty('VOICE_VOLUME')
  })

  it('rejects non-audio, mixed, multi-player, and production-pitch requests before capture', async () => {
    const { source, provider } = setup()

    await expect(provider.start(request({ sensors: { pose: false, hands: false, audio: false } }))).rejects.toThrow('audio')
    await expect(provider.start(request({ sensors: { pose: true, hands: false, audio: true } }))).rejects.toThrow('Pose')
    await expect(provider.start(request({ actions: ['MOVE_LEFT'] }))).rejects.toThrow('VOICE')
    await expect(provider.start(request({ actions: ['VOICE_PITCH'] }))).rejects.toThrow('VOICE_PITCH')
    await expect(provider.start(request({ players: [
      { playerId: 'player-1', abilityProfile: resolveAbilityProfile(['STANDARD']) },
      { playerId: 'player-2', abilityProfile: resolveAbilityProfile(['STANDARD']) },
    ] }))).rejects.toThrow('one player')
    expect(source.startCalls).toBe(0)
  })

  it('maps waveform analysis to existing level, trigger sequence, and sustained duration actions', async () => {
    const { source, provider, advance } = setup()
    await provider.start(request())
    source.samples = new Float32Array([0.1, -0.1, 0.1, -0.1])

    advance(250)
    expect(action(provider, 'VOICE_LEVEL')).toMatchObject({ phase: 'started' })
    expect(action(provider, 'VOICE_SUSTAINED_DURATION')).toMatchObject({ value: 0.25, phase: 'started' })
    expect(action(provider, 'VOICE_TRIGGER')).toMatchObject({ value: 0, phase: 'idle' })

    advance(250)
    const trigger = action(provider, 'VOICE_TRIGGER')
    expect(trigger).toMatchObject({ value: 1, phase: 'started' })
    const triggerSequence = trigger.sequence
    advance(250)
    expect(action(provider, 'VOICE_TRIGGER')).toMatchObject({ value: 0, phase: 'ended', sequence: triggerSequence })
    expect(action(provider, 'VOICE_SUSTAINED_DURATION')).toMatchObject({ value: 0.75, phase: 'active' })
  })

  it('clears normalized actions and prevents stale triggers across stop and restart', async () => {
    const { source, provider, advance } = setup()
    await provider.start(request())
    source.samples = new Float32Array([0.1, -0.1])
    advance(16)
    advance(16)
    const priorTrigger = action(provider, 'VOICE_TRIGGER').sequence

    await provider.stop()

    expect(source.stopCalls).toBe(1)
    expect(action(provider, 'VOICE_LEVEL')).toMatchObject({ value: 0, phase: 'idle' })
    expect(action(provider, 'VOICE_SUSTAINED_DURATION')).toMatchObject({ value: 0, phase: 'idle' })
    expect(action(provider, 'VOICE_TRIGGER')).toMatchObject({ value: 0, phase: 'idle' })

    await provider.start(request())
    source.samples = new Float32Array([0.1, -0.1])
    advance(16)
    expect(action(provider, 'VOICE_TRIGGER').sequence).toBeGreaterThan(priorTrigger)
    expect(action(provider, 'VOICE_TRIGGER').value).toBe(0)
  })

  it('clears output and capture ownership after device loss or source start failure', async () => {
    const first = setup()
    await first.provider.start(request())
    first.source.samples = new Float32Array([0.1, -0.1])
    first.advance(16)
    first.source.loseDevice()

    expect(first.provider.isRunning()).toBe(false)
    expect(action(first.provider, 'VOICE_LEVEL')).toMatchObject({ value: 0, phase: 'idle' })
    expect(action(first.provider, 'VOICE_SUSTAINED_DURATION')).toMatchObject({ value: 0, phase: 'idle' })

    const failingSource = new FakeVoiceAudioSource()
    failingSource.start = vi.fn(async () => { throw new Error('permission denied') })
    const failingProvider = new MicrophoneVoiceInputProvider({ source: failingSource })
    providers.push(failingProvider)
    await expect(failingProvider.start(request())).rejects.toThrow('permission denied')
    expect(failingProvider.isRunning()).toBe(false)
    expect(failingProvider.getSnapshot().players).toEqual([])
  })

  it('keeps game snapshots immutable and does not invoke recording or speech APIs', async () => {
    const { source, provider, advance } = setup()
    const recorder = vi.fn(() => { throw new Error('recording must not start') })
    const recognition = vi.fn(() => { throw new Error('recognition must not start') })
    const scope = globalThis as unknown as Record<string, unknown>
    const originalRecorder = scope.MediaRecorder
    const originalRecognition = scope.SpeechRecognition
    const originalWebkitRecognition = scope.webkitSpeechRecognition
    scope.MediaRecorder = recorder
    scope.SpeechRecognition = recognition
    scope.webkitSpeechRecognition = recognition
    try {
      await provider.start(request())
      source.samples = new Float32Array([0.1, -0.1])
      advance(16)
      const snapshot = provider.getSnapshot()
      expect(Object.isFrozen(snapshot)).toBe(true)
      expect(Object.isFrozen(snapshot.players)).toBe(true)
      expect(Object.isFrozen(snapshot.players[0]?.actions)).toBe(true)
      expect(recorder).not.toHaveBeenCalled()
      expect(recognition).not.toHaveBeenCalled()
    } finally {
      scope.MediaRecorder = originalRecorder
      scope.SpeechRecognition = originalRecognition
      scope.webkitSpeechRecognition = originalWebkitRecognition
    }
  })
})
