import type { GameRegistration } from '../../game/registry/types'

export const rhythmMotionRegistration: GameRegistration = {
  id: 'rhythm-motion',
  title: '節奏動一動',
  description: '跟著節奏左右移動、伸手出擊，連續命中節拍！',
  category: 'PARTY',
  tags: ['single-player', 'upper-body', 'rhythm', '60-seconds'],
  difficulty: { cognitiveComplexity: 'MEDIUM', reactionDemand: 'MEDIUM' },
  supportedTeams: [1],
  simultaneousPlayers: { min: 1, max: 1 },
  controlSchemes: [{
    id: 'normalized-action-rhythm-motion',
    label: '節奏動作',
    requiredActions: [
      'MOVE_LEFT',
      'MOVE_RIGHT',
      'LEAN_LEFT',
      'LEAN_RIGHT',
      'REACH_LEFT',
      'REACH_RIGHT',
    ],
    inputTypes: ['BODY'],
    bodyAreas: ['UPPER_BODY'],
    posture: ['STANDING'],
    activityLevel: 'MEDIUM',
    supportedAbilityProfiles: ['UPPER_BODY'],
    supportsSingleSide: false,
    sensorRequirements: { pose: true, hands: false, audio: false },
  }],
  load: () => import('./gameModule'),
}
