import type { GameRegistration } from '../../game/registry/types'

export const highJumpRegistration: GameRegistration = {
  id: 'high-jump',
  title: '跳高挑戰',
  description: '抓準起跳時機，輕輕一跳挑戰越來越高的關卡！',
  category: 'SPORTS',
  subcategory: 'TRACK_FIELD',
  tags: ['single-player', 'full-body', 'jump', 'timing', 'five-levels'],
  difficulty: { cognitiveComplexity: 'LOW', reactionDemand: 'MEDIUM' },
  supportedTeams: [1],
  simultaneousPlayers: { min: 1, max: 1 },
  controlSchemes: [{
    id: 'jump-high-jump',
    label: 'JUMP 起跳時機',
    requiredActions: ['JUMP'],
    inputTypes: ['BODY'],
    bodyAreas: ['FULL_BODY', 'LOWER_BODY'],
    posture: ['STANDING'],
    activityLevel: 'HIGH',
    supportedAbilityProfiles: ['STANDARD'],
    supportsSingleSide: false,
    sensorRequirements: { pose: true, hands: false, audio: false },
  }],
  load: () => import('./gameModule'),
}
