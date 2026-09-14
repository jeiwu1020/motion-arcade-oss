import { describe, expect, it, vi } from 'vitest'

import { resolveAbilityProfile } from '../adaptive/profiles'
import type { MotionInputRequest } from '../contracts/motion'
import {
  createSyntheticPoseFrame,
  withLandmarkConfidence,
} from '../pose/syntheticPoseFixtures'
import type { PoseInferenceBackend } from '../../sensors/pose/inference/PoseInferenceBackend'
import type { PoseInferenceResult, PoseSensorFrame } from '../../sensors/pose/poseTypes'
import {
  PoseGameplayInputRuntime,
  type PoseGameplayVideoSource,
} from './PoseGameplayInputRuntime'

class LifecycleTarget {
  visibilityState: DocumentVisibilityState = 'visible'
  readonly #listeners = new Map<string, Set<() => void>>()

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.#listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: () => void): void {
    this.#listeners.get(type)?.delete(listener)
  }

  dispatch(type: string): void {
    for (const listener of this.#listeners.get(type) ?? []) listener()
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function createHarness(framingRequirement?: 'FULL_BODY' | 'UPPER_BODY') {
  const now = { value: 0 }
  const video: PoseGameplayVideoSource = {
    readyState: 2,
    currentTime: 0,
    videoWidth: 1280,
    videoHeight: 720,
  }
  const camera = {
    start: vi.fn(async () => ({} as MediaStream)),
    stop: vi.fn(),
    getSettings: vi.fn(() => ({ width: 1280, height: 720 })),
  }
  const queuedResults: Array<PoseInferenceResult | Error> = []
  const backend: PoseInferenceBackend = {
    mode: 'WORKER',
    initialize: vi.fn(async () => undefined),
    infer: vi.fn(async (input) => {
      input.bitmap.close()
      const result = queuedResults.shift()
      if (result instanceof Error) throw result
      if (!result) throw new Error('No queued Pose inference result.')
      return result
    }),
    close: vi.fn(async () => undefined),
  }
  const bitmap = { close: vi.fn() } as unknown as ImageBitmap
  const documentTarget = new LifecycleTarget()
  const windowTarget = new LifecycleTarget()
  const runtime = new PoseGameplayInputRuntime({
    getVideo: () => video,
    camera,
    createBackend: () => backend,
    createFrame: async () => bitmap,
    now: () => now.value,
    documentTarget,
    windowTarget,
    ...(framingRequirement ? { framingRequirement } : {}),
  })

  const infer = async (frame: PoseSensorFrame) => {
    now.value = frame.timestampMs
    video.currentTime += 0.1
    queuedResults.push({ frame, inferenceDurationMs: 1 })
    await runtime.update(frame.timestampMs)
  }

  return {
    now,
    video,
    camera,
    backend,
    queuedResults,
    documentTarget,
    windowTarget,
    runtime,
    infer,
  }
}

async function establishStandardBaseline(
  harness: ReturnType<typeof createHarness>,
  startAt = 0,
): Promise<void> {
  for (let offset = 0; offset <= 900; offset += 100) {
    const timestampMs = startAt + offset
    await harness.infer(createSyntheticPoseFrame('neutral', { timestampMs }))
  }
}

async function flushLifecycle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

const POSE_REQUEST: MotionInputRequest = {
  players: [
    {
      playerId: 'player-1',
      abilityProfile: resolveAbilityProfile(['STANDARD']),
    },
  ],
  actions: ['REACH_LEFT', 'REACH_RIGHT'],
  sensors: { pose: true, hands: false, audio: false },
}

const UPPER_BODY_POSE_REQUEST: MotionInputRequest = {
  players: [
    {
      playerId: 'player-1',
      abilityProfile: resolveAbilityProfile(['UPPER_BODY']),
    },
  ],
  actions: [],
  sensors: { pose: true, hands: false, audio: false },
}

function upperBodyOnlyFrame(timestampMs: number): PoseSensorFrame {
  let frame = createSyntheticPoseFrame('neutral', { timestampMs })
  for (const landmarkIndex of [25, 26, 27, 28]) {
    frame = withLandmarkConfidence(frame, landmarkIndex, 0)
  }
  return frame
}

function sportsSweepFrame(timestampMs: number, leftWristOffsetX: number): PoseSensorFrame {
  const frame = createSyntheticPoseFrame('neutral', { timestampMs })
  const pose = frame.poses[0]
  if (!pose) throw new Error('Synthetic fixture must contain one pose.')
  return {
    ...frame,
    poses: [{
      ...pose,
      landmarks: pose.landmarks.map((point, index) =>
        index === 15 ? { ...point, x: point.x + leftWristOffsetX } : point,
      ),
    }],
  }
}

describe('PoseGameplayInputRuntime', () => {
  it('does not request camera permission until explicit start and reports startup/baselining', async () => {
    const harness = createHarness()
    const pendingCamera = deferred<MediaStream>()
    harness.camera.start.mockReturnValueOnce(pendingCamera.promise)

    expect(harness.runtime.getSnapshot().status).toBe('CAMERA_NOT_STARTED')
    expect(harness.camera.start).not.toHaveBeenCalled()

    const starting = harness.runtime.start(POSE_REQUEST)
    await Promise.resolve()
    expect(harness.runtime.getSnapshot().status).toBe('PERMISSION_STARTING')

    pendingCamera.resolve({} as MediaStream)
    await starting
    expect(harness.runtime.getSnapshot().status).toBe('BASELINING')
    expect(harness.runtime.getProvider().getSnapshot().players[0]).toMatchObject({
      abilityProfile: { profileIds: ['STANDARD'] },
      actions: {
        REACH_LEFT: { value: 0 },
        REACH_RIGHT: { value: 0 },
      },
    })
  })

  it('becomes ready from a STANDARD full-body baseline, pauses on loss, and recovers only when ready', async () => {
    const harness = createHarness()
    await harness.runtime.start(POSE_REQUEST)
    await establishStandardBaseline(harness)

    expect(harness.runtime.getSnapshot().status).toBe('READY')
    expect(harness.runtime.getProvider().getDiagnostics()).toMatchObject({
      baselineReady: true,
      fullBodyReady: true,
      quality: 'READY',
    })

    harness.now.value = 2_200
    await harness.runtime.update(2_200)
    expect(harness.runtime.getSnapshot().status).toBe('TRACKING_LOST')

    await harness.infer(
      createSyntheticPoseFrame('neutral', { timestampMs: 2_300 }),
    )
    expect(harness.runtime.getSnapshot().status).toBe('TRACKING_LOST')

    await establishStandardBaseline(harness, 2_400)
    expect(harness.runtime.getSnapshot().status).toBe('READY')
  })

  it('fails closed and releases provider, camera, and backend after inference error', async () => {
    const harness = createHarness()
    await harness.runtime.start(POSE_REQUEST)
    harness.now.value = 100
    harness.video.currentTime = 0.1
    harness.queuedResults.push(new Error('inference failed'))

    await harness.runtime.update(100)

    expect(harness.runtime.getSnapshot()).toMatchObject({
      status: 'ERROR',
      error: { code: 'INFERENCE_FAILED' },
    })
    expect(harness.runtime.getProvider().isRunning()).toBe(false)
    expect(harness.camera.stop).toHaveBeenCalledOnce()
    expect(harness.backend.close).toHaveBeenCalledOnce()
  })

  it('releases acquisition on pagehide and can explicitly start a fresh session', async () => {
    const harness = createHarness()
    await harness.runtime.start(POSE_REQUEST)

    harness.windowTarget.dispatch('pagehide')
    await flushLifecycle()

    expect(harness.runtime.getSnapshot().status).toBe('CAMERA_NOT_STARTED')
    expect(harness.runtime.getProvider().isRunning()).toBe(false)
    expect(harness.camera.stop).toHaveBeenCalledOnce()

    await harness.runtime.start(POSE_REQUEST)
    expect(harness.runtime.getSnapshot().status).toBe('BASELINING')
    expect(harness.camera.start).toHaveBeenCalledTimes(2)
  })

  it('disposes provider and acquisition resources on unmount', async () => {
    const harness = createHarness()
    await harness.runtime.start(POSE_REQUEST)

    await harness.runtime.dispose()

    expect(harness.runtime.getProvider().isRunning()).toBe(false)
    expect(harness.camera.stop).toHaveBeenCalledOnce()
    expect(harness.backend.close).toHaveBeenCalledOnce()
    expect(harness.runtime.getSportsMotionSnapshot()).toMatchObject({
      leftHand: { availability: 'UNAVAILABLE' }, leftSwing: null,
    })
    await expect(harness.runtime.start(POSE_REQUEST)).rejects.toThrow('disposed')
  })

  it('reuses an already-running camera and Pose session', async () => {
    const harness = createHarness()
    await harness.runtime.start(POSE_REQUEST)

    await harness.runtime.start(POSE_REQUEST)

    expect(harness.camera.start).toHaveBeenCalledOnce()
    expect(harness.backend.initialize).toHaveBeenCalledOnce()
  })

  it('keeps READY through a brief diagnostic loss and loses readiness after the grace window', async () => {
    const harness = createHarness()
    await harness.runtime.start(POSE_REQUEST)
    await establishStandardBaseline(harness)
    expect(harness.runtime.getSnapshot().status).toBe('READY')

    harness.now.value = 1_500
    await harness.runtime.update(1_500)
    expect(harness.runtime.getSnapshot().status).toBe('READY')

    harness.now.value = 1_901
    await harness.runtime.update(1_901)
    expect(harness.runtime.getSnapshot().status).toBe('TRACKING_LOST')

    await harness.infer(createSyntheticPoseFrame('neutral', { timestampMs: 1_902 }))
    expect(harness.runtime.getSnapshot().status).toBe('READY')
  })

  it('does not apply readiness grace to fatal runtime errors', async () => {
    const harness = createHarness()
    await harness.runtime.start(POSE_REQUEST)
    await establishStandardBaseline(harness)
    expect(harness.runtime.getSnapshot().status).toBe('READY')

    harness.queuedResults.push(new Error('fatal inference failed'))
    harness.now.value = 1_600
    harness.video.currentTime += 0.1
    await harness.runtime.update(1_600)

    expect(harness.runtime.getSnapshot().status).toBe('ERROR')
  })

  it('keeps FULL_BODY readiness unchanged while an UPPER_BODY game can establish a legitimate torso baseline without knees or ankles', async () => {
    const standard = createHarness()
    await standard.runtime.start(POSE_REQUEST)
    for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
      await standard.infer(upperBodyOnlyFrame(timestampMs))
    }
    expect(standard.runtime.getSnapshot().status).toBe('BASELINING')

    const upperBody = createHarness('UPPER_BODY')
    await upperBody.runtime.start(UPPER_BODY_POSE_REQUEST)
    for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
      await upperBody.infer(upperBodyOnlyFrame(timestampMs))
    }
    expect(upperBody.runtime.getSnapshot().status).toBe('READY')
    expect(upperBody.runtime.getProvider().getDiagnostics()).toMatchObject({
      upperBodyReady: true,
      fullBodyReady: false,
      quality: 'READY',
    })
  })

  it('derives spatial wrists from the same inference frame without changing the Motion Action snapshot', async () => {
    const harness = createHarness()
    await harness.runtime.start(POSE_REQUEST)

    await harness.infer(
      createSyntheticPoseFrame('reach-left', { timestampMs: 100 }),
    )

    const spatial = harness.runtime.getSpatialSnapshot()
    expect(spatial).toMatchObject({
      leftHand: {
        availability: 'AVAILABLE',
        x: 0.81,
        y: 0.32,
        timestampMs: 100,
        sequence: 1,
      },
      rightHand: {
        availability: 'AVAILABLE',
        x: 0.39,
        y: 0.57,
        timestampMs: 100,
        sequence: 1,
      },
    })
    expect(harness.runtime.getProvider().getSnapshot()).not.toHaveProperty('spatialHands')
    expect(harness.camera.start).toHaveBeenCalledOnce()
    expect(harness.backend.initialize).toHaveBeenCalledOnce()
    expect(harness.backend.infer).toHaveBeenCalledOnce()

    harness.now.value = 351
    expect(harness.runtime.getSpatialSnapshot().leftHand).toMatchObject({
      availability: 'UNAVAILABLE',
    })

    await harness.runtime.stop()
    expect(harness.runtime.getSpatialSnapshot()).toMatchObject({
      leftHand: { availability: 'UNAVAILABLE' },
      rightHand: { availability: 'UNAVAILABLE' },
    })
  })

  it('derives sanitized sports motion from the same Pose inference result and clears it on stop', async () => {
    const harness = createHarness()
    await harness.runtime.start(POSE_REQUEST)
    await harness.infer(sportsSweepFrame(0, 0))
    await harness.infer(sportsSweepFrame(100, 0.03))
    await harness.infer(sportsSweepFrame(200, 0.06))

    expect(harness.runtime.getSportsMotionSnapshot()).toMatchObject({
      leftHand: { availability: 'AVAILABLE', vectorX: 1, vectorY: 0 },
      leftSwing: { hand: 'LEFT', sequence: 1, vectorX: 1, vectorY: 0 },
      rightSwing: null,
    })
    expect(harness.runtime.getSportsMotionSnapshot()).not.toHaveProperty('poses')
    expect(harness.runtime.getProvider().getSnapshot()).not.toHaveProperty('sportsMotion')
    expect(harness.backend.infer).toHaveBeenCalledTimes(3)
    expect(harness.camera.start).toHaveBeenCalledOnce()
    expect(harness.backend.initialize).toHaveBeenCalledOnce()

    await harness.runtime.stop()
    expect(harness.runtime.getSportsMotionSnapshot()).toMatchObject({
      leftHand: { availability: 'UNAVAILABLE' },
      rightHand: { availability: 'UNAVAILABLE' },
      leftSwing: null,
      rightSwing: null,
    })
  })

  it('clears sports output for suspended and error lifecycles', async () => {
    const suspended = createHarness()
    await suspended.runtime.start(POSE_REQUEST)
    await suspended.infer(sportsSweepFrame(100, 0))
    suspended.documentTarget.visibilityState = 'hidden'
    suspended.documentTarget.dispatch('visibilitychange')
    await flushLifecycle()
    expect(suspended.runtime.getSportsMotionSnapshot()).toMatchObject({
      leftHand: { availability: 'UNAVAILABLE' }, leftSwing: null,
    })

    const failed = createHarness()
    await failed.runtime.start(POSE_REQUEST)
    await failed.infer(sportsSweepFrame(100, 0))
    failed.queuedResults.push(new Error('fatal sports inference failure'))
    failed.now.value = 200
    failed.video.currentTime += 0.1
    await failed.runtime.update(200)
    expect(failed.runtime.getSportsMotionSnapshot()).toMatchObject({
      leftHand: { availability: 'UNAVAILABLE' }, leftSwing: null,
    })
  })

  it('derives a sanitized pose-tracking snapshot from the same inference frame and clears it on lifecycle reset', async () => {
    const harness = createHarness()
    await harness.runtime.start(POSE_REQUEST)
    await harness.infer(createSyntheticPoseFrame('reach-left', { timestampMs: 100 }))

    const tracking = harness.runtime.getPoseTrackingSnapshot()
    expect(tracking).toMatchObject({
      posePresent: true,
      joints: {
        leftWrist: { x: 0.81, y: 0.32, confidence: 0.99, valid: true },
        rightKnee: { x: 0.46, y: 0.72, confidence: 0.99, valid: true },
      },
    })
    expect(tracking).not.toHaveProperty('poses')
    expect(harness.runtime.getProvider().getSnapshot()).not.toHaveProperty('poseTracking')

    await harness.runtime.dispose()
    expect(harness.runtime.getPoseTrackingSnapshot()).toMatchObject({
      posePresent: false,
      joints: { leftWrist: { x: null, y: null, valid: false } },
    })
  })
})
