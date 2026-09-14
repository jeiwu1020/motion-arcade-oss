import type { GameRegistration } from '../../game/registry/types'

export const runningRaceRegistration: GameRegistration = {
  id: 'running-race',
  title: '原地衝刺王',
  description: '原地快速抬膝，追上對手一路超車到終點！',
  category: 'SPORTS',
  subcategory: 'TRACK_FIELD',
  tags: ['single-player', 'full-body', 'knees', 'locomotion', '60-seconds'],
  difficulty: { cognitiveComplexity: 'LOW', reactionDemand: 'LOW' },
  supportedTeams: [1],
  simultaneousPlayers: { min: 1, max: 1 },
  controlSchemes: [{
    id: 'locomotion-running-race',
    label: 'Locomotion 原地衝刺',
    requiredActions: [],
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
