import Phaser from 'phaser'

import { SwimmingScene } from './SwimmingScene'
import type { SwimmingSession } from './SwimmingSession'

export function createSwimmingPhaserGame(parent: HTMLElement, session: SwimmingSession): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#052d55',
    scene: [new SwimmingScene(session)],
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false },
  })
}
