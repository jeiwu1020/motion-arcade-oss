import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import HighJumpGameScreen from './HighJumpGameScreen'

describe('HighJumpGameScreen developer route', () => {
  it('offers camera-free timing controls without strength variants', () => {
    const markup = renderToStaticMarkup(<HighJumpGameScreen onExit={() => undefined} />)

    expect(markup).toContain('DEVELOPER TEST MODE')
    expect(markup).toContain('跳躍')
    expect(markup).toContain('Space / W / ↑')
    expect(markup).toContain('輕輕跳即可')
    expect(markup).not.toContain('<video')
    expect(markup).not.toContain('全力')
  })
})
