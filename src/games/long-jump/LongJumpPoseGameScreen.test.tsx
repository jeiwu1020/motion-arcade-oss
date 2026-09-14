import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import LongJumpPoseGameScreen, {
  LONG_JUMP_POSE_INPUT_REQUEST,
  startLongJumpCamera,
} from './LongJumpPoseGameScreen'

describe('LongJumpPoseGameScreen production route', () => {
  it('renders explicit-start FULL_BODY STRICT guidance without requesting media', () => {
    const getUserMedia = vi.fn()
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { mediaDevices: { getUserMedia } },
    })

    try {
      const markup = renderToStaticMarkup(<LongJumpPoseGameScreen onExit={() => undefined} />)
      expect(markup).toContain('data-framing-requirement="FULL_BODY"')
      expect(markup).toContain('頭、肩、髖部、膝蓋與雙腳踝清楚入鏡')
      expect(markup).toContain('啟動相機')
      expect(markup).toContain('不要往前跳')
      expect(markup.match(/<video/g)).toHaveLength(1)
      expect(getUserMedia).not.toHaveBeenCalled()
    } finally {
      if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
      else Reflect.deleteProperty(globalThis, 'navigator')
    }
  })

  it('requests only JUMP with STANDARD Pose, STRICT framing, and no microphone', () => {
    expect(LONG_JUMP_POSE_INPUT_REQUEST.players[0]?.abilityProfile.profileIds).toEqual(['STANDARD'])
    expect(LONG_JUMP_POSE_INPUT_REQUEST.actions).toEqual(['JUMP'])
    expect(LONG_JUMP_POSE_INPUT_REQUEST.sensors).toEqual({ pose: true, hands: false, audio: false })
  })

  it('starts the existing Pose runtime only from the explicit camera action', async () => {
    const runtime = { start: vi.fn(async () => undefined) }
    await startLongJumpCamera(runtime)
    expect(runtime.start).toHaveBeenCalledExactlyOnceWith(LONG_JUMP_POSE_INPUT_REQUEST)
  })
})
