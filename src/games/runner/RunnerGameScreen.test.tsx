import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import RunnerGameScreen from './RunnerGameScreen'

describe('RunnerGameScreen developer route', () => {
  it('offers all four developer controls without a camera surface', () => {
    const markup = renderToStaticMarkup(<RunnerGameScreen onExit={() => undefined} />)

    expect(markup).toContain('DEVELOPER TEST MODE')
    expect(markup).toContain('← LEFT')
    expect(markup).toContain('RIGHT →')
    expect(markup).toContain('↑ JUMP')
    expect(markup).toContain('↓ SQUAT')
    expect(markup).not.toContain('<video')
    expect(markup).not.toContain('啟動相機')
  })
})
