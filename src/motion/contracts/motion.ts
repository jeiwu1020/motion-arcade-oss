import type {
  AbilityProfileId,
  ResolvedAbilityProfile,
} from '../adaptive/profiles'

export const MOTION_ACTION_IDS = [
  'MOVE_LEFT',
  'MOVE_RIGHT',
  'MOVE_UP',
  'MOVE_DOWN',
  'LEAN_LEFT',
  'LEAN_RIGHT',
  'REACH',
  'REACH_LEFT',
  'REACH_RIGHT',
  'ARM_SWING',
  'ARM_SWING_LEFT',
  'ARM_SWING_RIGHT',
  'STRIKE',
  'STRIKE_LEFT',
  'STRIKE_RIGHT',
  'THROW',
  'RUN',
  'STEP',
  'RUN_CADENCE',
  'JUMP',
  'SQUAT',
  'HAND_OPEN',
  'HAND_CLOSE',
  'PINCH',
  'POINT',
  'CLAP',
  'HAND_POSITION_LEFT',
  'HAND_POSITION_RIGHT',
  'POINTER_POSITION',
  'POINTER_CLICK',
  'POINTER_DRAG',
  'POINTER_VELOCITY',
  'VOICE_LEVEL',
  'VOICE_PITCH',
  'VOICE_TRIGGER',
  'VOICE_SUSTAINED_DURATION',
] as const

export type MotionActionId = (typeof MOTION_ACTION_IDS)[number]
export type PlayerId = string
export type ProviderId = 'TEST' | 'MEDIAPIPE_FUTURE' | (string & {})
export type AnatomicalSide = 'LEFT' | 'RIGHT'
export type WorldHorizontalDirection = 'LEFT' | 'RIGHT' | 'NONE'
export type MotionActionPhase = 'idle' | 'started' | 'active' | 'ended'
export type MotionInputType = 'BODY' | 'HAND' | 'VOICE' | 'POINTER'

export interface NormalizedPoint2D {
  readonly x: number
  readonly y: number
}

export interface NormalizedVector2D extends NormalizedPoint2D {
  readonly magnitude: number
}

export type MotionActionValue = number | NormalizedPoint2D | NormalizedVector2D

export interface MotionActionState {
  readonly id: MotionActionId
  readonly value: MotionActionValue
  readonly phase: MotionActionPhase
  readonly confidence: number
  readonly timestampMs: number
  readonly sequence: number
}

export type PlayerCalibrationStatus = 'COMPLETE' | 'PARTIAL'
export type PlayerCalibrationStep = 'NEUTRAL' | 'MOVE' | 'LEAN' | 'REACH' | 'SQUAT'
export type PlayerCalibrationStepStatus = 'COMPLETE' | 'SKIPPED'

export type PlayerCalibration =
  | {
      readonly version: 1
      readonly status: PlayerCalibrationStatus
      readonly pose: {
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
      readonly steps: Readonly<Record<PlayerCalibrationStep, PlayerCalibrationStepStatus>>
      readonly quality: {
        readonly meanTrackingConfidence: number
        readonly validSampleCount: number
        readonly completedAtTimestampMs: number
      }
    }
  | {
      /** @deprecated Reserved Phase 1A compatibility shape. New calibration must use version 1. */
      readonly neutralPosition?: NormalizedPoint2D
      /** @deprecated Reserved Phase 1A compatibility shape. New calibration must use version 1. */
      readonly reachableRange?: {
        readonly min: NormalizedPoint2D
        readonly max: NormalizedPoint2D
      }
      /** @deprecated Reserved Phase 1A compatibility shape. New calibration must use version 1. */
      readonly leftUsableExtent?: number
      /** @deprecated Reserved Phase 1A compatibility shape. New calibration must use version 1. */
      readonly rightUsableExtent?: number
      /** @deprecated Reserved Phase 1A compatibility shape. New calibration must use version 1. */
      readonly voiceFloorHz?: number
      /** @deprecated Reserved Phase 1A compatibility shape. New calibration must use version 1. */
      readonly voiceCeilingHz?: number
      /** @deprecated Reserved Phase 1A compatibility shape. New calibration must use version 1. */
      readonly movementBaseline?: number
      readonly version?: never
      readonly status?: never
      readonly pose?: never
      readonly steps?: never
      readonly quality?: never
    }

export interface MotionPlayerRequest {
  readonly playerId: PlayerId
  readonly abilityProfile: ResolvedAbilityProfile
  readonly calibration?: PlayerCalibration
}

export interface SensorRequirements {
  readonly pose: boolean
  readonly hands: boolean
  readonly audio: boolean
}

export interface MotionInputRequest {
  readonly players: readonly MotionPlayerRequest[]
  readonly actions: readonly MotionActionId[]
  readonly sensors: SensorRequirements
}

export interface PlayerMotionState {
  readonly playerId: PlayerId
  readonly abilityProfile: ResolvedAbilityProfile
  readonly actions: Readonly<Partial<Record<MotionActionId, MotionActionState>>>
}

export interface MotionInputSnapshot {
  readonly providerId: ProviderId
  readonly sequence: number
  readonly timestampMs: number
  readonly players: readonly PlayerMotionState[]
}

export interface MotionDiagnosticTelemetry {
  readonly playerId: PlayerId
  readonly rawPitchHz?: number
  readonly pitchStable?: boolean
  readonly voiced?: boolean
}

export interface MotionInputProvider {
  readonly id: ProviderId
  start(request: MotionInputRequest): Promise<void>
  stop(): Promise<void>
  update(deltaMs: number): void
  getSnapshot(): MotionInputSnapshot
  subscribe(listener: () => void): () => void
  isRunning(): boolean
}

export type { AbilityProfileId, ResolvedAbilityProfile }
