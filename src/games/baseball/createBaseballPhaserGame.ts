import Phaser from 'phaser'

import { BaseballScene } from './BaseballScene'
import type { BaseballSession } from './BaseballSession'

export function createBaseballPhaserGame(
  parent: HTMLElement,
  session: BaseballSession,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#071d2b',
    scene: [new BaseballScene(session)],
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
