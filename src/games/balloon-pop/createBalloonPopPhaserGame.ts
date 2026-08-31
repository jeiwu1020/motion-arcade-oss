import Phaser from 'phaser'

import { BalloonPopScene } from './BalloonPopScene'
import type { BalloonPopSession } from './BalloonPopSession'

export function createBalloonPopPhaserGame(
  parent: HTMLElement,
  session: BalloonPopSession,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#10284b',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
    },
    scene: [new BalloonPopScene(session)],
  })
}
