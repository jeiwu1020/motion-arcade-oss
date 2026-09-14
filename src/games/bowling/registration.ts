import type { GameRegistration } from '../../game/registry/types'

export const bowlingRegistration: GameRegistration = {
  id: 'bowling',
  title: '保齡球大賽',
  description: '看準方向揮臂投球，挑戰 STRIKE 和 SPARE！',
  category: 'SPORTS',
  subcategory: 'BALL',
  tags: ['single-player', 'upper-body', 'sports-motion', 'bowling', 'five-frames'],
  difficulty: { cognitiveComplexity: 'LOW', reactionDemand: 'LOW' },
  supportedTeams: [1],
  simultaneousPlayers: { min: 1, max: 1 },
  controlSchemes: [{
    id: 'sports-motion-bowling',
    label: 'Sports Motion 投球',
    requiredActions: [],
    requiresSportsMotion: true,
    inputTypes: ['BODY'],
    bodyAreas: ['UPPER_BODY', 'LEFT_HAND', 'RIGHT_HAND'],
    posture: ['STANDING'],
    activityLevel: 'MEDIUM',
    supportedAbilityProfiles: ['UPPER_BODY'],
    supportsSingleSide: false,
    sensorRequirements: { pose: true, hands: false, audio: false },
  }],
  load: () => import('./gameModule'),
}
