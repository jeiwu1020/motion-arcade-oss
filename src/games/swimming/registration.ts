import type { GameRegistration } from '../../game/registry/types'

export const swimmingRegistration: GameRegistration = {
  id: 'swimming',
  title: '泳池衝刺',
  description: '左右手交替划動，加快節奏一路游向終點！',
  category: 'SPORTS',
  subcategory: 'AQUATIC',
  tags: ['single-player', 'upper-body', 'sports-motion', 'swimming', '60-seconds'],
  difficulty: { cognitiveComplexity: 'LOW', reactionDemand: 'LOW' },
  supportedTeams: [1],
  simultaneousPlayers: { min: 1, max: 1 },
  controlSchemes: [{
    id: 'sports-motion-swimming',
    label: 'Sports Motion 交替划水',
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
