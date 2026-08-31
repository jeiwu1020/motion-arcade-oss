import type { GameRegistration } from '../../game/registry/types'

export const balloonPopRegistration: GameRegistration = {
  id: 'balloon-pop',
  title: '氣球拍拍樂',
  description: '看準左右氣球，用對應方向的伸手動作把氣球拍破！',
  category: 'PARTY',
  tags: ['single-player', 'upper-body', 'reach', '60-seconds'],
  difficulty: {
    cognitiveComplexity: 'LOW',
    reactionDemand: 'LOW',
  },
  supportedTeams: [1],
  simultaneousPlayers: { min: 1, max: 1 },
  controlSchemes: [
    {
      id: 'two-side-reach',
      label: '左右伸手',
      requiredActions: ['REACH_LEFT', 'REACH_RIGHT'],
      inputTypes: ['BODY'],
      bodyAreas: ['UPPER_BODY'],
      posture: ['STANDING'],
      activityLevel: 'LOW',
      supportedAbilityProfiles: ['STANDARD', 'LOW_MOTION', 'SLOW_RESPONSE'],
      supportsSingleSide: false,
      sensorRequirements: { pose: true, hands: false, audio: false },
    },
  ],
  load: () => import('./gameModule'),
}
