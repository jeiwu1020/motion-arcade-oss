import { describe, expect, it } from 'vitest'

import type {
  MotionActionId,
  MotionActionState,
  MotionInputProvider,
  MotionInputRequest,
  MotionInputSnapshot,
} from '../../motion/contracts/motion'
import { VocalHopSession } from './VocalHopSession'

function action(id: MotionActionId, value: number, sequence: number, phase: MotionActionState['phase'] = 'active'): MotionActionState {
  return { id, value, phase, confidence: 1, timestampMs: sequence, sequence }
}

class FakeVoiceProvider implements MotionInputProvider {
  readonly id = 'TEST' as const
  running = true
  snapshot: MotionInputSnapshot = {
    providerId: this.id,
    sequence: 1,
    timestampMs: 0,
    players: [{
      playerId: 'player-1',
      abilityProfile: { profileIds: ['STANDARD'], posture: 'FLEXIBLE', bodyRange: 'UPPER_BODY', allowedAnatomicalSides: ['LEFT', 'RIGHT'], requiredMotionRangeScale: 1, reactionWindowScale: 1 },
      actions: {
        VOICE_LEVEL: action('VOICE_LEVEL', 0, 1, 'idle'),
        VOICE_TRIGGER: action('VOICE_TRIGGER', 0, 1, 'idle'),
        VOICE_SUSTAINED_DURATION: action('VOICE_SUSTAINED_DURATION', 0, 1, 'idle'),
      },
    }],
  }
  async start(_request: MotionInputRequest): Promise<void> { this.running = true }
  async stop(): Promise<void> { this.running = false }
  update(_deltaMs: number): void {}
  getSnapshot(): MotionInputSnapshot { return this.snapshot }
  subscribe(_listener: () => void): () => void { return () => undefined }
  isRunning(): boolean { return this.running }
  set(triggerSequence: number, level: number, duration = 0): void {
    const player = this.snapshot.players[0]!
    this.snapshot = {
      ...this.snapshot,
      sequence: this.snapshot.sequence + 1,
      players: [{ ...player, actions: {
        ...player.actions,
        VOICE_LEVEL: action('VOICE_LEVEL', level, triggerSequence, level > 0 ? 'active' : 'ended'),
        VOICE_TRIGGER: action('VOICE_TRIGGER', triggerSequence > 1 ? 1 : 0, triggerSequence, triggerSequence > 1 ? 'started' : 'idle'),
        VOICE_SUSTAINED_DURATION: action('VOICE_SUSTAINED_DURATION', duration, triggerSequence, duration > 0 ? 'active' : 'idle'),
      } }],
    }
  }
}

describe('VocalHopSession', () => {
  it('ignores retained trigger on start and only consumes newer triggers', async () => {
    const provider = new FakeVoiceProvider()
    provider.set(9, 0, 0)
    const session = new VocalHopSession(provider, { seed: 4 })
    await session.start()
    session.tick(3_000, { setupReady: true, hardFailure: false })
    session.tick(100, { setupReady: true, hardFailure: false })
    expect(session.getState().hops).toBe(0)
    provider.set(10, 0.325, 0.2)
    session.tick(1, { setupReady: true, hardFailure: false })
    expect(session.getState().hops).toBe(1)
    expect(session.getState().lastConsumedTriggerSequence).toBe(10)
  })

  it('pauses time and consumes triggers while unready, then resumes without replay', async () => {
    const provider = new FakeVoiceProvider()
    const session = new VocalHopSession(provider, { seed: 8 })
    await session.start()
    provider.set(2, 0.8)
    session.tick(2_000, { setupReady: false, hardFailure: false })
    expect(session.getState().elapsedMs).toBe(0)
    session.tick(1, { setupReady: true, hardFailure: false })
    expect(session.getState().hops).toBe(0)
    provider.set(3, 0.4)
    session.tick(3_000, { setupReady: true, hardFailure: false })
    provider.set(4, 0.4)
    session.tick(1, { setupReady: true, hardFailure: false })
    expect(session.getState().phase).toBe('PLAYING')
    expect(session.getState().hops).toBe(1)
  })

  it('replay marks the retained sequence and preserves voice shaping', async () => {
    const provider = new FakeVoiceProvider()
    const session = new VocalHopSession(provider, { seed: 8 })
    await session.start()
    session.tick(3_000, { setupReady: true, hardFailure: false })
    provider.set(4, 0.55, 1)
    session.tick(1, { setupReady: true, hardFailure: false })
    session.replay()
    expect(session.getState().phase).toBe('COUNTDOWN')
    expect(session.getState().hops).toBe(0)
    session.tick(3_000, { setupReady: true, hardFailure: false })
    session.tick(1, { setupReady: true, hardFailure: false })
    expect(session.getState().hops).toBe(0)
  })
})
