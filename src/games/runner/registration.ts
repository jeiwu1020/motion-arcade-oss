import type { GameRegistration } from '../../game/registry/types'

export const runnerRegistration: GameRegistration = {
  id: 'runner',
  title: '跑酷衝刺',
  description: '左右換道、跳躍、蹲下，閃過障礙一路衝刺！',
  category: 'SPORTS',
  subcategory: 'TRACK_FIELD',
  tags: ['single-player', 'full-body', 'runner', '60-seconds'],
  difficulty: { cognitiveComplexity: 'LOW', reactionDemand: 'MEDIUM' },
  supportedTeams: [1],
  simultaneousPlayers: { min: 1, max: 1 },
  controlSchemes: [{
    id: 'normalized-action-runner',
    label: '全身跑酷',
    requiredActions: ['MOVE_LEFT', 'MOVE_RIGHT', 'JUMP', 'SQUAT'],
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
