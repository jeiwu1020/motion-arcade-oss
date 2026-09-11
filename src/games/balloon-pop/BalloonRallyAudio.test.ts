import { describe, expect, it } from 'vitest'

import { BalloonRallyAudio } from './BalloonRallyAudio'

describe('Balloon Rally audio helper', () => {
  it('fails silently when Web Audio is unavailable', async () => {
    const audio = new BalloonRallyAudio()
    await expect(audio.unlock()).resolves.toBeUndefined()
    expect(() => audio.play('NORMAL_HIT')).not.toThrow()
    expect(() => audio.play('PARTY_RUSH_START')).not.toThrow()
    await expect(audio.dispose()).resolves.toBeUndefined()
  })
})
