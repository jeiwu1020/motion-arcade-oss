import { describe, expect, it } from 'vitest'

import { resolveAbilityProfile } from '../adaptive/profiles'
import type { MotionInputRequest, PlayerCalibration } from '../contracts/motion'
import { PoseMotionInputProvider } from '../pose/PoseMotionInputProvider'
import { KeyboardMouseTestInputProvider } from './KeyboardMouseTestInputProvider'

function calibration(): Extract<PlayerCalibration, { readonly version: 1 }> {
  return {
    version: 1,
    status: 'COMPLETE',
    pose: {
      move: { leftRangeBodyUnits: 0.3, rightRangeBodyUnits: 0.55 },
      lean: { leftRangeBodyUnits: 0.25, rightRangeBodyUnits: 0.5 },
      reach: { leftCapability: 0.9, rightCapability: 0.98 },
      squat: { comfortableDepthBodyUnits: 0.22 },
    },
    steps: {
      NEUTRAL: 'COMPLETE',
      MOVE: 'COMPLETE',
      LEAN: 'COMPLETE',
      REACH: 'COMPLETE',
      SQUAT: 'COMPLETE',
    },
    quality: {
      meanTrackingConfidence: 0.95,
      validSampleCount: 40,
      completedAtTimestampMs: 5_000,
    },
  }
}

function request(sensors: MotionInputRequest['sensors']): MotionInputRequest {
  return {
    players: [
      {
        playerId: 'player-1',
        abilityProfile: resolveAbilityProfile(['STANDARD']),
        calibration: calibration(),
      },
    ],
    actions: ['MOVE_LEFT', 'SQUAT', 'JUMP'],
    sensors,
  }
}

describe('calibration snapshot boundary', () => {
  it('keeps calibration as Pose provider input without publishing it in the snapshot', async () => {
    const input = request({ pose: true, hands: false, audio: false })
    const provider = new PoseMotionInputProvider({ now: () => 0 })

    expect(input.players[0]?.calibration).toBeDefined()
    await provider.start(input)

    expect(provider.getEffectiveConfig().source).toBe('CALIBRATION_V1')
    const player = provider.getSnapshot().players[0]
    expect(player).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(player, 'calibration')).toBe(false)
    expect(provider.getEffectiveConfig().config.jump).toMatchObject({
      takeoffRiseBodyUnits: 0.1,
      takeoffVelocityBodyUnitsPerSecond: 1.2,
      minimumFootRiseBodyUnits: 0.08,
      airborneRiseBodyUnits: 0.32,
      landingRiseBodyUnits: 0.08,
      candidateWindowMs: 180,
      refractoryMs: 500,
    })
  })

  it('keeps calibration out of TEST provider snapshots as well', async () => {
    const input = request({ pose: false, hands: false, audio: false })
    const provider = new KeyboardMouseTestInputProvider({
      keyboardTarget: new EventTarget(),
      now: () => 0,
    })

    expect(input.players[0]?.calibration).toBeDefined()
    await provider.start(input)

    const player = provider.getSnapshot().players[0]
    expect(player).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(player, 'calibration')).toBe(false)
  })
})
