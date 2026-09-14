import Phaser from 'phaser'

import { BadmintonScene } from './BadmintonScene'
import type { BadmintonSession } from './BadmintonSession'

export function createBadmintonPhaserGame(
  parent: HTMLElement,
  session: BadmintonSession,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#10204a',
    scene: [new BadmintonScene(session)],
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
