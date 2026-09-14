import type { GameRegistration } from '../../game/registry/types'

export const badmintonRegistration: GameRegistration = {
  id: 'badminton',
  title: '羽球快打',
  description: '看準羽球落點快速揮拍，把來球一次次打回去！',
  category: 'SPORTS',
  subcategory: 'RACKET_BALL',
  tags: ['single-player', 'upper-body', 'sports-motion', 'badminton', '60-seconds'],
  difficulty: { cognitiveComplexity: 'LOW', reactionDemand: 'MEDIUM' },
  supportedTeams: [1],
  simultaneousPlayers: { min: 1, max: 1 },
  controlSchemes: [{
    id: 'sports-motion-badminton',
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
