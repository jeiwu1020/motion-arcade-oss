import { describe, expect, it } from 'vitest'

import { isRealSensorLabEnabled } from './realSensorLabGate'

describe('real sensor lab production gate', () => {
  it('is enabled automatically in development', () => {
    expect(isRealSensorLabEnabled({ isDevelopment: true })).toBe(true)
  })

  it('is disabled by default in production and URL state cannot bypass it', () => {
    expect(
      isRealSensorLabEnabled({
        isDevelopment: false,
        buildTimeOptIn: undefined,
        locationHash: '#pose-sensor-lab',
        queryString: '?realSensorLab=true',
      }),
    ).toBe(false)
  })

  it('accepts only the explicit true build-time value in production', () => {
    expect(
      isRealSensorLabEnabled({
        isDevelopment: false,
        buildTimeOptIn: 'true',
      }),
    ).toBe(true)
    expect(
      isRealSensorLabEnabled({
        isDevelopment: false,
        buildTimeOptIn: '1',
      }),
    ).toBe(false)
  })
})
