import { describe, expect, it } from 'vitest'

import { resolveAbilityProfile } from '../adaptive/profiles'
import type { MotionInputRequest } from '../contracts/motion'
import { KeyboardMouseTestInputProvider } from './KeyboardMouseTestInputProvider'
import { MotionProviderCoordinator } from './MotionProviderCoordinator'

const request: MotionInputRequest = {
  players: [
    {
      playerId: 'player-1',
      abilityProfile: resolveAbilityProfile(['STANDARD']),
    },
  ],
  actions: ['MOVE_LEFT'],
  sensors: { pose: false, hands: false, audio: false },
}

describe('MotionProviderCoordinator', () => {
  it('stops the previous provider before switching', async () => {
    const firstTarget = new EventTarget()
    const secondTarget = new EventTarget()
    const first = new KeyboardMouseTestInputProvider({
      keyboardTarget: firstTarget,
    })
    const second = new KeyboardMouseTestInputProvider({
      keyboardTarget: secondTarget,
    })
    const coordinator = new MotionProviderCoordinator()

    await coordinator.switchTo(first, request)
    await coordinator.switchTo(second, request)

    expect(first.isRunning()).toBe(false)
    expect(second.isRunning()).toBe(true)
    await coordinator.stop()
    expect(second.isRunning()).toBe(false)
  })
})
