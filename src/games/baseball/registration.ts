import type { GameRegistration } from '../../game/registry/types'

export const baseballRegistration: GameRegistration = {
  id: 'baseball',
  title: '全壘打王',
  description: '看準來球揮動手臂，挑戰安打與全壘打！',
  category: 'SPORTS',
  subcategory: 'BALL',
  tags: ['single-player', 'upper-body', 'sports-motion', 'baseball', '60-seconds'],
  difficulty: { cognitiveComplexity: 'LOW', reactionDemand: 'MEDIUM' },
  supportedTeams: [1],
  simultaneousPlayers: { min: 1, max: 1 },
  controlSchemes: [{
    id: 'sports-motion-baseball',
    label: 'Sports Motion 揮棒',
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
