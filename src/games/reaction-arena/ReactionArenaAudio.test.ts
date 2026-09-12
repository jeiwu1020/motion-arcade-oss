import { describe, expect, it } from 'vitest'

import { getReactionArenaAudioSources } from './ReactionArenaAudio'

describe('ReactionArenaAudio', () => {
  it('uses provisional local Reaction Arena asset paths', () => {
    expect(getReactionArenaAudioSources('SUCCESS')).toEqual(['/audio/reaction-arena/hit.mp3'])
    expect(getReactionArenaAudioSources('SPEED_ZONE_START')).toEqual(['/audio/reaction-arena/party-rush.mp3'])
    expect(getReactionArenaAudioSources('ROUND_FINISH')).toEqual([
      '/audio/reaction-arena/finish.mp3',
      '/audio/reaction-arena/cheer.mp3',
    ])
  })

  it('fails silently when browser audio is unavailable', async () => {
    const audio = new (await import('./ReactionArenaAudio')).ReactionArenaAudio({
      createAudioElement: () => { throw new Error('blocked') },
    })
    await expect(audio.unlock()).resolves.toBeUndefined()
    expect(() => audio.play('SUCCESS')).not.toThrow()
    audio.dispose()
  })
})
