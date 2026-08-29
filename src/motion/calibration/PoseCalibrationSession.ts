import type {
  PlayerCalibration,
  PlayerCalibrationStep,
} from '../contracts/motion'
import {
  canonicalizeHorizontalDelta,
  clamp01,
} from '../coordinates/normalizeCoordinates'
import type { PoseFeatureFrame } from '../pose/poseMotionTypes'
import {
  POSE_CALIBRATION_CONFIG,
  type PoseCalibrationConfig,
} from './poseCalibrationConfig'

export type PoseCalibrationFlowStep =
  | 'WELCOME'
  | PlayerCalibrationStep
  | 'REVIEW'
  | 'COMPLETE'

export type PoseCalibrationCollectionState =
  | 'IDLE'
  | 'WAITING_FOR_TRACKING'
  | 'COLLECTING'
  | 'READY'

export type PoseCalibrationProgressStatus =
  | 'PENDING'
  | 'COLLECTING'
  | 'COMPLETE'
  | 'SKIPPED'

interface CalibrationMeasurements {
  readonly move: {
    readonly leftRangeBodyUnits: number | null
    readonly rightRangeBodyUnits: number | null
  }
  readonly lean: {
    readonly leftRangeBodyUnits: number | null
    readonly rightRangeBodyUnits: number | null
  }
  readonly reach: {
    readonly leftCapability: number | null
    readonly rightCapability: number | null
  }
  readonly squat: {
    readonly comfortableDepthBodyUnits: number | null
  }
}

export interface PoseCalibrationSnapshot {
  readonly step: PoseCalibrationFlowStep
  readonly collectionState: PoseCalibrationCollectionState
  readonly readyToAdvance: boolean
  readonly progress: number
  readonly sideProgress: { readonly left: boolean; readonly right: boolean } | null
  readonly stepStatuses: Readonly<Record<PlayerCalibrationStep, PoseCalibrationProgressStatus>>
  readonly measurements: CalibrationMeasurements
  readonly trackingConfidence: number
  readonly result: PlayerCalibration | null
}

interface NeutralSample {
  readonly timestampMs: number
  readonly hipX: number
  readonly hipY: number
  readonly shoulderX: number
  readonly bodyScale: number
  readonly torsoLength: number
  readonly aspectRatio: number
  readonly confidence: number
}

interface NeutralBaseline {
  readonly hipX: number
  readonly hipY: number
  readonly shoulderX: number
  readonly bodyScale: number
  readonly torsoLength: number
  readonly aspectRatio: number
}

const FLOW: readonly PoseCalibrationFlowStep[] = [
  'WELCOME',
  'NEUTRAL',
  'MOVE',
  'LEAN',
  'REACH',
  'SQUAT',
  'REVIEW',
  'COMPLETE',
]

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function emptyMeasurements(): CalibrationMeasurements {
  return {
    move: { leftRangeBodyUnits: null, rightRangeBodyUnits: null },
    lean: { leftRangeBodyUnits: null, rightRangeBodyUnits: null },
    reach: { leftCapability: null, rightCapability: null },
    squat: { comfortableDepthBodyUnits: null },
  }
}

function initialStatuses(): Record<PlayerCalibrationStep, PoseCalibrationProgressStatus> {
  return {
    NEUTRAL: 'PENDING',
    MOVE: 'PENDING',
    LEAN: 'PENDING',
    REACH: 'PENDING',
    SQUAT: 'PENDING',
  }
}

function maxNullable(current: number | null, value: number): number {
  return Math.max(current ?? 0, value)
}

export class PoseCalibrationSession {
  readonly #config: PoseCalibrationConfig
  #step: PoseCalibrationFlowStep = 'WELCOME'
  #collectionState: PoseCalibrationCollectionState = 'IDLE'
  #readyToAdvance = true
  #progress = 0
  #statuses = initialStatuses()
  #measurements = emptyMeasurements()
  #neutralSamples: NeutralSample[] = []
  #baseline: NeutralBaseline | null = null
  #leftCandidateFrames = 0
  #rightCandidateFrames = 0
  #squatCandidateFrames = 0
  #trackingRecoveryFrames = 0
  #trackingConfidence = 0
  #confidenceSum = 0
  #validSampleCount = 0
  #lastTimestampMs = 0
  #result: PlayerCalibration | null = null

  constructor(config: PoseCalibrationConfig = POSE_CALIBRATION_CONFIG) {
    this.#config = config
  }

  ingest(features: PoseFeatureFrame): void {
    if (!this.#isMeasurementStep(this.#step)) return
    this.#lastTimestampMs = features.timestampMs
    this.#trackingConfidence = features.trackingConfidence

    if (!this.#hasRequiredTracking(features)) {
      this.#collectionState = 'WAITING_FOR_TRACKING'
      this.#trackingRecoveryFrames = this.#config.trackingRecoveryFrames
      this.#resetCandidateStreaks()
      if (this.#step === 'NEUTRAL') {
        this.#neutralSamples = []
        this.#progress = 0
      }
      return
    }

    if (this.#trackingRecoveryFrames > 0) {
      this.#trackingRecoveryFrames -= 1
      this.#collectionState = 'WAITING_FOR_TRACKING'
      return
    }

    this.#confidenceSum += features.trackingConfidence
    this.#validSampleCount += 1
    this.#collectionState = 'COLLECTING'

    if (this.#step === 'NEUTRAL') this.#ingestNeutral(features)
    if (this.#step === 'MOVE') this.#ingestMove(features)
    if (this.#step === 'LEAN') this.#ingestLean(features)
    if (this.#step === 'REACH') this.#ingestReach(features)
    if (this.#step === 'SQUAT') this.#ingestSquat(features)
  }

  advance(): void {
    if (!this.#readyToAdvance) return
    if (this.#isMeasurementStep(this.#step)) {
      this.#statuses[this.#step] = 'COMPLETE'
    }

    const currentIndex = FLOW.indexOf(this.#step)
    this.#step = FLOW[Math.min(currentIndex + 1, FLOW.length - 1)] ?? 'COMPLETE'
    this.#resetCurrentCollectionState()

    if (this.#step === 'REVIEW') {
      this.#result = this.#buildResult()
      this.#collectionState = 'IDLE'
      this.#readyToAdvance = true
    } else if (this.#step === 'COMPLETE' || this.#step === 'WELCOME') {
      this.#collectionState = 'IDLE'
      this.#readyToAdvance = this.#step !== 'COMPLETE'
    } else {
      this.#statuses[this.#step] = 'COLLECTING'
    }
  }

  retry(): void {
    if (!this.#isMeasurementStep(this.#step)) return
    this.#clearMeasurement(this.#step)
    this.#statuses[this.#step] = 'COLLECTING'
    if (this.#step === 'NEUTRAL') this.#baseline = null
    this.#resetCurrentCollectionState()
  }

  skip(): void {
    if (!this.#isOptionalStep(this.#step)) return
    this.#clearMeasurement(this.#step)
    this.#statuses[this.#step] = 'SKIPPED'
    const currentIndex = FLOW.indexOf(this.#step)
    this.#step = FLOW[Math.min(currentIndex + 1, FLOW.length - 1)] ?? 'REVIEW'
    this.#resetCurrentCollectionState()
    if (this.#step === 'REVIEW') {
      this.#result = this.#buildResult()
      this.#collectionState = 'IDLE'
      this.#readyToAdvance = true
    } else if (this.#isMeasurementStep(this.#step)) {
      this.#statuses[this.#step] = 'COLLECTING'
    }
  }

  reset(): void {
    this.#step = 'WELCOME'
    this.#collectionState = 'IDLE'
    this.#readyToAdvance = true
    this.#progress = 0
    this.#statuses = initialStatuses()
    this.#measurements = emptyMeasurements()
    this.#neutralSamples = []
    this.#baseline = null
    this.#resetCandidateStreaks()
    this.#trackingRecoveryFrames = 0
    this.#trackingConfidence = 0
    this.#confidenceSum = 0
    this.#validSampleCount = 0
    this.#lastTimestampMs = 0
    this.#result = null
  }

  getSnapshot(): PoseCalibrationSnapshot {
    return {
      step: this.#step,
      collectionState: this.#collectionState,
      readyToAdvance: this.#readyToAdvance,
      progress: this.#progress,
      sideProgress: this.#sideProgress(),
      stepStatuses: { ...this.#statuses },
      measurements: {
        move: { ...this.#measurements.move },
        lean: { ...this.#measurements.lean },
        reach: { ...this.#measurements.reach },
        squat: { ...this.#measurements.squat },
      },
      trackingConfidence: this.#trackingConfidence,
      result: this.#result,
    }
  }

  getResult(): PlayerCalibration | null {
    return this.#result
  }

  #ingestNeutral(features: PoseFeatureFrame): void {
    const sample: NeutralSample = {
      timestampMs: features.timestampMs,
      hipX: features.hipMidpoint.x,
      hipY: features.hipMidpoint.y,
      shoulderX: features.shoulderMidpoint.x,
      bodyScale: features.bodyScale,
      torsoLength: features.torsoLength,
      aspectRatio: features.aspectRatio,
      confidence: features.trackingConfidence,
    }
    this.#neutralSamples.push(sample)

    const durationMs =
      features.timestampMs - (this.#neutralSamples[0]?.timestampMs ?? features.timestampMs)
    const averageScale = mean(this.#neutralSamples.map(({ bodyScale }) => bodyScale))
    const centerXs = this.#neutralSamples.map(({ hipX, aspectRatio }) => hipX * aspectRatio)
    const centerYs = this.#neutralSamples.map(({ hipY }) => hipY)
    const xRange = Math.max(...centerXs) - Math.min(...centerXs)
    const yRange = Math.max(...centerYs) - Math.min(...centerYs)
    const stable =
      xRange / averageScale <= this.#config.neutralMaximumCenterRangeBodyUnits &&
      yRange / averageScale <= this.#config.neutralMaximumCenterRangeBodyUnits

    this.#progress = Math.min(
      1,
      Math.min(
        durationMs / this.#config.neutralDurationMs,
        this.#neutralSamples.length / this.#config.neutralMinimumSamples,
      ),
    )
    if (!stable) {
      this.#neutralSamples = [sample]
      this.#progress = 0
      this.#readyToAdvance = false
      return
    }
    if (this.#progress < 1) return

    this.#baseline = {
      hipX: mean(this.#neutralSamples.map(({ hipX }) => hipX)),
      hipY: mean(this.#neutralSamples.map(({ hipY }) => hipY)),
      shoulderX: mean(this.#neutralSamples.map(({ shoulderX }) => shoulderX)),
      bodyScale: averageScale,
      torsoLength: mean(this.#neutralSamples.map(({ torsoLength }) => torsoLength)),
      aspectRatio: mean(this.#neutralSamples.map(({ aspectRatio }) => aspectRatio)),
    }
    this.#readyToAdvance = true
    this.#collectionState = 'READY'
  }

  #ingestMove(features: PoseFeatureFrame): void {
    const baseline = this.#baseline
    if (!baseline) return
    const lean = Math.abs(this.#leanBodyUnits(features))
    if (lean > this.#config.movementMaximumLeanBodyUnits) {
      this.#resetCandidateStreaks()
      return
    }
    const delta = canonicalizeHorizontalDelta(
      (features.hipMidpoint.x - baseline.hipX) * baseline.aspectRatio,
      this.#config.coordinateTransform,
    ) / baseline.bodyScale
    if (delta <= -this.#config.movementMinimumRangeBodyUnits) {
      this.#leftCandidateFrames += 1
      this.#rightCandidateFrames = 0
      if (this.#leftCandidateFrames >= this.#config.directionConfirmationFrames) {
        this.#measurements = {
          ...this.#measurements,
          move: {
            ...this.#measurements.move,
            leftRangeBodyUnits: maxNullable(
              this.#measurements.move.leftRangeBodyUnits,
              Math.abs(delta),
            ),
          },
        }
      }
    } else if (delta >= this.#config.movementMinimumRangeBodyUnits) {
      this.#rightCandidateFrames += 1
      this.#leftCandidateFrames = 0
      if (this.#rightCandidateFrames >= this.#config.directionConfirmationFrames) {
        this.#measurements = {
          ...this.#measurements,
          move: {
            ...this.#measurements.move,
            rightRangeBodyUnits: maxNullable(
              this.#measurements.move.rightRangeBodyUnits,
              delta,
            ),
          },
        }
      }
    } else {
      this.#resetCandidateStreaks()
    }
    this.#updateTwoSidedReadiness()
  }

  #ingestLean(features: PoseFeatureFrame): void {
    const lean = this.#leanBodyUnits(features)
    if (lean <= -this.#config.leanMinimumRangeBodyUnits) {
      this.#leftCandidateFrames += 1
      this.#rightCandidateFrames = 0
      if (this.#leftCandidateFrames >= this.#config.directionConfirmationFrames) {
        this.#measurements = {
          ...this.#measurements,
          lean: {
            ...this.#measurements.lean,
            leftRangeBodyUnits: maxNullable(
              this.#measurements.lean.leftRangeBodyUnits,
              Math.abs(lean),
            ),
          },
        }
      }
    } else if (lean >= this.#config.leanMinimumRangeBodyUnits) {
      this.#rightCandidateFrames += 1
      this.#leftCandidateFrames = 0
      if (this.#rightCandidateFrames >= this.#config.directionConfirmationFrames) {
        this.#measurements = {
          ...this.#measurements,
          lean: {
            ...this.#measurements.lean,
            rightRangeBodyUnits: maxNullable(
              this.#measurements.lean.rightRangeBodyUnits,
              lean,
            ),
          },
        }
      }
    } else {
      this.#resetCandidateStreaks()
    }
    this.#updateTwoSidedReadiness()
  }

  #ingestReach(features: PoseFeatureFrame): void {
    const leftCapability = features.leftArm.extensionRatio
    const rightCapability = features.rightArm.extensionRatio
    const leftIntentional =
      features.leftArm.valid &&
      leftCapability >= this.#config.reachMinimumCapability &&
      features.leftArm.elbowAngleDegrees >= this.#config.reachMinimumElbowAngleDegrees &&
      features.leftWrist.y < features.leftHip.y
    const rightIntentional =
      features.rightArm.valid &&
      rightCapability >= this.#config.reachMinimumCapability &&
      features.rightArm.elbowAngleDegrees >= this.#config.reachMinimumElbowAngleDegrees &&
      features.rightWrist.y < features.rightHip.y

    this.#leftCandidateFrames = leftIntentional ? this.#leftCandidateFrames + 1 : 0
    this.#rightCandidateFrames = rightIntentional ? this.#rightCandidateFrames + 1 : 0
    if (this.#leftCandidateFrames >= this.#config.directionConfirmationFrames) {
      this.#measurements = {
        ...this.#measurements,
        reach: {
          ...this.#measurements.reach,
          leftCapability: maxNullable(this.#measurements.reach.leftCapability, leftCapability),
        },
      }
    }
    if (this.#rightCandidateFrames >= this.#config.directionConfirmationFrames) {
      this.#measurements = {
        ...this.#measurements,
        reach: {
          ...this.#measurements.reach,
          rightCapability: maxNullable(this.#measurements.reach.rightCapability, rightCapability),
        },
      }
    }
    this.#updateTwoSidedReadiness()
  }

  #ingestSquat(features: PoseFeatureFrame): void {
    const baseline = this.#baseline
    if (!baseline) return
    const depth = (features.hipMidpoint.y - baseline.hipY) / baseline.bodyScale
    const kneeAngle = mean([
      features.leftKnee.angleDegrees,
      features.rightKnee.angleDegrees,
    ])
    const intentional =
      depth >= this.#config.squatMinimumDepthBodyUnits &&
      features.leftKnee.valid &&
      features.rightKnee.valid &&
      kneeAngle <= this.#config.squatMaximumKneeAngleDegrees
    this.#squatCandidateFrames = intentional ? this.#squatCandidateFrames + 1 : 0
    if (this.#squatCandidateFrames >= this.#config.directionConfirmationFrames) {
      this.#measurements = {
        ...this.#measurements,
        squat: {
          comfortableDepthBodyUnits: maxNullable(
            this.#measurements.squat.comfortableDepthBodyUnits,
            depth,
          ),
        },
      }
      this.#progress = 1
      this.#readyToAdvance = true
      this.#collectionState = 'READY'
    }
  }

  #leanBodyUnits(features: PoseFeatureFrame): number {
    const baseline = this.#baseline
    if (!baseline) return 0
    return canonicalizeHorizontalDelta(
      (features.shoulderMidpoint.x - features.hipMidpoint.x -
        (baseline.shoulderX - baseline.hipX)) * baseline.aspectRatio,
      this.#config.coordinateTransform,
    ) / baseline.torsoLength
  }

  #updateTwoSidedReadiness(): void {
    const sides = this.#sideProgress()
    const completed = sides?.left === true && sides.right === true
    this.#progress = completed
      ? 1
      : sides?.left === true || sides?.right === true
        ? 0.5
        : 0
    this.#readyToAdvance = completed
    if (completed) this.#collectionState = 'READY'
  }

  #sideProgress(): { readonly left: boolean; readonly right: boolean } | null {
    if (this.#step === 'MOVE') {
      return {
        left: this.#measurements.move.leftRangeBodyUnits !== null,
        right: this.#measurements.move.rightRangeBodyUnits !== null,
      }
    }
    if (this.#step === 'LEAN') {
      return {
        left: this.#measurements.lean.leftRangeBodyUnits !== null,
        right: this.#measurements.lean.rightRangeBodyUnits !== null,
      }
    }
    if (this.#step === 'REACH') {
      return {
        left: this.#measurements.reach.leftCapability !== null,
        right: this.#measurements.reach.rightCapability !== null,
      }
    }
    return null
  }

  #hasRequiredTracking(features: PoseFeatureFrame): boolean {
    if (
      !features.posePresent ||
      features.trackingConfidence < this.#config.minimumTrackingConfidence
    ) return false
    if (this.#step === 'NEUTRAL' || this.#step === 'SQUAT') return features.fullBodyValid
    if (this.#step === 'REACH') {
      return features.coreValid && (features.leftArm.valid || features.rightArm.valid)
    }
    return features.coreValid
  }

  #resetCurrentCollectionState(): void {
    this.#collectionState = this.#isMeasurementStep(this.#step) ? 'COLLECTING' : 'IDLE'
    this.#readyToAdvance = this.#step === 'WELCOME' || this.#step === 'REVIEW'
    this.#progress = 0
    this.#neutralSamples = []
    this.#trackingRecoveryFrames = 0
    this.#resetCandidateStreaks()
  }

  #resetCandidateStreaks(): void {
    this.#leftCandidateFrames = 0
    this.#rightCandidateFrames = 0
    this.#squatCandidateFrames = 0
  }

  #clearMeasurement(step: PlayerCalibrationStep): void {
    if (step === 'MOVE') {
      this.#measurements = { ...this.#measurements, move: emptyMeasurements().move }
    }
    if (step === 'LEAN') {
      this.#measurements = { ...this.#measurements, lean: emptyMeasurements().lean }
    }
    if (step === 'REACH') {
      this.#measurements = { ...this.#measurements, reach: emptyMeasurements().reach }
    }
    if (step === 'SQUAT') {
      this.#measurements = { ...this.#measurements, squat: emptyMeasurements().squat }
    }
  }

  #buildResult(): PlayerCalibration {
    const optionalSteps = ['MOVE', 'LEAN', 'REACH', 'SQUAT'] as const
    const complete = optionalSteps.every((step) => this.#statuses[step] === 'COMPLETE')
    const result: PlayerCalibration = {
      version: 1,
      status: complete ? 'COMPLETE' : 'PARTIAL',
      pose: {
        move: { ...this.#measurements.move },
        lean: { ...this.#measurements.lean },
        reach: { ...this.#measurements.reach },
        squat: { ...this.#measurements.squat },
      },
      steps: {
        NEUTRAL: 'COMPLETE',
        MOVE: this.#statuses.MOVE === 'COMPLETE' ? 'COMPLETE' : 'SKIPPED',
        LEAN: this.#statuses.LEAN === 'COMPLETE' ? 'COMPLETE' : 'SKIPPED',
        REACH: this.#statuses.REACH === 'COMPLETE' ? 'COMPLETE' : 'SKIPPED',
        SQUAT: this.#statuses.SQUAT === 'COMPLETE' ? 'COMPLETE' : 'SKIPPED',
      },
      quality: {
        meanTrackingConfidence: clamp01(
          this.#validSampleCount === 0
            ? 0
            : this.#confidenceSum / this.#validSampleCount,
        ),
        validSampleCount: this.#validSampleCount,
        completedAtTimestampMs: this.#lastTimestampMs,
      },
    }
    return Object.freeze({
      ...result,
      pose: Object.freeze({
        move: Object.freeze(result.pose.move),
        lean: Object.freeze(result.pose.lean),
        reach: Object.freeze(result.pose.reach),
        squat: Object.freeze(result.pose.squat),
      }),
      steps: Object.freeze(result.steps),
      quality: Object.freeze(result.quality),
    })
  }

  #isMeasurementStep(step: PoseCalibrationFlowStep): step is PlayerCalibrationStep {
    return step === 'NEUTRAL' || step === 'MOVE' || step === 'LEAN' || step === 'REACH' || step === 'SQUAT'
  }

  #isOptionalStep(step: PoseCalibrationFlowStep): step is Exclude<PlayerCalibrationStep, 'NEUTRAL'> {
    return step === 'MOVE' || step === 'LEAN' || step === 'REACH' || step === 'SQUAT'
  }
}
