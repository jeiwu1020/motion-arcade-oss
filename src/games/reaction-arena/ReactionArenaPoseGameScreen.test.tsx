import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import ReactionArenaPoseGameScreen, {
  REACTION_ARENA_POSE_INPUT_REQUEST,
} from './ReactionArenaPoseGameScreen'

describe('ReactionArenaPoseGameScreen', () => {
  it('offers practice and normal game entry choices on the shared FULL_BODY setup', () => {
    const markup = renderToStaticMarkup(<ReactionArenaPoseGameScreen onExit={() => undefined} />)

    expect(markup).toContain('動作測試')
    expect(markup).toContain('開始遊戲')
    expect(markup).toContain('data-framing-requirement="FULL_BODY"')
    expect(markup.match(/<video/g)).toHaveLength(1)
  })

  it('requests compact FULL_BODY LOW_MOTION actions including canonical leans', () => {
    expect(REACTION_ARENA_POSE_INPUT_REQUEST.players[0]?.abilityProfile).toMatchObject({
      profileIds: ['LOW_MOTION'],
      requiredMotionRangeScale: 0.6,
    })
    expect(REACTION_ARENA_POSE_INPUT_REQUEST.actions).toEqual([
      'MOVE_LEFT', 'MOVE_RIGHT', 'LEAN_LEFT', 'LEAN_RIGHT',
      'REACH_LEFT', 'REACH_RIGHT', 'SQUAT',
    ])
  })
})
