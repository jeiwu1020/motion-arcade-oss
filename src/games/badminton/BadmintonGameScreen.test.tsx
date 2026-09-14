import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import BadmintonGameScreen from './BadmintonGameScreen'

describe('BadmintonGameScreen developer route', () => {
  it('offers bilateral camera-free swing controls and a simple smash test shortcut', () => {
    const markup = renderToStaticMarkup(<BadmintonGameScreen onExit={() => undefined} />)

    expect(markup).toContain('DEVELOPER TEST MODE')
    expect(markup).toContain('左手揮拍')
    expect(markup).toContain('右手揮拍')
    expect(markup).toContain('Z / Q')
    expect(markup).toContain('C / E')
    expect(markup).toContain('Shift + Z / C')
    expect(markup).not.toContain('<video')
    expect(markup).not.toContain('麥克風')
  })
})
