import { describe, expect, it } from 'vitest'

import { resolveAbilityProfile } from '../adaptive/profiles'
import type { MotionInputRequest } from '../contracts/motion'
import { PoseMotionAnalyzer } from './PoseMotionAnalyzer'
import { PoseMotionInputProvider } from './PoseMotionInputProvider'
import {
  createSyntheticPoseFrame,
  withPoseTranslation,
} from './syntheticPoseFixtures'

describe('PoseMotionInputProvider injected analyzer boundary', () => {
  it('reuses an injected analyzer only for the exact canonical STANDARD config', async () => {
    const nowRef = { value: 0 }
    const provider = new PoseMotionInputProvider({
      now: () => nowRef.value,
      analyzer: new PoseMotionAnalyzer(),
    })
    const request: MotionInputRequest = {
      players: [
        {
          playerId: 'player-1',
          abilityProfile: resolveAbilityProfile(['LOW_MOTION']),
        },
      ],
      actions: ['MOVE_LEFT'],
      sensors: { pose: true, hands: false, audio: false },
    }

    await provider.start(request)
    expect(provider.getEffectiveConfig().source).toBe('STANDARD')
    expect(provider.getEffectiveConfig().config.move.left.enterBodyUnits).toBe(0.14)

    for (let timestampMs = 0; timestampMs <= 900; timestampMs += 100) {
      nowRef.value = timestampMs
      provider.ingest(createSyntheticPoseFrame('neutral', { timestampMs }))
    }
    expect(provider.getDiagnostics().baselineReady).toBe(true)

    for (const timestampMs of [1_000, 1_050, 1_100]) {
      nowRef.value = timestampMs
      provider.ingest(
        withPoseTranslation(
          createSyntheticPoseFrame('neutral', { timestampMs }),
          0.026,
          0,
        ),
      )
    }

    expect(
      provider.getSnapshot().players[0]?.actions.MOVE_LEFT?.value ?? 0,
    ).toBeGreaterThan(0)
  })
})
