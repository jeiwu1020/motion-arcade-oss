import type { GameRegistration } from '../../game/registry/types'

export const reactionArenaRegistration: GameRegistration = {
  id: 'reaction-arena',
  title: '光速反應王',
  description: '看提示，用最快反應完成動作，挑戰你的連續反應！',
  category: 'PARTY',
  tags: ['single-player', 'full-body', 'reaction', '60-seconds'],
  difficulty: { cognitiveComplexity: 'MEDIUM', reactionDemand: 'MEDIUM' },
  supportedTeams: [1],
  simultaneousPlayers: { min: 1, max: 1 },
  controlSchemes: [{
    id: 'normalized-action-reaction',
    label: '動作反應',
    requiredActions: ['MOVE_LEFT', 'MOVE_RIGHT', 'REACH_LEFT', 'REACH_RIGHT', 'SQUAT'],
    inputTypes: ['BODY'],
    bodyAreas: ['FULL_BODY'],
    posture: ['STANDING'],
    activityLevel: 'MEDIUM',
    supportedAbilityProfiles: ['STANDARD', 'LOW_MOTION', 'SLOW_RESPONSE'],
    supportsSingleSide: false,
    sensorRequirements: { pose: true, hands: false, audio: false },
  }],
  load: () => import('./gameModule'),
}
