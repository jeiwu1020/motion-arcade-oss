import type { GameRegistration } from '../../game/registry/types'

export const tennisRegistration: GameRegistration = {
  id: 'tennis',
  title: '網球對決',
  description: '看準來球揮動手臂，把球一拍一拍打回去！',
  category: 'SPORTS',
  subcategory: 'RACKET_BALL',
  tags: ['single-player', 'upper-body', 'sports-motion', 'tennis', '60-seconds'],
  difficulty: { cognitiveComplexity: 'LOW', reactionDemand: 'MEDIUM' },
  supportedTeams: [1],
  simultaneousPlayers: { min: 1, max: 1 },
  controlSchemes: [{
    id: 'sports-motion-tennis',
    label: 'Sports Motion 揮拍',
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
