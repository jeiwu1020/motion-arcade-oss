import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import BowlingGameScreen from './BowlingGameScreen'

describe('BowlingGameScreen developer route', () => {
  it('offers bilateral camera-free roll controls and the aim-marker hint', () => {
    const markup = renderToStaticMarkup(<BowlingGameScreen onExit={() => undefined} />)
    expect(markup).toContain('DEVELOPER TEST MODE')
    expect(markup).toContain('左手投球')
    expect(markup).toContain('右手投球')
    expect(markup).toContain('Z / Q')
    expect(markup).toContain('C / E')
    expect(markup).toContain('自動瞄準')
    expect(markup).not.toContain('<video')
    expect(markup).not.toContain('麥克風')
  })
})
