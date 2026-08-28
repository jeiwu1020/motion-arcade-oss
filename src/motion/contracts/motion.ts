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

export interface PlayerCalibration {
  readonly neutralPosition?: NormalizedPoint2D
  readonly reachableRange?: {
    readonly min: NormalizedPoint2D
    readonly max: NormalizedPoint2D
  }
  readonly leftUsableExtent?: number
  readonly rightUsableExtent?: number
  readonly voiceFloorHz?: number
  readonly voiceCeilingHz?: number
  readonly movementBaseline?: number
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
  readonly calibration?: PlayerCalibration
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
