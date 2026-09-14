import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import RunningRacePoseGameScreen, {
  RUNNING_RACE_POSE_INPUT_REQUEST,
  startRunningRaceCamera,
} from './RunningRacePoseGameScreen'

describe('RunningRacePoseGameScreen production route', () => {
  it('renders explicit-start FULL_BODY KNEES guidance without requesting media', () => {
    const getUserMedia = vi.fn()
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { mediaDevices: { getUserMedia } },
    })

    try {
      const markup = renderToStaticMarkup(<RunningRacePoseGameScreen onExit={() => undefined} />)
      expect(markup).toContain('data-framing-requirement="FULL_BODY"')
      expect(markup).toContain('頭、肩、髖部與雙膝清楚入鏡')
      expect(markup).toContain('腳踝可暫時離開畫面')
      expect(markup).toContain('啟動相機')
      expect(markup.match(/<video/g)).toHaveLength(1)
      expect(getUserMedia).not.toHaveBeenCalled()
    } finally {
      if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
      else Reflect.deleteProperty(globalThis, 'navigator')
    }
  })

  it('requests Pose with no actions, no Hands model, and no microphone', () => {
    expect(RUNNING_RACE_POSE_INPUT_REQUEST.players[0]?.abilityProfile.profileIds)
      .toEqual(['STANDARD'])
    expect(RUNNING_RACE_POSE_INPUT_REQUEST.actions).toEqual([])
    expect(RUNNING_RACE_POSE_INPUT_REQUEST.sensors).toEqual({
      pose: true, hands: false, audio: false,
    })
  })

  it('starts the existing Pose runtime only from the explicit action', async () => {
    const runtime = { start: vi.fn(async () => undefined) }
    await startRunningRaceCamera(runtime)
    expect(runtime.start).toHaveBeenCalledExactlyOnceWith(RUNNING_RACE_POSE_INPUT_REQUEST)
  })
})
