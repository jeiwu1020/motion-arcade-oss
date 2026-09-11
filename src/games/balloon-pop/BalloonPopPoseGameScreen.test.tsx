import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import BalloonPopPoseGameScreen from './BalloonPopPoseGameScreen'

describe('BalloonPopPoseGameScreen', () => {
  it('passes the existing runtime spatial snapshot into the camera-stage engineering diagnostic', () => {
    const markup = renderToStaticMarkup(
      <BalloonPopPoseGameScreen onExit={() => undefined} />,
    )

    expect(markup).toContain('data-spatial-diagnostic="engineering"')
    expect(markup.match(/<video/g)).toHaveLength(1)
  })
})
