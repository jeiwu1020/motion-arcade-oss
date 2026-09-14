import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import RunnerPoseGameScreen, {
  RUNNER_POSE_INPUT_REQUEST,
  startRunnerCamera,
} from './RunnerPoseGameScreen'

describe('RunnerPoseGameScreen production route', () => {
  it('renders one explicit-start FULL_BODY camera setup without requesting media', () => {
    const getUserMedia = vi.fn()
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { mediaDevices: { getUserMedia } },
    })

    try {
      const markup = renderToStaticMarkup(<RunnerPoseGameScreen onExit={() => undefined} />)
      expect(markup).toContain('data-framing-requirement="FULL_BODY"')
      expect(markup).toContain('啟動相機')
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

  it('uses the existing STANDARD Pose action contract with no microphone', () => {
    expect(RUNNER_POSE_INPUT_REQUEST.players[0]?.abilityProfile.profileIds)
      .toEqual(['STANDARD'])
    expect(RUNNER_POSE_INPUT_REQUEST.actions).toEqual([
      'MOVE_LEFT',
      'MOVE_RIGHT',
      'JUMP',
      'SQUAT',
    ])
    expect(RUNNER_POSE_INPUT_REQUEST.sensors).toEqual({
      pose: true,
      hands: false,
      audio: false,
    })
  })

  it('starts the existing Pose runtime only from the explicit action', async () => {
    const runtime = { start: vi.fn(async () => undefined) }

    await startRunnerCamera(runtime)

    expect(runtime.start).toHaveBeenCalledExactlyOnceWith(RUNNER_POSE_INPUT_REQUEST)
  })
})
