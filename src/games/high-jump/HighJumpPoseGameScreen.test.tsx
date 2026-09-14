import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import HighJumpPoseGameScreen, {
  HIGH_JUMP_POSE_INPUT_REQUEST,
  startHighJumpCamera,
} from './HighJumpPoseGameScreen'

describe('HighJumpPoseGameScreen production route', () => {
  it('renders explicit-start FULL_BODY STRICT guidance without requesting media', () => {
    const getUserMedia = vi.fn()
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { mediaDevices: { getUserMedia } },
    })

    try {
      const markup = renderToStaticMarkup(<HighJumpPoseGameScreen onExit={() => undefined} />)
      expect(markup).toContain('data-framing-requirement="FULL_BODY"')
      expect(markup).toContain('頭、肩、髖部、膝蓋與雙腳踝清楚入鏡')
      expect(markup).toContain('啟動相機')
      expect(markup.match(/<video/g)).toHaveLength(1)
      expect(getUserMedia).not.toHaveBeenCalled()
    } finally {
      if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
      else Reflect.deleteProperty(globalThis, 'navigator')
    }
  })

  it('requests only the existing JUMP action with STANDARD Pose and no microphone', () => {
    expect(HIGH_JUMP_POSE_INPUT_REQUEST.players[0]?.abilityProfile.profileIds).toEqual(['STANDARD'])
    expect(HIGH_JUMP_POSE_INPUT_REQUEST.actions).toEqual(['JUMP'])
    expect(HIGH_JUMP_POSE_INPUT_REQUEST.sensors).toEqual({ pose: true, hands: false, audio: false })
  })

  it('starts the existing Pose runtime only from the explicit action', async () => {
    const runtime = { start: vi.fn(async () => undefined) }
    await startHighJumpCamera(runtime)
    expect(runtime.start).toHaveBeenCalledExactlyOnceWith(HIGH_JUMP_POSE_INPUT_REQUEST)
  })
})
