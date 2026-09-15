import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import VocalHopVoiceGameScreen, { VOCAL_HOP_VOICE_INPUT_REQUEST } from './VocalHopVoiceGameScreen'

describe('Vocal Hop production contract', () => {
  it('declares only the three F0 voice actions with explicit audio and no camera', () => {
    expect(VOCAL_HOP_VOICE_INPUT_REQUEST.actions).toEqual([
      'VOICE_LEVEL', 'VOICE_TRIGGER', 'VOICE_SUSTAINED_DURATION',
    ])
    expect(VOCAL_HOP_VOICE_INPUT_REQUEST.sensors).toEqual({ pose: false, hands: false, audio: true })
    expect(VOCAL_HOP_VOICE_INPUT_REQUEST.actions).not.toContain('VOICE_PITCH')
  })

  it('does not request microphone merely by importing the production screen', () => {
    expect(VOCAL_HOP_VOICE_INPUT_REQUEST.sensors.audio).toBe(true)
  })

  it('renders an explicit microphone setup with no camera preview', () => {
    const markup = renderToStaticMarkup(<VocalHopVoiceGameScreen onExit={() => undefined} />)
    expect(markup).toContain('啟用麥克風開始')
    expect(markup).toContain('不錄音')
    expect(markup).toContain('不辨識說話內容')
    expect(markup).not.toContain('<video')
    expect(markup).not.toContain('VOICE_PITCH')
  })
})
