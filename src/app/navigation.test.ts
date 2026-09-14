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

  it('opens Runner in production without developer gates', () => {
    expect(screenFromHash('#game/runner', {
      testInputEnabled: false,
      realSensorLabEnabled: false,
    })).toBe('RUNNER')
  })

  it('opens Rhythm Motion in production without developer gates', () => {
    expect(screenFromHash('#game/rhythm-motion', {
      testInputEnabled: false,
      realSensorLabEnabled: false,
    })).toBe('RHYTHM_MOTION')
  })

  it('opens Tennis in production without developer gates', () => {
    expect(screenFromHash('#game/tennis', {
      testInputEnabled: false,
      realSensorLabEnabled: false,
    })).toBe('TENNIS')
  })

  it('opens Badminton in production without developer gates', () => {
    expect(screenFromHash('#game/badminton', {
      testInputEnabled: false,
      realSensorLabEnabled: false,
    })).toBe('BADMINTON')
  })

  it('opens Bowling in production without developer gates', () => {
    expect(screenFromHash('#game/bowling', {
      testInputEnabled: false,
      realSensorLabEnabled: false,
    })).toBe('BOWLING')
  })

  it('opens Running Race in production without developer gates', () => {
    expect(screenFromHash('#game/running-race', {
      testInputEnabled: false,
      realSensorLabEnabled: false,
    })).toBe('RUNNING_RACE')
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
