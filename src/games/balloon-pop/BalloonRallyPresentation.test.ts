import { describe, expect, it } from 'vitest'

import {
  getBalloonRallyDamageStage,
  getComboMilestoneCrossed,
  getBalloonRallyOneShotCues,
  updateBalloonRallyHandGlowTrail,
  type BalloonRallyHandVisualSnapshot,
  type BalloonRallyHandGlowTrailState,
} from './BalloonRallyPresentation'

function emptyTrail(): BalloonRallyHandGlowTrailState {
  return {
    left: { anchor: null, points: [] },
    right: { anchor: null, points: [] },
  }
}

const available = (side: 'LEFT' | 'RIGHT', x: number, y: number): BalloonRallyHandVisualSnapshot => ({
  side,
  availability: 'AVAILABLE',
  x,
  y,
})

describe('Balloon Rally presentation helpers', () => {
  it('creates bounded left/right glow anchors from logical interaction coordinates', () => {
    const state = updateBalloonRallyHandGlowTrail(emptyTrail(), [
      available('LEFT', 100, 200),
      available('RIGHT', 900, 400),
    ], 1000)
    expect(state.left.anchor).toEqual({ x: 100, y: 200 })
    expect(state.right.anchor).toEqual({ x: 900, y: 400 })
    expect(state.left.points).toHaveLength(1)
    expect(state.right.points).toHaveLength(1)
  })

  it('does not emit a new point for tiny jitter and bounds trail history', () => {
    let state = updateBalloonRallyHandGlowTrail(emptyTrail(), [available('LEFT', 100, 200)], 1000)
    state = updateBalloonRallyHandGlowTrail(state, [available('LEFT', 104, 203)], 1010)
    expect(state.left.points).toHaveLength(1)
    for (let index = 0; index < 20; index += 1) {
      state = updateBalloonRallyHandGlowTrail(state, [available('LEFT', 120 + index * 20, 200)], 1020 + index * 20)
    }
    expect(state.left.points.length).toBeLessThanOrEqual(12)
  })

  it('stops emitting when a hand is unavailable and fades old points without a fake coordinate', () => {
    let state = updateBalloonRallyHandGlowTrail(emptyTrail(), [available('LEFT', 100, 200)], 1000)
    state = updateBalloonRallyHandGlowTrail(state, [{ side: 'LEFT', availability: 'UNAVAILABLE' }], 1050)
    expect(state.left.anchor).toBeNull()
    expect(state.left.points).toHaveLength(1)
    state = updateBalloonRallyHandGlowTrail(state, [{ side: 'LEFT', availability: 'UNAVAILABLE' }], 1300)
    expect(state.left.points).toHaveLength(0)
  })

  it('reports milestone crossings once and keeps score logic out of presentation', () => {
    expect(getComboMilestoneCrossed(4, 5)).toEqual({ value: 5, label: '5 COMBO!' })
    expect(getComboMilestoneCrossed(5, 6)).toBeNull()
    expect(getComboMilestoneCrossed(9, 10)).toEqual({ value: 10, label: 'SUPER COMBO!' })
    expect(getComboMilestoneCrossed(14, 15)).toEqual({ value: 15, label: '15 COMBO!' })
    expect(getComboMilestoneCrossed(24, 25)).toEqual({ value: 25, label: '25 COMBO!' })
  })

  it('maps multi-hit balloons to readable damage stages while one-hit targets stay clean', () => {
    expect(getBalloonRallyDamageStage('STANDARD', 2, 2)).toBe('NONE')
    expect(getBalloonRallyDamageStage('STANDARD', 1, 2)).toBe('CRACKED')
    expect(getBalloonRallyDamageStage('GIANT', 4, 4)).toBe('NONE')
    expect(getBalloonRallyDamageStage('GIANT', 3, 4)).toBe('CRACKED')
    expect(getBalloonRallyDamageStage('GIANT', 2, 4)).toBe('CRACKED')
    expect(getBalloonRallyDamageStage('GIANT', 1, 4)).toBe('HEAVILY_CRACKED')
    expect(getBalloonRallyDamageStage('GOLDEN', 1, 1)).toBe('NONE')
    expect(getBalloonRallyDamageStage('PARTY', 1, 1)).toBe('NONE')
    expect(getBalloonRallyDamageStage('BONUS', 1, 1)).toBe('NONE')
  })

  it('emits one-shot transition cues only when the corresponding state boundary is crossed', () => {
    const playing = { phase: 'PLAYING' as const, combo: 4, miniEventSequence: 0, partyRush: false, roundRemainingMs: 3_100 }
    const party = { ...playing, combo: 5, partyRush: true, roundRemainingMs: 3_000 }
    expect(getBalloonRallyOneShotCues(playing, party)).toEqual([
      { kind: 'COMBO_MILESTONE', milestone: { value: 5, label: '5 COMBO!' } },
      { kind: 'PARTY_RUSH_START' },
      { kind: 'FINAL_COUNTDOWN', value: 3 },
    ])
    expect(getBalloonRallyOneShotCues(party, party)).toEqual([])
    expect(getBalloonRallyOneShotCues({ ...party, phase: 'PLAYING' }, { ...party, phase: 'FINISHED', roundRemainingMs: 0 })).toEqual([
      { kind: 'ROUND_FINISH' },
    ])
  })
})
