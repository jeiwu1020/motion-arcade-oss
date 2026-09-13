import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import ReactionArenaPoseGameScreen from './ReactionArenaPoseGameScreen'

describe('ReactionArenaPoseGameScreen', () => {
  it('offers practice and normal game entry choices on the shared FULL_BODY setup', () => {
    const markup = renderToStaticMarkup(<ReactionArenaPoseGameScreen onExit={() => undefined} />)

    expect(markup).toContain('動作測試')
    expect(markup).toContain('開始遊戲')
    expect(markup).toContain('data-framing-requirement="FULL_BODY"')
    expect(markup.match(/<video/g)).toHaveLength(1)
  })
})
