import type { GameRegistration } from '../../game/registry/types'

export const balloonPopRegistration: GameRegistration = {
  id: 'balloon-pop',
  title: '氣球拍拍樂',
  description: '在鏡頭畫面中用雙手拍動漂浮氣球，累積命中與拍破分數！',
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
      id: 'spatial-hand-rally',
      label: '雙手拍氣球',
      requiredActions: [],
      requiresSpatialHands: true,
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
