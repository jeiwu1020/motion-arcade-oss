import { describe, expect, it } from 'vitest'

import { screenFromHash } from './navigation'

describe('application hash routing', () => {
  it('opens Balloon Pop in production without either developer gate', () => {
    expect(
      screenFromHash('#game/balloon-pop', {
        testInputEnabled: false,
        realSensorLabEnabled: false,
      }),
    ).toBe('BALLOON_POP')
  })

  it('opens Reaction Arena in production without developer gates', () => {
    expect(screenFromHash('#game/reaction-arena', { testInputEnabled: false, realSensorLabEnabled: false })).toBe('REACTION_ARENA')
  })

  it('keeps developer and real-sensor labs behind their existing gates', () => {
    const productionGates = {
      testInputEnabled: false,
      realSensorLabEnabled: false,
    }

    expect(screenFromHash('#test-lab', productionGates)).toBe('HOME')
    expect(screenFromHash('#pose-sensor-lab', productionGates)).toBe('HOME')
    expect(
      screenFromHash('#test-lab', {
        ...productionGates,
        testInputEnabled: true,
      }),
    ).toBe('TEST_LAB')
  })
})
