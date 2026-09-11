import { describe, expect, it, vi } from 'vitest'

import {
  BALLOON_RALLY_AUDIO_ASSETS,
  BALLOON_RALLY_AUDIO_CONFIG,
  BalloonRallyAudio,
  getBalloonRallyAudioSources,
  type BalloonRallySfxEvent,
} from './BalloonRallyAudio'

function fakeContext(): AudioContext {
  return {
    state: 'running',
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    decodeAudioData: vi.fn(async () => ({} as AudioBuffer)),
    destination: {},
  } as unknown as AudioContext
}

function fakeAudioElement(): HTMLAudioElement {
  return {
    src: '',
    preload: '',
    loop: false,
    volume: 1,
    currentTime: 0,
    pause: vi.fn(),
    play: vi.fn(async () => undefined),
    setAttribute: vi.fn(),
  } as unknown as HTMLAudioElement
}

describe('Balloon Rally local MP3 audio', () => {
  it('maps every SFX event to the supplied local asset, including layered pops', () => {
    const expected: Record<BalloonRallySfxEvent, readonly string[]> = {
      NORMAL_HIT: [BALLOON_RALLY_AUDIO_ASSETS.hit],
      NORMAL_POP: [BALLOON_RALLY_AUDIO_ASSETS.pop],
      GOLDEN_POP: [BALLOON_RALLY_AUDIO_ASSETS.pop, BALLOON_RALLY_AUDIO_ASSETS.goldenSparkle],
      GIANT_HIT: [BALLOON_RALLY_AUDIO_ASSETS.giantHit],
      GIANT_POP: [BALLOON_RALLY_AUDIO_ASSETS.pop, BALLOON_RALLY_AUDIO_ASSETS.giantHit],
      COMBO_MILESTONE: [BALLOON_RALLY_AUDIO_ASSETS.combo],
      COMBO_MILESTONE_STRONG: [BALLOON_RALLY_AUDIO_ASSETS.combo],
      MINI_EVENT_START: [BALLOON_RALLY_AUDIO_ASSETS.eventStart],
      PARTY_RUSH_START: [BALLOON_RALLY_AUDIO_ASSETS.partyRush],
      COUNTDOWN_TICK: [BALLOON_RALLY_AUDIO_ASSETS.countdown],
      ROUND_FINISH: [BALLOON_RALLY_AUDIO_ASSETS.finish],
    }
    for (const [event, sources] of Object.entries(expected) as [BalloonRallySfxEvent, readonly string[]][]) {
      expect(getBalloonRallyAudioSources(event)).toEqual(sources)
    }
  })

  it('does not create or play audio before the explicit unlock', () => {
    const createAudioElement = vi.fn(fakeAudioElement)
    const audio = new BalloonRallyAudio({ audioContextFactory: fakeContext, createAudioElement })
    audio.play('NORMAL_HIT')
    audio.startBgm()
    expect(createAudioElement).not.toHaveBeenCalled()
    expect(audio.getActiveVoiceCount()).toBe(0)
  })

  it('uses one looping BGM instance, applies the Party Rush gain, and stops cleanly', async () => {
    const element = fakeAudioElement()
    const createAudioElement = vi.fn(() => element)
    const audio = new BalloonRallyAudio({
      audioContextFactory: fakeContext,
      createAudioElement,
      fetchAsset: vi.fn(async () => ({ ok: false } as Response)),
    })
    await audio.unlock()
    audio.startBgm()
    audio.startBgm()
    expect(createAudioElement).toHaveBeenCalledTimes(1)
    expect(element.src).toBe(BALLOON_RALLY_AUDIO_ASSETS.bgm)
    expect(element.volume).toBe(BALLOON_RALLY_AUDIO_CONFIG.normalBgmGain)
    expect(element.play).toHaveBeenCalledTimes(2)
    audio.setPartyRush()
    expect(element.volume).toBe(BALLOON_RALLY_AUDIO_CONFIG.partyRushBgmGain)
    audio.stopBgm()
    expect(element.pause).toHaveBeenCalled()
    await audio.dispose()
    expect(audio.getHasBgmInstance()).toBe(false)
  })

  it('remains fail-silent when AudioContext or an asset is unavailable', async () => {
    const audio = new BalloonRallyAudio({ fetchAsset: vi.fn(async () => { throw new Error('offline') }) })
    await expect(audio.unlock()).resolves.toBeUndefined()
    expect(() => audio.play('GOLDEN_POP')).not.toThrow()
    expect(() => audio.startBgm()).not.toThrow()
    await expect(audio.dispose()).resolves.toBeUndefined()
    expect(BALLOON_RALLY_AUDIO_CONFIG.maxSfxVoices).toBe(24)
  })
})
