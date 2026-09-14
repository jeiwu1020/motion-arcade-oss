import Phaser from 'phaser'

import { BowlingScene } from './BowlingScene'
import type { BowlingSession } from './BowlingSession'

export function createBowlingPhaserGame(parent: HTMLElement, session: BowlingSession): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#1a0e22',
    scene: [new BowlingScene(session)],
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
