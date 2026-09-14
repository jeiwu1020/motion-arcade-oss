import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import SwimmingGameScreen from './SwimmingGameScreen'

describe('SwimmingGameScreen developer route', () => {
  it('offers camera-free bilateral stroke controls and strong-stroke shortcuts', () => {
    const markup = renderToStaticMarkup(<SwimmingGameScreen onExit={() => undefined} />)
    expect(markup).toContain('DEVELOPER TEST MODE')
    expect(markup).toContain('左手划水')
    expect(markup).toContain('右手划水')
    expect(markup).toContain('Z / Q')
    expect(markup).toContain('C / E')
    expect(markup).toContain('Shift')
    expect(markup).not.toContain('<video')
    expect(markup).not.toContain('麥克風')
  })
})
