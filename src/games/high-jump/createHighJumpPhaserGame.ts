import Phaser from 'phaser'

import { HighJumpScene } from './HighJumpScene'
import type { HighJumpSession } from './HighJumpSession'

export function createHighJumpPhaserGame(parent: HTMLElement, session: HighJumpSession): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#161739',
    scene: [new HighJumpScene(session)],
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false },
  })
}
