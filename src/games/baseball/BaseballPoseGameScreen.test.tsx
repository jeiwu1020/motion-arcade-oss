import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import BaseballPoseGameScreen, {
  BASEBALL_POSE_INPUT_REQUEST,
  startBaseballCamera,
} from './BaseballPoseGameScreen'

describe('BaseballPoseGameScreen production route', () => {
  it('renders explicit-start UPPER_BODY setup without automatic media permission', () => {
    const getUserMedia = vi.fn()
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { mediaDevices: { getUserMedia } },
    })

    try {
      const markup = renderToStaticMarkup(<BaseballPoseGameScreen onExit={() => undefined} />)
      expect(markup).toContain('data-framing-requirement="UPPER_BODY"')
      expect(markup).toContain('啟動相機')
      expect(markup).toContain('不需要拿球棒')
      expect(markup.match(/<video/g)).toHaveLength(1)
      expect(getUserMedia).not.toHaveBeenCalled()
    } finally {
      if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
      else Reflect.deleteProperty(globalThis, 'navigator')
    }
  })

  it('requests one UPPER_BODY Pose path with no Hands or microphone', () => {
    expect(BASEBALL_POSE_INPUT_REQUEST.players[0]?.abilityProfile.profileIds)
      .toEqual(['UPPER_BODY'])
    expect(BASEBALL_POSE_INPUT_REQUEST.actions).toEqual([])
    expect(BASEBALL_POSE_INPUT_REQUEST.sensors).toEqual({
      pose: true,
      hands: false,
      audio: false,
    })
  })

  it('starts the shared Pose runtime only from the explicit action', async () => {
    const runtime = { start: vi.fn(async () => undefined) }
    await startBaseballCamera(runtime)
    expect(runtime.start).toHaveBeenCalledExactlyOnceWith(BASEBALL_POSE_INPUT_REQUEST)
  })
})
