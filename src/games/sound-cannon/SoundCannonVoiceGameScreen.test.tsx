import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SoundCannonVoiceGameScreen, { SOUND_CANNON_VOICE_INPUT_REQUEST } from './SoundCannonVoiceGameScreen'

describe('Sound Cannon production boundary', () => {
  it('requests only F0 voice actions with no camera or pitch', () => {
    expect(SOUND_CANNON_VOICE_INPUT_REQUEST.actions).toEqual(['VOICE_LEVEL', 'VOICE_TRIGGER', 'VOICE_SUSTAINED_DURATION'])
    expect(SOUND_CANNON_VOICE_INPUT_REQUEST.sensors).toEqual({ pose: false, hands: false, audio: true })
  })
  it('renders explicit microphone setup without requesting it during render', () => {
    const markup = renderToStaticMarkup(<SoundCannonVoiceGameScreen onExit={() => undefined} />)
    expect(markup).toContain('啟用麥克風開始')
    expect(markup).toContain('不錄音、不儲存、不辨識內容')
  })
})
