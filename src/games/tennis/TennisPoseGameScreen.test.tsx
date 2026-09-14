import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import TennisPoseGameScreen, {
  TENNIS_POSE_INPUT_REQUEST,
  startTennisCamera,
} from './TennisPoseGameScreen'

describe('TennisPoseGameScreen production route', () => {
  it('renders explicit-start UPPER_BODY setup without requesting media', () => {
    const getUserMedia = vi.fn()
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { mediaDevices: { getUserMedia } },
    })

    try {
      const markup = renderToStaticMarkup(<TennisPoseGameScreen onExit={() => undefined} />)
      expect(markup).toContain('data-framing-requirement="UPPER_BODY"')
      expect(markup).toContain('啟動相機')
      expect(markup).toContain('頭部、肩膀、手臂、手腕、軀幹與髖部都要看得見')
      expect(markup.match(/<video/g)).toHaveLength(1)
      expect(getUserMedia).not.toHaveBeenCalled()
    } finally {
      if (originalNavigator) {
        Object.defineProperty(globalThis, 'navigator', originalNavigator)
      } else {
        Reflect.deleteProperty(globalThis, 'navigator')
      }
    }
  })

  it('requests UPPER_BODY Pose Sports Motion with no microphone', () => {
    expect(TENNIS_POSE_INPUT_REQUEST.players[0]?.abilityProfile.profileIds)
      .toEqual(['UPPER_BODY'])
    expect(TENNIS_POSE_INPUT_REQUEST.actions).toEqual([])
    expect(TENNIS_POSE_INPUT_REQUEST.sensors).toEqual({
      pose: true,
      hands: false,
      audio: false,
    })
  })

  it('starts the shared Pose runtime only from the explicit action', async () => {
    const runtime = { start: vi.fn(async () => undefined) }
    await startTennisCamera(runtime)
    expect(runtime.start).toHaveBeenCalledExactlyOnceWith(TENNIS_POSE_INPUT_REQUEST)
  })
})
