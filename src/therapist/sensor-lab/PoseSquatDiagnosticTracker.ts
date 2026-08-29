import type { PoseSensorFrame } from '../../sensors/pose/poseTypes'
import { PoseFeatureExtractor } from '../../motion/pose/PoseFeatureExtractor'
import { POSE_MOTION_CONFIG } from '../../motion/pose/poseMotionConfig'
import type { PoseFeatureFrame } from '../../motion/pose/poseMotionTypes'

interface DiagnosticBaseline {
  readonly hipY: number
  readonly bodyScale: number
}

interface BaselineAccumulator {
  startedAtMs: number
  lastHipX: number
  lastHipY: number
  samples: number
  hipY: number
  bodyScale: number
}

export interface SquatDiagnosticSnapshot {
  readonly baselineReady: boolean
  readonly baselineProgress: number
  readonly fullBodyValid: boolean
  readonly hipDepthBodyUnits: number | null
  readonly requiredHipDepthBodyUnits: number
  readonly depthPass: boolean
  readonly leftKneeAngleDegrees: number | null
  readonly rightKneeAngleDegrees: number | null
  readonly averageKneeAngleDegrees: number | null
  readonly maximumKneeAngleDegrees: number
  readonly kneePass: boolean
  readonly candidateFrames: number
  readonly requiredCandidateFrames: number
  readonly candidatePass: boolean
}

const EMPTY_SNAPSHOT: SquatDiagnosticSnapshot = {
  baselineReady: false,
  baselineProgress: 0,
  fullBodyValid: false,
  hipDepthBodyUnits: null,
  requiredHipDepthBodyUnits: POSE_MOTION_CONFIG.squat.enterDepthBodyUnits,
  depthPass: false,
  leftKneeAngleDegrees: null,
  rightKneeAngleDegrees: null,
  averageKneeAngleDegrees: null,
  maximumKneeAngleDegrees: POSE_MOTION_CONFIG.squat.maximumEnterKneeAngleDegrees,
  kneePass: false,
  candidateFrames: 0,
  requiredCandidateFrames: POSE_MOTION_CONFIG.detectorDebounceFrames,
  candidatePass: false,
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

export class PoseSquatDiagnosticTracker {
  readonly #extractor = new PoseFeatureExtractor({
    minimumLandmarkConfidence: POSE_MOTION_CONFIG.minimumLandmarkConfidence,
  })

  #baseline: DiagnosticBaseline | undefined
  #baselineAccumulator: BaselineAccumulator | undefined
  #baselineProgress = 0
  #lastPoseTimestampMs: number | undefined
  #candidateFrames = 0
  #snapshot: SquatDiagnosticSnapshot = EMPTY_SNAPSHOT

  reset(): void {
    this.#baseline = undefined
    this.#baselineAccumulator = undefined
    this.#baselineProgress = 0
    this.#lastPoseTimestampMs = undefined
    this.#candidateFrames = 0
    this.#snapshot = EMPTY_SNAPSHOT
  }

  ingest(frame: PoseSensorFrame): void {
    const features = this.#extractor.extract(frame)
    const previousPoseTimestamp = this.#lastPoseTimestampMs

    if (!features.posePresent || !features.coreValid) {
      if (!this.#baseline) {
        this.#baselineAccumulator = undefined
        this.#baselineProgress = 0
      }
      this.#candidateFrames = 0
      this.#snapshot = this.#makeSnapshot(features)
      return
    }

    if (
      previousPoseTimestamp !== undefined &&
      frame.timestampMs - previousPoseTimestamp >
        POSE_MOTION_CONFIG.resetBaselineAfterLossMs
    ) {
      this.#baseline = undefined
      this.#baselineAccumulator = undefined
      this.#baselineProgress = 0
      this.#candidateFrames = 0
    } else if (
      previousPoseTimestamp !== undefined &&
      frame.timestampMs - previousPoseTimestamp > POSE_MOTION_CONFIG.staleAfterMs
    ) {
      this.#candidateFrames = 0
    }
    this.#lastPoseTimestampMs = frame.timestampMs

    if (!this.#baseline) {
      if (!features.fullBodyValid) {
        this.#baselineAccumulator = undefined
        this.#baselineProgress = 0
        this.#candidateFrames = 0
        this.#snapshot = this.#makeSnapshot(features)
        return
      }
      this.#collectBaseline(features)
      this.#candidateFrames = 0
      this.#snapshot = this.#makeSnapshot(features)
      return
    }

    this.#snapshot = this.#makeSnapshot(features)
  }

  getSnapshot(): SquatDiagnosticSnapshot {
    return this.#snapshot
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
        POSE_MOTION_CONFIG.baselineStabilityBodyUnits

    if (!accumulator || !stable) {
      this.#baselineAccumulator = {
        startedAtMs: features.timestampMs,
        lastHipX: features.hipMidpoint.x,
        lastHipY: features.hipMidpoint.y,
        samples: 1,
        hipY: features.hipMidpoint.y,
        bodyScale: features.bodyScale,
      }
      this.#baselineProgress = 0
      return
    }

    accumulator.lastHipX = features.hipMidpoint.x
    accumulator.lastHipY = features.hipMidpoint.y
    accumulator.samples += 1
    accumulator.hipY += features.hipMidpoint.y
    accumulator.bodyScale += features.bodyScale

    const elapsedMs = features.timestampMs - accumulator.startedAtMs
    this.#baselineProgress = clamp01(
      Math.min(
        elapsedMs / POSE_MOTION_CONFIG.baselineDurationMs,
        accumulator.samples / POSE_MOTION_CONFIG.baselineMinimumSamples,
      ),
    )

    if (
      elapsedMs < POSE_MOTION_CONFIG.baselineDurationMs ||
      accumulator.samples < POSE_MOTION_CONFIG.baselineMinimumSamples
    ) {
      return
    }

    this.#baseline = {
      hipY: accumulator.hipY / accumulator.samples,
      bodyScale: accumulator.bodyScale / accumulator.samples,
    }
    this.#baselineProgress = 1
  }

  #makeSnapshot(features: PoseFeatureFrame): SquatDiagnosticSnapshot {
    const baseline = this.#baseline
    const fullBodyValid = features.fullBodyValid
    const hipDepthBodyUnits =
      baseline && fullBodyValid
        ? (features.hipMidpoint.y - baseline.hipY) /
          Math.max(baseline.bodyScale, Number.EPSILON)
        : null
    const leftKneeAngleDegrees =
      fullBodyValid && features.leftKnee.valid
        ? features.leftKnee.angleDegrees
        : null
    const rightKneeAngleDegrees =
      fullBodyValid && features.rightKnee.valid
        ? features.rightKnee.angleDegrees
        : null
    const averageKneeAngleDegrees =
      leftKneeAngleDegrees !== null && rightKneeAngleDegrees !== null
        ? (leftKneeAngleDegrees + rightKneeAngleDegrees) / 2
        : null
    const depthPass =
      hipDepthBodyUnits !== null &&
      hipDepthBodyUnits >= POSE_MOTION_CONFIG.squat.enterDepthBodyUnits
    const kneePass =
      averageKneeAngleDegrees !== null &&
      averageKneeAngleDegrees <=
        POSE_MOTION_CONFIG.squat.maximumEnterKneeAngleDegrees

    if (baseline && fullBodyValid && depthPass && kneePass) {
      this.#candidateFrames = Math.min(
        POSE_MOTION_CONFIG.detectorDebounceFrames,
        this.#candidateFrames + 1,
      )
    } else {
      this.#candidateFrames = 0
    }

    return Object.freeze({
      baselineReady: Boolean(baseline),
      baselineProgress: this.#baselineProgress,
      fullBodyValid,
      hipDepthBodyUnits,
      requiredHipDepthBodyUnits: POSE_MOTION_CONFIG.squat.enterDepthBodyUnits,
      depthPass,
      leftKneeAngleDegrees,
      rightKneeAngleDegrees,
      averageKneeAngleDegrees,
      maximumKneeAngleDegrees:
        POSE_MOTION_CONFIG.squat.maximumEnterKneeAngleDegrees,
      kneePass,
      candidateFrames: this.#candidateFrames,
      requiredCandidateFrames: POSE_MOTION_CONFIG.detectorDebounceFrames,
      candidatePass:
        this.#candidateFrames >= POSE_MOTION_CONFIG.detectorDebounceFrames,
    })
  }
}
