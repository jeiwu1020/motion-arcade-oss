import { describe, expect, it } from 'vitest'

import {
  SOUND_CANNON_RULES,
  advanceSoundCannon,
  createSoundCannonState,
  generateSoundCannonTargets,
  soundCannonCharge,
  soundCannonComfortLevel,
  soundCannonPhaseAt,
  soundCannonStreakBonus,
  soundCannonTimingGrade,
  type SoundCannonFireEvent,
  type SoundCannonState,
} from './SoundCannonCore'

function playing(seed = 7): SoundCannonState {
  return advanceSoundCannon(createSoundCannonState({ seed }), { deltaMs: SOUND_CANNON_RULES.countdownMs })
}

function advanceTo(state: SoundCannonState, timeMs: number, fireEvents: readonly SoundCannonFireEvent[] = []): SoundCannonState {
  return advanceSoundCannon(state, { deltaMs: Math.max(0, timeMs - state.elapsedMs), fireEvents })
}

describe('Sound Cannon shaping and deterministic course', () => {
  it('uses the comfortable saturating shaping curve', () => {
    expect(soundCannonComfortLevel(0.1)).toBe(0)
    expect(soundCannonComfortLevel(0.3)).toBeCloseTo(Math.sqrt(0.5))
    expect(soundCannonComfortLevel(0.5)).toBe(1)
    expect(soundCannonComfortLevel(2)).toBe(1)
    expect(soundCannonComfortLevel(Number.NaN)).toBe(0)
    expect(soundCannonCharge(0, 0)).toBe(0)
    expect(soundCannonCharge(1, 0.75)).toBe(1)
    expect(soundCannonCharge(0, 0.75)).toBe(0.75)
  })

  it('generates the same target course for the same seed', () => {
    expect(generateSoundCannonTargets(123)).toEqual(generateSoundCannonTargets(123))
    expect(generateSoundCannonTargets(123).slice(0, 4).map((target) => target.type)).toEqual(['ORB', 'ORB', 'SHIELD', 'COMET'])
    expect(generateSoundCannonTargets(123).every((target) => target.targetTimeMs < SOUND_CANNON_RULES.roundMs)).toBe(true)
    expect(generateSoundCannonTargets(123).every((target, index, all) => index === 0 || target.targetTimeMs - all[index - 1]!.targetTimeMs >= SOUND_CANNON_RULES.minimumTargetSpacingMs)).toBe(true)
  })

  it('has exact phases and legal spacing', () => {
    expect(soundCannonPhaseAt(0)).toBe('WARM_UP')
    expect(soundCannonPhaseAt(15_000)).toBe('TARGET_WAVE')
    expect(soundCannonPhaseAt(35_000)).toBe('POWER_WAVE')
    expect(soundCannonPhaseAt(50_000)).toBe('FINAL_BARRAGE')
    expect(SOUND_CANNON_RULES.finalBarrageSpacingMs).toBe(1_800)
  })
})

describe('Sound Cannon contact, result and scoring', () => {
  it('grades exact timing boundaries', () => {
    expect(soundCannonTimingGrade(130)).toBe('PERFECT')
    expect(soundCannonTimingGrade(131)).toBe('GREAT')
    expect(soundCannonTimingGrade(270)).toBe('GREAT')
    expect(soundCannonTimingGrade(271)).toBe('GOOD')
    expect(soundCannonTimingGrade(430)).toBe('GOOD')
    expect(soundCannonTimingGrade(431)).toBeNull()
  })

  it('applies streak bonuses', () => {
    expect(soundCannonStreakBonus(25)).toBe(50)
  })

  it('resolves one valid fire and keeps a low-power hit eligible', () => {
    const initial = playing()
    const target = initial.targets[0]!
    const next = advanceTo(initial, target.targetTimeMs, [{ timestampMs: target.targetTimeMs, blastPower: 0.01, fullBlast: false }])
    expect(next.hits).toBe(1)
    expect(next.misses).toBe(0)
    expect(next.lastResult?.hit?.blastPower).toBe(0.01)
    expect(next.targets.filter((item) => item.resolution !== 'PENDING')).toHaveLength(1)
  })

  it('misses expired targets, counts wasted early shots, and finishes exactly', () => {
    const initial = playing()
    const target = initial.targets[0]!
    const wasted = advanceTo(initial, target.targetTimeMs - 500, [{ timestampMs: target.targetTimeMs - 500, blastPower: 0.5, fullBlast: false }])
    expect(wasted.wastedShots).toBe(1)
    expect(wasted.score).toBe(0)
    const finished = advanceSoundCannon(wasted, { deltaMs: SOUND_CANNON_RULES.roundMs })
    expect(finished.phase).toBe('FINISHED')
    expect(finished.elapsedMs).toBe(60_000)
    expect(finished.finalResult).not.toBeNull()
    expect(advanceSoundCannon(finished, { deltaMs: 1000 })).toEqual(finished)
  })
})
