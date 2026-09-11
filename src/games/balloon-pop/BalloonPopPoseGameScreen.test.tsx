import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import BalloonPopPoseGameScreen from './BalloonPopPoseGameScreen'

describe('BalloonPopPoseGameScreen', () => {
  it('uses the single existing Pose runtime for production Balloon Rally without engineering markers or probe UI', () => {
    const markup = renderToStaticMarkup(
      <BalloonPopPoseGameScreen onExit={() => undefined} />,
    )

    expect(markup).not.toContain('data-spatial-diagnostic="engineering"')
    expect(markup).not.toContain('data-spatial-collision-probe="enabled"')
    expect(markup).toContain('data-framing-requirement="UPPER_BODY"')
    expect(markup).not.toContain('錯過')
    expect(markup).toContain('分數')
    expect(markup).toContain('時間')
    expect(markup).not.toContain('命中')
    expect(markup.match(/<video/g)).toHaveLength(1)
  })
})
