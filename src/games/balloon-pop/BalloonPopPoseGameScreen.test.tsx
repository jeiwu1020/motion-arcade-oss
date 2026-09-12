import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import BalloonPopPoseGameScreen, { startBalloonRallyCamera } from './BalloonPopPoseGameScreen'

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

  it('starts Pose without waiting for the gesture-bound audio unlock', async () => {
    let rejectUnlock: ((reason?: unknown) => void) | undefined
    const unlockPromise = new Promise<void>((_, reject) => {
      rejectUnlock = reject
    })
    const audio = { unlock: vi.fn(() => unlockPromise) }
    const runtime = { start: vi.fn(async () => undefined) }

    await startBalloonRallyCamera(audio, runtime)

    expect(audio.unlock).toHaveBeenCalledTimes(1)
    expect(runtime.start).toHaveBeenCalledTimes(1)
    rejectUnlock?.(new Error('audio unavailable'))
    await Promise.resolve()
  })
})
