import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import RhythmGameScreen from './RhythmGameScreen'

describe('RhythmGameScreen developer route', () => {
  it('offers four large developer action controls without camera or microphone', () => {
    const markup = renderToStaticMarkup(<RhythmGameScreen onExit={() => undefined} />)

    expect(markup).toContain('DEVELOPER TEST MODE')
    expect(markup).toContain('← LEFT')
    expect(markup).toContain('RIGHT →')
    expect(markup).toContain('↙ REACH LEFT')
    expect(markup).toContain('REACH RIGHT ↘')
    expect(markup).not.toContain('<video')
    expect(markup).not.toContain('啟動相機')
    expect(markup).not.toContain('麥克風')
  })
})
