import { describe, expect, it } from 'vitest'

import { isTestInputEnabled } from './testModeGate'

describe('test input production gate', () => {
  it('is enabled automatically in development', () => {
    expect(isTestInputEnabled({ isDevelopment: true })).toBe(true)
  })

  it('is disabled in production without an explicit build-time opt-in', () => {
    expect(
      isTestInputEnabled({
        isDevelopment: false,
        buildTimeOptIn: undefined,
        queryString: '?testInput=true',
      }),
    ).toBe(false)
  })

  it('accepts only the explicit true build value in production', () => {
    expect(
      isTestInputEnabled({
        isDevelopment: false,
        buildTimeOptIn: 'true',
      }),
    ).toBe(true)
    expect(
      isTestInputEnabled({
        isDevelopment: false,
        buildTimeOptIn: '1',
      }),
    ).toBe(false)
  })
})
