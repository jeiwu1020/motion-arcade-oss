export type AppScreen =
  | 'HOME'
  | 'TEST_LAB'
  | 'POSE_SENSOR_LAB'
  | 'BALLOON_POP'
  | 'REACTION_ARENA'
  | 'RUNNER'
  | 'RHYTHM_MOTION'
  | 'TENNIS'
  | 'BADMINTON'

export interface AppRouteGates {
  readonly testInputEnabled: boolean
  readonly realSensorLabEnabled: boolean
}

export function screenFromHash(
  hash: string,
  gates: AppRouteGates,
): AppScreen {
  if (hash === '#game/balloon-pop') return 'BALLOON_POP'
  if (hash === '#game/reaction-arena') return 'REACTION_ARENA'
  if (hash === '#game/runner') return 'RUNNER'
  if (hash === '#game/rhythm-motion') return 'RHYTHM_MOTION'
  if (hash === '#game/tennis') return 'TENNIS'
  if (hash === '#game/badminton') return 'BADMINTON'
  if (gates.testInputEnabled && hash === '#test-lab') return 'TEST_LAB'
  if (
    gates.realSensorLabEnabled &&
    hash === '#pose-sensor-lab'
  ) {
    return 'POSE_SENSOR_LAB'
  }
  return 'HOME'
}

export function hashForScreen(screen: AppScreen): string {
  if (screen === 'TEST_LAB') return 'test-lab'
  if (screen === 'POSE_SENSOR_LAB') return 'pose-sensor-lab'
  if (screen === 'BALLOON_POP') return 'game/balloon-pop'
  if (screen === 'REACTION_ARENA') return 'game/reaction-arena'
  if (screen === 'RUNNER') return 'game/runner'
  if (screen === 'RHYTHM_MOTION') return 'game/rhythm-motion'
  if (screen === 'TENNIS') return 'game/tennis'
  if (screen === 'BADMINTON') return 'game/badminton'
  return ''
}
