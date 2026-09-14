import Phaser from 'phaser'

import { TennisScene } from './TennisScene'
import type { TennisSession } from './TennisSession'

export function createTennisPhaserGame(
  parent: HTMLElement,
  session: TennisSession,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#062a2f',
    scene: [new TennisScene(session)],
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
