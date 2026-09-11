import type {
  GameControlScheme,
  GameRegistration,
  TeamCount,
} from './types'
import type {
  MotionActionId,
  MotionInputType,
} from '../../motion/contracts/motion'

export type RegistryValidationCode =
  | 'DUPLICATE_GAME_ID'
  | 'EMPTY_CONTROL_SCHEMES'
  | 'INVALID_TEAM_COUNT'
  | 'IMPOSSIBLE_PLAYER_RANGE'
  | 'UNSUPPORTED_SUBCATEGORY'
  | 'EMPTY_REQUIRED_ACTIONS'
  | 'MISSING_REQUIRED_INPUT_TYPE'
  | 'SEATED_PROFILE_MISMATCH'
  | 'SINGLE_SIDE_PROFILE_MISMATCH'

export interface RegistryValidationError {
  readonly code: RegistryValidationCode
  readonly path: string
  readonly message: string
}

export interface RegistryValidationResult {
  readonly valid: boolean
  readonly errors: readonly RegistryValidationError[]
}

const VALID_TEAM_COUNTS = new Set<number>([1, 2, 3, 4] satisfies TeamCount[])

function requiredInputType(actionId: MotionActionId): MotionInputType {
  if (actionId.startsWith('VOICE_')) return 'VOICE'
  if (
    actionId.startsWith('HAND_') ||
    actionId === 'PINCH' ||
    actionId === 'POINT' ||
    actionId === 'CLAP'
  ) {
    return 'HAND'
  }
  if (actionId.startsWith('POINTER_')) return 'POINTER'
  return 'BODY'
}

function validateScheme(
  scheme: GameControlScheme,
  path: string,
  errors: RegistryValidationError[],
): void {
  if (scheme.requiredActions.length === 0 && !scheme.requiresSpatialHands) {
    errors.push({
      code: 'EMPTY_REQUIRED_ACTIONS',
      path: `${path}.requiredActions`,
      message: 'A control scheme must declare a Motion Action or normalized spatial hands.',
    })
  }

  for (const actionId of scheme.requiredActions) {
    const inputType = requiredInputType(actionId)
    if (!scheme.inputTypes.includes(inputType)) {
      errors.push({
        code: 'MISSING_REQUIRED_INPUT_TYPE',
        path: `${path}.inputTypes`,
        message: `${actionId} requires the ${inputType} input type.`,
      })
    }
  }

  if (
    scheme.posture.includes('SEATED') &&
    !scheme.supportedAbilityProfiles.includes('SEATED')
  ) {
    errors.push({
      code: 'SEATED_PROFILE_MISMATCH',
      path: `${path}.supportedAbilityProfiles`,
      message: 'A seated scheme must explicitly support the SEATED profile.',
    })
  }

  if (
    scheme.supportsSingleSide &&
    (!scheme.supportedAbilityProfiles.includes('LEFT_SIDE') ||
      !scheme.supportedAbilityProfiles.includes('RIGHT_SIDE'))
  ) {
    errors.push({
      code: 'SINGLE_SIDE_PROFILE_MISMATCH',
      path: `${path}.supportedAbilityProfiles`,
      message:
        'A single-side scheme must declare both LEFT_SIDE and RIGHT_SIDE compatibility.',
    })
  }
}

export function validateGameRegistry(
  games: readonly GameRegistration[],
): RegistryValidationResult {
  const errors: RegistryValidationError[] = []
  const seenIds = new Set<string>()

  games.forEach((game, gameIndex) => {
    const path = `games[${gameIndex}]`
    if (seenIds.has(game.id)) {
      errors.push({
        code: 'DUPLICATE_GAME_ID',
        path: `${path}.id`,
        message: `Duplicate game id: ${game.id}`,
      })
    }
    seenIds.add(game.id)

    if (game.controlSchemes.length === 0) {
      errors.push({
        code: 'EMPTY_CONTROL_SCHEMES',
        path: `${path}.controlSchemes`,
        message: 'A game must declare at least one control scheme.',
      })
    }

    for (const teamCount of game.supportedTeams as readonly number[]) {
      if (!VALID_TEAM_COUNTS.has(teamCount)) {
        errors.push({
          code: 'INVALID_TEAM_COUNT',
          path: `${path}.supportedTeams`,
          message: `Team count ${teamCount} is outside the supported 1–4 range.`,
        })
      }
    }

    const { min, max } = game.simultaneousPlayers
    if (min < 1 || max > 4 || min > max || !Number.isInteger(min) || !Number.isInteger(max)) {
      errors.push({
        code: 'IMPOSSIBLE_PLAYER_RANGE',
        path: `${path}.simultaneousPlayers`,
        message: `Player range ${min}–${max} must be ordered whole numbers within 1–4.`,
      })
    }

    if (game.category !== 'SPORTS' && game.subcategory !== undefined) {
      errors.push({
        code: 'UNSUPPORTED_SUBCATEGORY',
        path: `${path}.subcategory`,
        message: 'Sports subcategories may only be used with the SPORTS category.',
      })
    }

    game.controlSchemes.forEach((scheme, schemeIndex) => {
      validateScheme(scheme, `${path}.controlSchemes[${schemeIndex}]`, errors)
    })
  })

  return { valid: errors.length === 0, errors }
}

export function assertValidGameRegistry(
  games: readonly GameRegistration[],
): void {
  const result = validateGameRegistry(games)
  if (!result.valid) {
    throw new Error(result.errors.map((error) => `${error.path}: ${error.message}`).join('\n'))
  }
}
