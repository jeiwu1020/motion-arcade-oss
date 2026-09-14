import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import SwimmingPoseGameScreen, {
  SWIMMING_POSE_INPUT_REQUEST,
  startSwimmingCamera,
} from './SwimmingPoseGameScreen'

describe('SwimmingPoseGameScreen production route', () => {
  it('renders explicit UPPER_BODY camera setup without automatic permission', () => {
    const getUserMedia = vi.fn()
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia } } })
    try {
      const markup = renderToStaticMarkup(<SwimmingPoseGameScreen onExit={() => undefined} />)
      expect(markup).toContain('data-framing-requirement="UPPER_BODY"')
      expect(markup).toContain('啟動相機')
      expect(markup).toContain('頭部、肩膀、手臂、手腕、軀幹與髖部')
      expect(markup.match(/<video/g)).toHaveLength(1)
      expect(getUserMedia).not.toHaveBeenCalled()
    } finally {
      if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
      else Reflect.deleteProperty(globalThis, 'navigator')
    }
  })

  it('requests the one Pose pipeline with no Hands or microphone', () => {
    expect(SWIMMING_POSE_INPUT_REQUEST.players[0]?.abilityProfile.profileIds).toEqual(['UPPER_BODY'])
    expect(SWIMMING_POSE_INPUT_REQUEST.actions).toEqual([])
    expect(SWIMMING_POSE_INPUT_REQUEST.sensors).toEqual({ pose: true, hands: false, audio: false })
  })

  it('starts the shared runtime only from explicit action', async () => {
    const runtime = { start: vi.fn(async () => undefined) }
    await startSwimmingCamera(runtime)
    expect(runtime.start).toHaveBeenCalledExactlyOnceWith(SWIMMING_POSE_INPUT_REQUEST)
  })
})
