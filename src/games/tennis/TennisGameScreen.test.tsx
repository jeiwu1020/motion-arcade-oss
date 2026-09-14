import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import TennisGameScreen from './TennisGameScreen'

describe('TennisGameScreen developer route', () => {
  it('offers bilateral developer swing controls without camera or microphone', () => {
    const markup = renderToStaticMarkup(<TennisGameScreen onExit={() => undefined} />)

    expect(markup).toContain('DEVELOPER TEST MODE')
    expect(markup).toContain('左手揮拍')
    expect(markup).toContain('右手揮拍')
    expect(markup).toContain('Z / Q')
    expect(markup).toContain('C / E')
    expect(markup).not.toContain('<video')
    expect(markup).not.toContain('麥克風')
  })
})
