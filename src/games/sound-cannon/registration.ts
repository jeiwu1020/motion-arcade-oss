import type { GameRegistration } from '../../game/registry/types'

export const soundCannonRegistration: GameRegistration = {
  id: 'sound-cannon', title: '音波砲', description: '用短短的聲音幫音波砲蓄力，抓準時機轟飛目標！', category: 'VOICE',
  tags: ['single-player', 'voice', 'sound-cannon', 'no-camera', '60-seconds'], difficulty: { cognitiveComplexity: 'LOW', reactionDemand: 'MEDIUM' }, supportedTeams: [1], simultaneousPlayers: { min: 1, max: 1 },
  controlSchemes: [{ id: 'voice-sound-cannon', label: 'VOICE 音波砲', requiredActions: ['VOICE_LEVEL', 'VOICE_TRIGGER', 'VOICE_SUSTAINED_DURATION'], inputTypes: ['VOICE'], bodyAreas: ['VOICE'], posture: ['STANDING', 'SEATED'], activityLevel: 'LOW', supportedAbilityProfiles: ['STANDARD', 'SEATED'], supportsSingleSide: false, sensorRequirements: { pose: false, hands: false, audio: true } }],
  load: () => import('./gameModule'),
}
