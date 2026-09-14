import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import BaseballGameScreen, {
  baseballDeveloperSwingIntensity,
} from './BaseballGameScreen'

describe('BaseballGameScreen developer route', () => {
  it('offers bilateral camera-free controls and a strong-swing modifier', () => {
    const markup = renderToStaticMarkup(<BaseballGameScreen onExit={() => undefined} />)

    expect(markup).toContain('DEVELOPER TEST MODE')
    expect(markup).toContain('左手揮棒')
    expect(markup).toContain('右手揮棒')
    expect(markup).toContain('Shift')
    expect(markup).not.toContain('<video')
    expect(markup).not.toContain('麥克風')
    expect(baseballDeveloperSwingIntensity(false)).toBe(0.72)
    expect(baseballDeveloperSwingIntensity(true)).toBe(1)
  })
})
