import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import RunningRaceGameScreen from './RunningRaceGameScreen'

describe('RunningRaceGameScreen developer route', () => {
  it('offers camera-free bilateral knee-lift controls', () => {
    const markup = renderToStaticMarkup(<RunningRaceGameScreen onExit={() => undefined} />)

    expect(markup).toContain('DEVELOPER TEST MODE')
    expect(markup).toContain('左腳抬膝')
    expect(markup).toContain('右腳抬膝')
    expect(markup).toContain('A / ←')
    expect(markup).toContain('D / →')
    expect(markup).not.toContain('<video')
    expect(markup).not.toContain('啟動相機')
  })
})
