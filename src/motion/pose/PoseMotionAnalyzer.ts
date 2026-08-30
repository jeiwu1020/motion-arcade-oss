import {
  canonicalizeHorizontalDelta,
  clamp01,
} from '../coordinates/normalizeCoordinates'
import type {
  MotionActionId,
  MotionActionPhase,
  MotionActionState,
} from '../contracts/motion'
import type { PoseSensorFrame } from '../../sensors/pose/poseTypes'
import { PoseFeatureExtractor } from './PoseFeatureExtractor'
import {
  POSE_MOTION_CONFIG,
  type PoseMotionConfig,
} from './poseMotionConfig'
import type {
  PoseFeatureFrame,
  PoseJumpState,
  PoseMotionAnalyzerSnapshot,
  PoseSquatState,
  PoseTrackingQuality,
} from './poseMotionTypes'

const POSE_ACTION_IDS = [
  'MOVE_LEFT',
  'MOVE_RIGHT',
  'LEAN_LEFT',
  'LEAN_RIGHT',
  'REACH',
  'REACH_LEFT',
  'REACH_RIGHT',
  'SQUAT',
  'JUMP',
] as const satisfies readonly MotionActionId[]

interface NeutralBaseline {
  readonly hipX: number
  readonly hipY: number
  readonly leftAnkleY: number
  readonly rightAnkleY: number
  readonly bodyScale: number
  readonly aspectRatio: number
}

interface BaselineAccumulator {
  startedAtMs: number
  lastHipX: number
  lastHipY: number
  samples: number
  hipX: number
  hipY: number
  leftAnkleY: number
  rightAnkleY: number
  bodyScale: number
  aspectRatio: number
}

type HorizontalState = 'LEFT' | 'RIGHT' | 'NONE'

function mergeConfig(overrides: Partial<PoseMotionConfig>): PoseMotionConfig {
  return {
    ...POSE_MOTION_CONFIG,
    ...overrides,
    move: {
      left: { ...POSE_MOTION_CONFIG.move.left, ...overrides.move?.left },
      right: { ...POSE_MOTION_CONFIG.move.right, ...overrides.move?.right },
    },
    lean: {
      left: { ...POSE_MOTION_CONFIG.lean.left, ...overrides.lean?.left },
      right: { ...POSE_MOTION_CONFIG.lean.right, ...overrides.lean?.right },
    },
    reach: {
      ...POSE_MOTION_CONFIG.reach,
      ...overrides.reach,
      left: { ...POSE_MOTION_CONFIG.reach.left, ...overrides.reach?.left },
      right: { ...POSE_MOTION_CONFIG.reach.right, ...overrides.reach?.right },
    },
    squat: { ...POSE_MOTION_CONFIG.squat, ...overrides.squat },
    jump: { ...POSE_MOTION_CONFIG.jump, ...overrides.jump },
  }
}

function now(): number {
  return typeof performance === 'undefined' ? 0 : performance.now()
}

function numericValue(action: MotionActionState | undefined): number {
  return typeof action?.value === 'number' ? action.value : 0
}

function ema(previous: number, next: number, alpha: number): number {
  return previous + (next - previous) * alpha
}

export class PoseMotionAnalyzer {
  readonly #config: PoseMotionConfig
  readonly #extractor: PoseFeatureExtractor
  readonly #actions: Partial<Record<MotionActionId, MotionActionState>> = {}

  #quality: PoseTrackingQuality = 'LOST'
  #baseline: NeutralBaseline | undefined
  #baselineAccumulator: BaselineAccumulator | undefined
  #baselineProgress = 0
  #lastPoseTimestampMs: number | undefined
  #actionSequence = 0
  #snapshotSequence = 0
  #moveState: HorizontalState = 'NONE'
  #moveCandidate: HorizontalState = 'NONE'
  #moveCandidateFrames = 0
  #leanState: HorizontalState = 'NONE'
  #leanCandidate: HorizontalState = 'NONE'
  #leanCandidateFrames = 0
  #leftReachActive = false
  #leftReachCandidateFrames = 0
  #rightReachActive = false
  #rightReachCandidateFrames = 0
  #squatState: PoseSquatState = 'STANDING'
  #squatCandidateFrames = 0
  #jumpState: PoseJumpState = 'GROUNDED'
  #jumpCandidateStartedAtMs = 0
  #jumpRefractoryUntilMs = 0
  #previousHipY: number | undefined
  #previousFeatureTimestampMs: number | undefined
  #smoothedMove = 0
  #smoothedLean = 0
  #smoothedSquatDepth = 0
  #analyzerDurationMs = 0

  constructor(overrides: Partial<PoseMotionConfig> = {}) {
    this.#config = mergeConfig(overrides)
    this.#extractor = new PoseFeatureExtractor({
      minimumLandmarkConfidence: this.#config.minimumLandmarkConfidence,
    })
    this.#initializeActions(0)
  }

  reset(): void {
    this.#quality = 'LOST'
    this.#baseline = undefined
    this.#baselineAccumulator = undefined
    this.#baselineProgress = 0
    this.#lastPoseTimestampMs = undefined
    this.#snapshotSequence += 1
    this.#resetTransientStates()
    this.#initializeActions(0)
  }

  ingest(frame: PoseSensorFrame): void {
    const startedAt = now()
    const features = this.#extractor.extract(frame)
    const previousPoseTimestamp = this.#lastPoseTimestampMs

    if (!features.posePresent || !features.coreValid) {
      this.#quality = features.posePresent ? 'LIMITED' : 'LOST'
      this.#resetTransientStates()
      this.#neutralizeActions(frame.timestampMs)
      this.#snapshotSequence += 1
      this.#analyzerDurationMs = Math.max(0, now() - startedAt)
      return
    }

    if (
      previousPoseTimestamp !== undefined &&
      frame.timestampMs - previousPoseTimestamp > this.#config.resetBaselineAfterLossMs
    ) {
      this.#clearBaseline()
    } else if (
      previousPoseTimestamp !== undefined &&
      frame.timestampMs - previousPoseTimestamp > this.#config.staleAfterMs
    ) {
      this.#resetTransientStates()
      this.#neutralizeActions(frame.timestampMs)
    }
    this.#lastPoseTimestampMs = frame.timestampMs

    if (!this.#baseline) {
      if (!features.fullBodyValid) {
        this.#baselineAccumulator = undefined
        this.#baselineProgress = 0
        this.#quality = 'LIMITED'
        this.#neutralizeActions(frame.timestampMs)
        this.#snapshotSequence += 1
        this.#analyzerDurationMs = Math.max(0, now() - startedAt)
        return
      }
      this.#collectBaseline(features)
      this.#neutralizeActions(frame.timestampMs)
      this.#snapshotSequence += 1
      this.#analyzerDurationMs = Math.max(0, now() - startedAt)
      return
    }

    this.#quality = features.fullBodyValid ? 'READY' : 'LIMITED'
    this.#advanceJumpPulse(frame.timestampMs)
    this.#analyzeMove(features)
    this.#analyzeLean(features)
    this.#analyzeReach(features)
    this.#analyzeSquat(features)
    this.#analyzeJump(features)
    this.#previousHipY = features.hipMidpoint.y
    this.#previousFeatureTimestampMs = features.timestampMs
    this.#snapshotSequence += 1
    this.#analyzerDurationMs = Math.max(0, now() - startedAt)
  }

  getSnapshot(nowMs: number): PoseMotionAnalyzerSnapshot {
    const qualityBeforeFreshnessCheck = this.#quality
    const baselineBeforeFreshnessCheck = this.#baseline
    const actionSequenceBeforeFreshnessCheck = this.#actionSequence
    let freshnessMs: number | null = null
    if (this.#lastPoseTimestampMs !== undefined) {
      freshnessMs = Math.max(0, nowMs - this.#lastPoseTimestampMs)
      if (freshnessMs > this.#config.staleAfterMs) {
        this.#quality = 'LOST'
        this.#resetTransientStates()
        this.#neutralizeActions(nowMs)
      }
      if (freshnessMs > this.#config.resetBaselineAfterLossMs) {
        this.#clearBaseline()
      }
    }
    if (
      qualityBeforeFreshnessCheck !== this.#quality ||
      baselineBeforeFreshnessCheck !== this.#baseline ||
      actionSequenceBeforeFreshnessCheck !== this.#actionSequence
    ) {
      this.#snapshotSequence += 1
    }

    return Object.freeze({
      timestampMs: nowMs,
      sequence: this.#snapshotSequence,
      quality: this.#quality,
      baselineReady: Boolean(this.#baseline),
      baselineProgress: this.#baselineProgress,
      freshnessMs,
      squatState: this.#squatState,
      jumpState: this.#jumpState,
      analyzerDurationMs: this.#analyzerDurationMs,
      actions: Object.freeze({ ...this.#actions }),
    })
  }

  #initializeActions(timestampMs: number): void {
    for (const actionId of POSE_ACTION_IDS) {
      this.#actions[actionId] = Object.freeze({
        id: actionId,
        value: 0,
        phase: 'idle',
        confidence: 0,
        timestampMs,
        sequence: ++this.#actionSequence,
      })
    }
  }

  #collectBaseline(features: PoseFeatureFrame): void {
    const accumulator = this.#baselineAccumulator
    const scale = Math.max(features.bodyScale, Number.EPSILON)
    const stable =
      !accumulator ||
      Math.hypot(
        (features.hipMidpoint.x - accumulator.lastHipX) * features.aspectRatio,
        features.hipMidpoint.y - accumulator.lastHipY,
      ) /
        scale <=
        this.#config.baselineStabilityBodyUnits

    if (!accumulator || !stable) {
      this.#baselineAccumulator = {
        startedAtMs: features.timestampMs,
        lastHipX: features.hipMidpoint.x,
        lastHipY: features.hipMidpoint.y,
        samples: 1,
        hipX: features.hipMidpoint.x,
        hipY: features.hipMidpoint.y,
        leftAnkleY: features.leftAnkle.y,
        rightAnkleY: features.rightAnkle.y,
        bodyScale: features.bodyScale,
        aspectRatio: features.aspectRatio,
      }
      this.#baselineProgress = 0
      this.#quality = 'BASELINING'
      return
    }

    accumulator.lastHipX = features.hipMidpoint.x
    accumulator.lastHipY = features.hipMidpoint.y
    accumulator.samples += 1
    accumulator.hipX += features.hipMidpoint.x
    accumulator.hipY += features.hipMidpoint.y
    accumulator.leftAnkleY += features.leftAnkle.y
    accumulator.rightAnkleY += features.rightAnkle.y
    accumulator.bodyScale += features.bodyScale
    accumulator.aspectRatio += features.aspectRatio
    const elapsedMs = features.timestampMs - accumulator.startedAtMs
    this.#baselineProgress = clamp01(
      Math.min(
        elapsedMs / this.#config.baselineDurationMs,
        accumulator.samples / this.#config.baselineMinimumSamples,
      ),
    )
    this.#quality = 'BASELINING'

    if (
      elapsedMs < this.#config.baselineDurationMs ||
      accumulator.samples < this.#config.baselineMinimumSamples
    ) {
      return
    }

    const divisor = accumulator.samples
    this.#baseline = {
      hipX: accumulator.hipX / divisor,
      hipY: accumulator.hipY / divisor,
      leftAnkleY: accumulator.leftAnkleY / divisor,
      rightAnkleY: accumulator.rightAnkleY / divisor,
      bodyScale: accumulator.bodyScale / divisor,
      aspectRatio: accumulator.aspectRatio / divisor,
    }
    this.#baselineProgress = 1
    this.#quality = features.fullBodyValid ? 'READY' : 'LIMITED'
    this.#previousHipY = features.hipMidpoint.y
    this.#previousFeatureTimestampMs = features.timestampMs
  }

  #analyzeMove(features: PoseFeatureFrame): void {
    const baseline = this.#baseline
    if (!baseline) return
    const rawDelta = features.hipMidpoint.x - baseline.hipX
    const canonicalDelta = canonicalizeHorizontalDelta(
      rawDelta,
      this.#config.coordinateTransform,
    )
    const normalized =
      (canonicalDelta * baseline.aspectRatio) / baseline.bodyScale
    const moveFilterStart =
      Math.sign(this.#smoothedMove) !== Math.sign(normalized) ? 0 : this.#smoothedMove
    this.#smoothedMove = ema(
      moveFilterStart,
      normalized,
      this.#config.smoothingAlpha,
    )
    this.#moveState = this.#nextHorizontalState(
      this.#moveState,
      this.#smoothedMove,
      this.#config.move,
      'move',
    )
    const moveRange = this.#smoothedMove < 0
      ? this.#config.move.left
      : this.#config.move.right
    const intensity = clamp01(
      Math.abs(this.#smoothedMove) /
        moveRange.fullIntensityBodyUnits,
    )
    const confidence = features.trackingConfidence
    this.#setAction(
      'MOVE_LEFT',
      this.#moveState === 'LEFT' ? intensity : 0,
      confidence,
      features.timestampMs,
    )
    this.#setAction(
      'MOVE_RIGHT',
      this.#moveState === 'RIGHT' ? intensity : 0,
      confidence,
      features.timestampMs,
    )
  }

  #analyzeLean(features: PoseFeatureFrame): void {
    const baseline = this.#baseline
    if (!baseline) return
    const shoulderToHipX =
      features.shoulderMidpoint.x - features.hipMidpoint.x
    const canonicalDelta = canonicalizeHorizontalDelta(
      shoulderToHipX,
      this.#config.coordinateTransform,
    )
    const normalized =
      (canonicalDelta * features.aspectRatio) /
      Math.max(features.torsoLength, Number.EPSILON)
    const leanFilterStart =
      Math.sign(this.#smoothedLean) !== Math.sign(normalized) ? 0 : this.#smoothedLean
    this.#smoothedLean = ema(
      leanFilterStart,
      normalized,
      this.#config.smoothingAlpha,
    )
    this.#leanState = this.#nextHorizontalState(
      this.#leanState,
      this.#smoothedLean,
      this.#config.lean,
      'lean',
    )
    const leanRange = this.#smoothedLean < 0
      ? this.#config.lean.left
      : this.#config.lean.right
    const intensity = clamp01(
      Math.abs(this.#smoothedLean) /
        leanRange.fullIntensityBodyUnits,
    )
    this.#setAction(
      'LEAN_LEFT',
      this.#leanState === 'LEFT' ? intensity : 0,
      features.trackingConfidence,
      features.timestampMs,
    )
    this.#setAction(
      'LEAN_RIGHT',
      this.#leanState === 'RIGHT' ? intensity : 0,
      features.trackingConfidence,
      features.timestampMs,
    )
  }

  #nextHorizontalState(
    current: HorizontalState,
    value: number,
    thresholds: PoseMotionConfig['move'] | PoseMotionConfig['lean'],
    detector: 'move' | 'lean',
  ): HorizontalState {
    const desired: HorizontalState =
      value <= -thresholds.left.enterBodyUnits
        ? 'LEFT'
        : value >= thresholds.right.enterBodyUnits
          ? 'RIGHT'
          : 'NONE'
    if (current !== 'NONE') {
      const signed = current === 'LEFT' ? -value : value
      if (desired !== 'NONE' && desired !== current) {
        this.#clearHorizontalCandidate(detector)
        return desired
      }
      const exit = current === 'LEFT'
        ? thresholds.left.exitBodyUnits
        : thresholds.right.exitBodyUnits
      if (signed >= exit) return current
      this.#clearHorizontalCandidate(detector)
      return 'NONE'
    }
    if (desired === 'NONE') {
      this.#clearHorizontalCandidate(detector)
      return 'NONE'
    }

    if (detector === 'move') {
      if (this.#moveCandidate === desired) this.#moveCandidateFrames += 1
      else {
        this.#moveCandidate = desired
        this.#moveCandidateFrames = 1
      }
      if (this.#moveCandidateFrames >= this.#config.detectorDebounceFrames) {
        this.#clearHorizontalCandidate(detector)
        return desired
      }
    } else {
      if (this.#leanCandidate === desired) this.#leanCandidateFrames += 1
      else {
        this.#leanCandidate = desired
        this.#leanCandidateFrames = 1
      }
      if (this.#leanCandidateFrames >= this.#config.detectorDebounceFrames) {
        this.#clearHorizontalCandidate(detector)
        return desired
      }
    }
    return 'NONE'
  }

  #clearHorizontalCandidate(detector: 'move' | 'lean'): void {
    if (detector === 'move') {
      this.#moveCandidate = 'NONE'
      this.#moveCandidateFrames = 0
    } else {
      this.#leanCandidate = 'NONE'
      this.#leanCandidateFrames = 0
    }
  }

  #analyzeReach(features: PoseFeatureFrame): void {
    const leftScore = this.#reachScore(features, 'LEFT')
    const rightScore = this.#reachScore(features, 'RIGHT')
    this.#leftReachActive = this.#nextReachState(
      this.#leftReachActive,
      leftScore,
      'LEFT',
    )
    this.#rightReachActive = this.#nextReachState(
      this.#rightReachActive,
      rightScore,
      'RIGHT',
    )
    const leftValue = this.#leftReachActive ? leftScore : 0
    const rightValue = this.#rightReachActive ? rightScore : 0
    this.#setAction(
      'REACH_LEFT',
      leftValue,
      features.leftArm.confidence,
      features.timestampMs,
    )
    this.#setAction(
      'REACH_RIGHT',
      rightValue,
      features.rightArm.confidence,
      features.timestampMs,
    )
    this.#setAction(
      'REACH',
      Math.max(leftValue, rightValue),
      Math.max(features.leftArm.confidence, features.rightArm.confidence),
      features.timestampMs,
    )
  }

  #reachScore(features: PoseFeatureFrame, side: 'LEFT' | 'RIGHT'): number {
    const arm = side === 'LEFT' ? features.leftArm : features.rightArm
    const normalization = side === 'LEFT'
      ? this.#config.reach.left
      : this.#config.reach.right
    const shoulder =
      side === 'LEFT' ? features.leftShoulder : features.rightShoulder
    const wrist = side === 'LEFT' ? features.leftWrist : features.rightWrist
    if (!arm.valid || !shoulder.valid || !wrist.valid) return 0
    const outside =
      (Math.abs(wrist.x - shoulder.x) * features.aspectRatio) /
      features.bodyScale
    const aboveHips = wrist.y < features.hipMidpoint.y - features.bodyScale * 0.05
    const intentional =
      outside >= this.#config.reach.minimumOutsideBodyUnits || aboveHips
    if (
      !intentional ||
      arm.elbowAngleDegrees < this.#config.reach.minimumElbowAngleDegrees
    ) {
      return 0
    }
    const extensionScore = clamp01(
      (arm.extensionRatio - normalization.minimumExtensionRatio) /
        Math.max(
          normalization.fullExtensionRatio - normalization.minimumExtensionRatio,
          Number.EPSILON,
        ),
    )
    const outsideScore = clamp01(
      outside / (this.#config.reach.minimumOutsideBodyUnits * 1.5),
    )
    return Math.max(extensionScore, outsideScore)
  }

  #nextReachState(
    active: boolean,
    score: number,
    side: 'LEFT' | 'RIGHT',
  ): boolean {
    if (active) {
      if (score >= this.#config.reach.exitScore) return true
      if (side === 'LEFT') this.#leftReachCandidateFrames = 0
      else this.#rightReachCandidateFrames = 0
      return false
    }
    if (score < this.#config.reach.enterScore) {
      if (side === 'LEFT') this.#leftReachCandidateFrames = 0
      else this.#rightReachCandidateFrames = 0
      return false
    }
    if (side === 'LEFT') {
      this.#leftReachCandidateFrames += 1
      if (
        this.#leftReachCandidateFrames >= this.#config.detectorDebounceFrames
      ) {
        this.#leftReachCandidateFrames = 0
        return true
      }
    } else {
      this.#rightReachCandidateFrames += 1
      if (
        this.#rightReachCandidateFrames >= this.#config.detectorDebounceFrames
      ) {
        this.#rightReachCandidateFrames = 0
        return true
      }
    }
    return false
  }

  #analyzeSquat(features: PoseFeatureFrame): void {
    const baseline = this.#baseline
    if (!baseline || !features.fullBodyValid) {
      this.#squatState = 'STANDING'
      this.#squatCandidateFrames = 0
      this.#setAction('SQUAT', 0, 0, features.timestampMs)
      return
    }
    const rawDepth =
      (features.hipMidpoint.y - baseline.hipY) / baseline.bodyScale
    this.#smoothedSquatDepth = ema(
      this.#smoothedSquatDepth,
      rawDepth,
      this.#config.smoothingAlpha,
    )
    const kneeAngle =
      (features.leftKnee.angleDegrees + features.rightKnee.angleDegrees) / 2
    const enterCandidate =
      rawDepth >= this.#config.squat.enterDepthBodyUnits &&
      kneeAngle <= this.#config.squat.maximumEnterKneeAngleDegrees

    if (this.#squatState === 'STANDING') {
      if (enterCandidate) {
        this.#squatCandidateFrames += 1
        this.#squatState = 'DESCENDING'
      } else {
        this.#squatCandidateFrames = 0
      }
    } else if (this.#squatState === 'DESCENDING') {
      if (enterCandidate) this.#squatCandidateFrames += 1
      else {
        this.#squatState = 'STANDING'
        this.#squatCandidateFrames = 0
      }
      if (
        this.#squatCandidateFrames >= this.#config.detectorDebounceFrames
      ) {
        this.#squatState = 'SQUAT'
        this.#squatCandidateFrames = 0
      }
    } else if (this.#squatState === 'SQUAT') {
      if (rawDepth < this.#config.squat.exitDepthBodyUnits) {
        this.#squatState = 'RISING'
        this.#squatCandidateFrames = 1
      }
    } else if (rawDepth < this.#config.squat.exitDepthBodyUnits) {
      this.#squatCandidateFrames += 1
      if (
        this.#squatCandidateFrames >= this.#config.detectorDebounceFrames
      ) {
        this.#squatState = 'STANDING'
        this.#squatCandidateFrames = 0
      }
    } else {
      this.#squatState = 'SQUAT'
      this.#squatCandidateFrames = 0
    }

    const active =
      this.#squatState === 'SQUAT' || this.#squatState === 'RISING'
    const intensity = active
      ? clamp01(
          Math.max(rawDepth, this.#smoothedSquatDepth) /
            this.#config.squat.fullDepthBodyUnits,
        )
      : 0
    this.#setAction(
      'SQUAT',
      intensity,
      Math.min(features.leftKnee.confidence, features.rightKnee.confidence),
      features.timestampMs,
    )
  }

  #analyzeJump(features: PoseFeatureFrame): void {
    const baseline = this.#baseline
    if (!baseline || !features.fullBodyValid) {
      this.#jumpState = 'GROUNDED'
      return
    }
    const timestampMs = features.timestampMs
    if (this.#jumpState === 'LANDING') {
      this.#jumpState =
        timestampMs >= this.#jumpRefractoryUntilMs
          ? 'GROUNDED'
          : 'REFRACTORY'
    }
    if (
      this.#jumpState === 'REFRACTORY' &&
      timestampMs >= this.#jumpRefractoryUntilMs
    ) {
      this.#jumpState = 'GROUNDED'
    }
    if (this.#jumpState === 'REFRACTORY') {
      return
    }

    const pelvisRise =
      (baseline.hipY - features.hipMidpoint.y) / baseline.bodyScale
    const footRise = Math.min(
      (baseline.leftAnkleY - features.leftAnkle.y) / baseline.bodyScale,
      (baseline.rightAnkleY - features.rightAnkle.y) / baseline.bodyScale,
    )
    const elapsedSeconds = Math.max(
      0.001,
      (timestampMs - (this.#previousFeatureTimestampMs ?? timestampMs)) /
        1_000,
    )
    const upwardVelocity =
      this.#previousHipY === undefined
        ? 0
        : (this.#previousHipY - features.hipMidpoint.y) /
          baseline.bodyScale /
          elapsedSeconds
    const takeoff =
      pelvisRise >= this.#config.jump.takeoffRiseBodyUnits &&
      upwardVelocity >=
        this.#config.jump.takeoffVelocityBodyUnitsPerSecond &&
      footRise >= this.#config.jump.minimumFootRiseBodyUnits

    if (this.#jumpState === 'GROUNDED' && takeoff) {
      this.#jumpState = 'TAKEOFF_CANDIDATE'
      this.#jumpCandidateStartedAtMs = timestampMs
      return
    }
    if (this.#jumpState === 'TAKEOFF_CANDIDATE') {
      if (
        timestampMs - this.#jumpCandidateStartedAtMs >
        this.#config.jump.candidateWindowMs
      ) {
        this.#jumpState = 'GROUNDED'
        return
      }
      if (
        pelvisRise >= this.#config.jump.airborneRiseBodyUnits &&
        footRise >= this.#config.jump.minimumFootRiseBodyUnits
      ) {
        this.#jumpState = 'AIRBORNE'
        this.#setAction(
          'JUMP',
          1,
          Math.min(features.trackingConfidence, features.leftAnkle.confidence, features.rightAnkle.confidence),
          timestampMs,
        )
      }
      return
    }
    if (
      this.#jumpState === 'AIRBORNE' &&
      pelvisRise <= this.#config.jump.landingRiseBodyUnits
    ) {
      this.#jumpState = 'LANDING'
      this.#jumpRefractoryUntilMs = timestampMs + this.#config.jump.refractoryMs
    }
  }

  #advanceJumpPulse(timestampMs: number): void {
    if (numericValue(this.#actions.JUMP) > 0) {
      this.#setAction('JUMP', 0, 0, timestampMs)
    } else if (this.#actions.JUMP?.phase === 'ended') {
      this.#actions.JUMP = Object.freeze({
        ...this.#actions.JUMP,
        phase: 'idle',
        timestampMs,
      })
    }
  }

  #setAction(
    actionId: MotionActionId,
    rawValue: number,
    confidence: number,
    timestampMs: number,
  ): void {
    const previous = this.#actions[actionId]
    const value = clamp01(rawValue)
    const previousValue = numericValue(previous)
    const phase: MotionActionPhase =
      value > 0
        ? previousValue > 0
          ? 'active'
          : 'started'
        : previousValue > 0
          ? 'ended'
          : 'idle'
    if (
      previous &&
      previousValue === value &&
      previous.phase === phase &&
      previous.confidence === confidence
    ) {
      return
    }
    this.#actions[actionId] = Object.freeze({
      id: actionId,
      value,
      phase,
      confidence: clamp01(confidence),
      timestampMs,
      sequence: ++this.#actionSequence,
    })
  }

  #neutralizeActions(timestampMs: number): void {
    for (const actionId of POSE_ACTION_IDS) {
      this.#setAction(actionId, 0, 0, timestampMs)
    }
  }

  #resetTransientStates(): void {
    this.#moveState = 'NONE'
    this.#clearHorizontalCandidate('move')
    this.#leanState = 'NONE'
    this.#clearHorizontalCandidate('lean')
    this.#leftReachActive = false
    this.#leftReachCandidateFrames = 0
    this.#rightReachActive = false
    this.#rightReachCandidateFrames = 0
    this.#squatState = 'STANDING'
    this.#squatCandidateFrames = 0
    this.#jumpState = 'GROUNDED'
    this.#jumpCandidateStartedAtMs = 0
    this.#jumpRefractoryUntilMs = 0
    this.#previousHipY = undefined
    this.#previousFeatureTimestampMs = undefined
    this.#smoothedMove = 0
    this.#smoothedLean = 0
    this.#smoothedSquatDepth = 0
  }

  #clearBaseline(): void {
    this.#baseline = undefined
    this.#baselineAccumulator = undefined
    this.#baselineProgress = 0
    this.#quality = 'LOST'
    this.#resetTransientStates()
  }
}
