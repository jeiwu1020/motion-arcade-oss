import type {
  AbilityProfileId,
  MotionActionId,
  MotionInputType,
  SensorRequirements,
} from '../../motion/contracts/motion'

export type GameId = string
export type GameCategory = 'SPORTS' | 'PARTY' | 'VOICE' | 'HAND'
export type SportsSubcategory =
  | 'RACKET_BALL'
  | 'BALL'
  | 'TRACK_FIELD'
  | 'AQUATIC'
  | 'OTHER'
export type GameSubcategory = SportsSubcategory
export type DifficultyLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type ActivityLevel = DifficultyLevel
export type BodyArea =
  | 'FULL_BODY'
  | 'UPPER_BODY'
  | 'LOWER_BODY'
  | 'LEFT_HAND'
  | 'RIGHT_HAND'
  | 'VOICE'
export type SupportedPosture = 'STANDING' | 'SEATED'
export type TeamCount = 1 | 2 | 3 | 4

export interface PlayerCountRange {
  readonly min: number
  readonly max: number
}

export interface GameDifficultyProfile {
  readonly cognitiveComplexity: DifficultyLevel
  readonly reactionDemand: DifficultyLevel
}

export interface GameControlScheme {
  readonly id: string
  readonly label: string
  readonly requiredActions: readonly MotionActionId[]
  readonly optionalActions?: readonly MotionActionId[]
  readonly inputTypes: readonly MotionInputType[]
  readonly bodyAreas: readonly BodyArea[]
  readonly posture: readonly SupportedPosture[]
  readonly activityLevel: ActivityLevel
  readonly supportedAbilityProfiles: readonly AbilityProfileId[]
  readonly supportsSingleSide: boolean
  readonly sensorRequirements: SensorRequirements
}

export interface GameModule {
  readonly id: GameId
}

export interface GameRegistration {
  readonly id: GameId
  readonly title: string
  readonly description: string
  readonly category: GameCategory
  readonly subcategory?: GameSubcategory
  readonly tags: readonly string[]
  readonly difficulty: GameDifficultyProfile
  readonly supportedTeams: readonly TeamCount[]
  readonly simultaneousPlayers: PlayerCountRange
  readonly controlSchemes: readonly GameControlScheme[]
  readonly load: () => Promise<GameModule>
}
