import { describe, expect, it } from 'vitest'

import { resolveAbilityProfile } from '../adaptive/profiles'
import type { MotionInputRequest, PlayerCalibration } from '../contracts/motion'
import { MotionProviderCoordinator } from '../providers/MotionProviderCoordinator'
import { PoseMotionInputProvider } from './PoseMotionInputProvider'
import { POSE_MOTION_CONFIG } from './poseMotionConfig'
import {
  createSyntheticPoseFrame,
  withPoseTranslation,
} from './syntheticPoseFixtures'

function calibration(): Extract<PlayerCalibration, { readonly version: 1 }> {
  return {
    version: 1,
    status: 'COMPLETE',
    pose: {
      move: { leftRangeBodyUnits: 0.3, rightRangeBodyUnits: 0.6 },
      lean: { leftRangeBodyUnits: 0.25, rightRangeBodyUnits: 0.5 },
      reach: { leftCapability: 0.9, rightCapability: 0.98 },
      squat: { comfortableDepthBodyUnits: 0.22 },
    },
    steps: {
      NEUTRAL: 'COMPLETE',
      MOVE: 'COMPLETE',
      LEAN: 'COMPLETE',
      REACH: 'COMPLETE',
      SQUAT: 'COMPLETE',
    },
    quality: {
      meanTrackingConfidence: 0.96,
      validSampleCount: 40,
      completedAtTimestampMs: 5_000,
    },
  }
}

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
  playerCalibration?: PlayerCalibration,
): MotionInputRequest {
  const player = {
    playerId: 'player-1',
    abilityProfile: resolveAbilityProfile(['STANDARD']),
  }
  return {
    players: [
      playerCalibration ? { ...player, calibration: playerCalibration } : player,
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

  it('resolves valid v1 calibration once at start and publishes stronger usable-range MOVE', async () => {
    const standardNow = { value: 0 }
    const calibratedNow = { value: 0 }
    const standard = new PoseMotionInputProvider({ now: () => standardNow.value })
    const calibrated = new PoseMotionInputProvider({ now: () => calibratedNow.value })
    await standard.start(request(['MOVE_LEFT']))
    await calibrated.start(request(['MOVE_LEFT'], calibration()))
    for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
      standardNow.value = timestampMs
      calibratedNow.value = timestampMs
      const frame = createSyntheticPoseFrame('neutral', { timestampMs })
      standard.ingest(frame)
      calibrated.ingest(frame)
    }
    for (const timestampMs of [1_000, 1_050, 1_100]) {
      standardNow.value = timestampMs
      calibratedNow.value = timestampMs
      const comfortableLeft = withPoseTranslation(
        createSyntheticPoseFrame('neutral', { timestampMs }),
        0.042,
        0,
      )
      standard.ingest(comfortableLeft)
      calibrated.ingest(comfortableLeft)
    }

    const standardValue = standard.getSnapshot().players[0]?.actions.MOVE_LEFT?.value
    const calibratedValue = calibrated.getSnapshot().players[0]?.actions.MOVE_LEFT?.value
    expect(standard.getEffectiveConfig().source).toBe('STANDARD')
    expect(calibrated.getEffectiveConfig()).toMatchObject({
      source: 'CALIBRATION_V1',
      adapted: { move: { left: true, right: true } },
      config: { move: { left: { fullIntensityBodyUnits: 0.3 } } },
    })
    expect(typeof standardValue === 'number' ? standardValue : 0).toBeLessThan(0.5)
    expect(typeof calibratedValue === 'number' ? calibratedValue : 0).toBeGreaterThan(0.85)
  })

  it('keeps the exact STANDARD config when calibration is absent or deprecated', async () => {
    const provider = new PoseMotionInputProvider({ now: () => 0 })
    await provider.start(request(['SQUAT', 'JUMP']))

    expect(provider.getEffectiveConfig()).toMatchObject({
      source: 'STANDARD',
      config: POSE_MOTION_CONFIG,
    })

    await provider.start(
      request(['SQUAT', 'JUMP'], { leftUsableExtent: 0.05 }),
    )
    expect(provider.getEffectiveConfig()).toMatchObject({
      source: 'STANDARD',
      config: POSE_MOTION_CONFIG,
    })
  })

  it('re-resolves per-session config and returns to STANDARD after restart', async () => {
    const provider = new PoseMotionInputProvider({ now: () => 0 })
    await provider.start(request(['MOVE_LEFT'], calibration()))
    expect(provider.getEffectiveConfig().source).toBe('CALIBRATION_V1')

    await provider.stop()
    expect(provider.getEffectiveConfig().source).toBe('STANDARD')
    expect(
      Object.prototype.hasOwnProperty.call(provider.getSnapshot().players[0], 'calibration'),
    ).toBe(false)
    await provider.start(request(['MOVE_LEFT']))

    expect(provider.getEffectiveConfig().source).toBe('STANDARD')
    expect(provider.getEffectiveConfig().config).toEqual(POSE_MOTION_CONFIG)
    expect(provider.getDiagnostics().baselineReady).toBe(false)
  })
})
