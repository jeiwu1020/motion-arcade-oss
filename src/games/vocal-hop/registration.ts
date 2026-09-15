import type { GameRegistration } from '../../game/registry/types'

export const vocalHopRegistration: GameRegistration = {
  id: 'vocal-hop',
  title: '聲控跳跳樂',
  description: '用舒服的聲音讓角色跳起來，避開障礙一路往前！',
  category: 'VOICE',
  tags: ['single-player', 'voice', 'hop', 'no-camera', '60-seconds'],
  difficulty: { cognitiveComplexity: 'LOW', reactionDemand: 'LOW' },
  supportedTeams: [1],
  simultaneousPlayers: { min: 1, max: 1 },
  controlSchemes: [{
    id: 'voice-vocal-hop',
    label: 'VOICE 聲音跳躍',
    requiredActions: ['VOICE_LEVEL', 'VOICE_TRIGGER', 'VOICE_SUSTAINED_DURATION'],
    inputTypes: ['VOICE'],
    bodyAreas: ['VOICE'],
    posture: ['STANDING'],
    activityLevel: 'LOW',
    supportedAbilityProfiles: ['STANDARD'],
    supportsSingleSide: false,
    sensorRequirements: { pose: false, hands: false, audio: true },
  }],
  load: () => import('./gameModule'),
}
