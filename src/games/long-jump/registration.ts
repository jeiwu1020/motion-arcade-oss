import type { GameRegistration } from '../../game/registry/types'

export const longJumpRegistration: GameRegistration = {
  id: 'long-jump',
  title: '飛躍挑戰',
  description: '原地抬膝蓄力，抓準時機輕輕一跳，讓角色飛得更遠！',
  category: 'SPORTS',
  subcategory: 'TRACK_FIELD',
  tags: ['single-player', 'full-body', 'lower-body', 'jump', 'locomotion', 'arcade-distance'],
  difficulty: { cognitiveComplexity: 'LOW', reactionDemand: 'MEDIUM' },
  supportedTeams: [1],
  simultaneousPlayers: { min: 1, max: 1 },
  controlSchemes: [{
    id: 'locomotion-jump-long-jump',
    label: '原地蓄力 + JUMP 起跳',
    requiredActions: ['JUMP'],
    requiresLocomotion: true,
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
