import { describe, expect, it } from 'vitest'

import { SportsMotionTestProvider } from './SportsMotionTestProvider'

describe('SportsMotionTestProvider', () => {
  it('emits a controlled left swing without a camera and preserves vector/intensity', () => {
    const provider = new SportsMotionTestProvider()
    provider.triggerSwing('LEFT', {
      timestampMs: 100,
      vectorX: 0.6,
      vectorY: -0.8,
      intensity: 0.7,
    })

    expect(provider.getSnapshot()).toMatchObject({
      leftSwing: {
        hand: 'LEFT', sequence: 1, timestampMs: 100,
        vectorX: 0.6, vectorY: -0.8, intensity: 0.7,
      },
      rightSwing: null,
    })
  })

  it('keeps right sequence independent and clears stale events on reset', () => {
    const provider = new SportsMotionTestProvider()
    provider.triggerSwing('LEFT', { timestampMs: 100, vectorX: 1, vectorY: 0, intensity: 0.5 })
    provider.triggerSwing('RIGHT', { timestampMs: 200, vectorX: -1, vectorY: 0, intensity: 1 })
    provider.reset(300)

    expect(provider.getSnapshot()).toMatchObject({
      leftSwing: null,
      rightSwing: null,
      leftHand: { availability: 'UNAVAILABLE' },
      rightHand: { availability: 'UNAVAILABLE' },
    })
  })
})
