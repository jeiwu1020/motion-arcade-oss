import type { MotionActionId, MotionActionState } from '../contracts/motion'

export interface PoseFeaturePoint {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly confidence: number
  readonly valid: boolean
}

export interface PoseJointFeature {
  readonly angleDegrees: number
  readonly valid: boolean
  readonly confidence: number
}

export interface PoseArmFeature {
  readonly extensionRatio: number
  readonly elbowAngleDegrees: number
  readonly valid: boolean
  readonly confidence: number
}

export interface PoseFeatureFrame {
  readonly timestampMs: number
  readonly posePresent: boolean
  readonly aspectRatio: number
  readonly trackingConfidence: number
  readonly coreValid: boolean
  readonly fullBodyValid: boolean
  readonly shoulderMidpoint: PoseFeaturePoint
  readonly hipMidpoint: PoseFeaturePoint
  readonly torsoCenter: PoseFeaturePoint
  readonly bodyCenter: PoseFeaturePoint
  readonly torsoLength: number
  readonly shoulderWidth: number
  readonly bodyScale: number
  readonly leftShoulder: PoseFeaturePoint
  readonly rightShoulder: PoseFeaturePoint
  readonly leftElbow: PoseFeaturePoint
  readonly rightElbow: PoseFeaturePoint
  readonly leftWrist: PoseFeaturePoint
  readonly rightWrist: PoseFeaturePoint
  readonly leftHip: PoseFeaturePoint
  readonly rightHip: PoseFeaturePoint
  readonly leftKnee: PoseJointFeature
  readonly rightKnee: PoseJointFeature
  readonly leftAnkle: PoseFeaturePoint
  readonly rightAnkle: PoseFeaturePoint
  readonly leftArm: PoseArmFeature
  readonly rightArm: PoseArmFeature
}

export type PoseTrackingQuality =
  | 'LOST'
  | 'LIMITED'
  | 'BASELINING'
  | 'READY'

export type PoseSquatState = 'STANDING' | 'DESCENDING' | 'SQUAT' | 'RISING'

export type PoseJumpState =
  | 'GROUNDED'
  | 'TAKEOFF_CANDIDATE'
  | 'AIRBORNE'
  | 'LANDING'
  | 'REFRACTORY'

export interface PoseSquatDiagnostics {
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

export interface PoseMotionAnalyzerSnapshot {
  readonly timestampMs: number
  readonly sequence: number
  readonly quality: PoseTrackingQuality
  readonly baselineReady: boolean
  readonly baselineProgress: number
  readonly freshnessMs: number | null
  readonly squatState: PoseSquatState
  readonly squatDiagnostics: PoseSquatDiagnostics
  readonly jumpState: PoseJumpState
  readonly analyzerDurationMs: number
  readonly actions: Readonly<
    Partial<Record<MotionActionId, MotionActionState>>
  >
}
