import { describe, expect, it } from 'vitest'

import { LocomotionTestProvider } from './LocomotionTestProvider'

describe('LocomotionTestProvider', () => {
  it('emits deterministic camera-free alternating steps and derives cadence', () => {
    const provider = new LocomotionTestProvider()
    provider.triggerStep('LEFT', { timestampMs: 200, liftIntensity: 0.6 })
    provider.triggerStep('RIGHT', { timestampMs: 700, liftIntensity: 1 })

    expect(provider.getSnapshot()).toMatchObject({
      availability: 'AVAILABLE',
      cadenceSpm: 120,
      intensity: expect.any(Number),
      latestStep: { side: 'RIGHT', sequence: 2, liftIntensity: expect.closeTo(1, 1) },
    })
  })

  it('does not fabricate duplicate same-side cadence and reset clears retained events', () => {
    const provider = new LocomotionTestProvider()
    provider.triggerStep('LEFT', { timestampMs: 200, liftIntensity: 0.5 })
    provider.triggerStep('LEFT', { timestampMs: 700, liftIntensity: 0.5 })
    expect(provider.getSnapshot()).toMatchObject({ latestStep: { side: 'LEFT', sequence: 1 }, cadenceSpm: 0 })

    provider.reset(800)
    expect(provider.getSnapshot()).toMatchObject({ availability: 'UNAVAILABLE', latestStep: null, cadenceSpm: 0 })
  })

  it('decays to idle without a camera', () => {
    const provider = new LocomotionTestProvider()
    provider.triggerStep('LEFT', { timestampMs: 200, liftIntensity: 1 })
    provider.triggerStep('RIGHT', { timestampMs: 700, liftIntensity: 1 })
    for (let time = 800; time <= 1_900; time += 100) provider.setIdle(time)
    expect(provider.getSnapshot()).toMatchObject({ cadenceSpm: 0, intensity: 0 })
  })
})
