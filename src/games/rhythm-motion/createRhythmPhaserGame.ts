import Phaser from 'phaser'

import { RhythmScene } from './RhythmScene'
import type { RhythmSession } from './RhythmSession'

export function createRhythmPhaserGame(
  parent: HTMLElement,
  session: RhythmSession,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#09152f',
    scene: [new RhythmScene(session)],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      roundPixels: false,
    },
  })
}
