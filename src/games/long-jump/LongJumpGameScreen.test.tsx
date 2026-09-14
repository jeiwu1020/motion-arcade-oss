import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import LongJumpGameScreen from './LongJumpGameScreen'

describe('LongJumpGameScreen developer route', () => {
  it('offers camera-free step, jump, and safety controls without effort coaching', () => {
    const markup = renderToStaticMarkup(<LongJumpGameScreen onExit={() => undefined} />)

    expect(markup).toContain('DEVELOPER TEST MODE')
    expect(markup).toContain('左腳抬膝')
    expect(markup).toContain('右腳抬膝')
    expect(markup).toContain('跳躍')
    expect(markup).toContain('Space / W / ↑')
    expect(markup).toContain('原地抬膝蓄力')
    expect(markup).toContain('不要往前跳')
    expect(markup).not.toContain('<video')
    expect(markup).not.toContain('全力')
  })
})
