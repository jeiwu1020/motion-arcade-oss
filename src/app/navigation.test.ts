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
