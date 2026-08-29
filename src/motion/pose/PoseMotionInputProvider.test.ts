import { describe, expect, it } from 'vitest'

import { resolveAbilityProfile } from '../adaptive/profiles'
import type { MotionInputRequest } from '../contracts/motion'
import { MotionProviderCoordinator } from '../providers/MotionProviderCoordinator'
import { PoseMotionInputProvider } from './PoseMotionInputProvider'
import { createSyntheticPoseFrame } from './syntheticPoseFixtures'

function request(
  actions: MotionInputRequest['actions'] = [
    'MOVE_LEFT',
    'MOVE_RIGHT',
    'LEAN_LEFT',
    'LEAN_RIGHT',
    'REACH',
    'REACH_LEFT',
    'REACH_RIGHT',
    'SQUAT',
    'JUMP',
  ],
): MotionInputRequest {
  return {
    players: [
      {
        playerId: 'player-1',
        abilityProfile: resolveAbilityProfile(['STANDARD']),
      },
    ],
    actions,
    sensors: { pose: true, hands: false, audio: false },
  }
}

async function readyProvider(
  nowRef: { value: number },
  actions?: MotionInputRequest['actions'],
): Promise<PoseMotionInputProvider> {
  const provider = new PoseMotionInputProvider({ now: () => nowRef.value })
  await provider.start(request(actions))
  for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
    nowRef.value = timestampMs
    provider.ingest(createSyntheticPoseFrame('neutral', { timestampMs }))
  }
  expect(provider.getDiagnostics().baselineReady).toBe(true)
  return provider
}

describe('PoseMotionInputProvider', () => {
  it('publishes only requested existing normalized action IDs', async () => {
    const nowRef = { value: 0 }
    const provider = await readyProvider(nowRef, ['MOVE_LEFT', 'MOVE_RIGHT'])
    nowRef.value = 1_000
    provider.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 1_000 }))
    nowRef.value = 1_050
    provider.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 1_050 }))

    const actions = provider.getSnapshot().players[0]?.actions
    expect(actions?.MOVE_LEFT?.value).toBeGreaterThan(0)
    expect(actions?.MOVE_RIGHT?.value).toBe(0)
    expect(actions?.LEAN_LEFT).toBeUndefined()
    expect(Object.keys(actions ?? {})).toEqual(['MOVE_LEFT', 'MOVE_RIGHT'])
  })

  it('is neutral before the analyzer baseline is ready', async () => {
    const nowRef = { value: 0 }
    const provider = new PoseMotionInputProvider({ now: () => nowRef.value })
    await provider.start(request(['MOVE_LEFT']))
    provider.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 0 }))

    expect(provider.getSnapshot().players[0]?.actions.MOVE_LEFT?.value).toBe(0)
    expect(provider.getDiagnostics().quality).toBe('BASELINING')
  })

  it('returns frozen immutable snapshot boundaries without raw pose data', async () => {
    const nowRef = { value: 0 }
    const provider = await readyProvider(nowRef, ['REACH_LEFT'])
    const snapshot = provider.getSnapshot()
    const player = snapshot.players[0]

    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.players)).toBe(true)
    expect(Object.isFrozen(player)).toBe(true)
    expect(Object.isFrozen(player?.actions)).toBe(true)
    expect(Object.isFrozen(player?.actions.REACH_LEFT)).toBe(true)
    expect('landmarks' in snapshot).toBe(false)
    expect('poses' in snapshot).toBe(false)
  })

  it('neutralizes a stale action during snapshot polling without a new frame', async () => {
    const nowRef = { value: 0 }
    const provider = await readyProvider(nowRef, ['MOVE_RIGHT'])
    nowRef.value = 1_000
    provider.ingest(createSyntheticPoseFrame('move-right', { timestampMs: 1_000 }))
    nowRef.value = 1_050
    provider.ingest(createSyntheticPoseFrame('move-right', { timestampMs: 1_050 }))
    expect(provider.getSnapshot().players[0]?.actions.MOVE_RIGHT?.value).toBeGreaterThan(0)

    nowRef.value = 1_301

    expect(provider.getSnapshot().players[0]?.actions.MOVE_RIGHT?.value).toBe(0)
    expect(provider.getDiagnostics().quality).toBe('LOST')
  })

  it('resets its session baseline and actions across stop and restart', async () => {
    const nowRef = { value: 0 }
    const provider = await readyProvider(nowRef, ['MOVE_LEFT'])
    nowRef.value = 1_000
    provider.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 1_000 }))
    nowRef.value = 1_050
    provider.ingest(createSyntheticPoseFrame('move-left', { timestampMs: 1_050 }))
    expect(provider.getSnapshot().players[0]?.actions.MOVE_LEFT?.value).toBeGreaterThan(0)

    await provider.stop()
    await provider.stop()
    expect(provider.isRunning()).toBe(false)
    expect(provider.getSnapshot().players[0]?.actions.MOVE_LEFT?.value).toBe(0)

    await provider.start(request(['MOVE_LEFT']))
    expect(provider.isRunning()).toBe(true)
    expect(provider.getDiagnostics().baselineReady).toBe(false)
    expect(provider.getSnapshot().players[0]?.actions.MOVE_LEFT?.value).toBe(0)
  })

  it('honors anatomical side profile gating without changing world MOVE', async () => {
    const nowRef = { value: 0 }
    const provider = new PoseMotionInputProvider({ now: () => nowRef.value })
    const rightOnlyRequest: MotionInputRequest = {
      ...request(['REACH_LEFT', 'REACH_RIGHT', 'MOVE_LEFT']),
      players: [
        {
          playerId: 'player-1',
          abilityProfile: resolveAbilityProfile(['RIGHT_SIDE']),
        },
      ],
    }
    await provider.start(rightOnlyRequest)
    for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
      nowRef.value = timestampMs
      provider.ingest(createSyntheticPoseFrame('neutral', { timestampMs }))
    }
    nowRef.value = 1_000
    provider.ingest(createSyntheticPoseFrame('reach-left', { timestampMs: 1_000 }))
    nowRef.value = 1_050
    provider.ingest(createSyntheticPoseFrame('reach-left', { timestampMs: 1_050 }))
    const actions = provider.getSnapshot().players[0]?.actions

    expect(actions?.REACH_LEFT?.value).toBe(0)
    expect(actions?.MOVE_LEFT).toBeDefined()
  })

  it('works with MotionProviderCoordinator lifecycle switching', async () => {
    const nowRef = { value: 0 }
    const provider = new PoseMotionInputProvider({ now: () => nowRef.value })
    const replacement = new PoseMotionInputProvider({ now: () => nowRef.value })
    const coordinator = new MotionProviderCoordinator()

    await coordinator.switchTo(provider, request(['MOVE_LEFT']))
    await coordinator.switchTo(replacement, request(['MOVE_LEFT']))

    expect(provider.isRunning()).toBe(false)
    expect(replacement.isRunning()).toBe(true)
    await coordinator.stop()
    expect(replacement.isRunning()).toBe(false)
  })
})
