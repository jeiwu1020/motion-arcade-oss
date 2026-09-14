import Phaser from 'phaser'

import { LongJumpScene } from './LongJumpScene'
import type { LongJumpSession } from './LongJumpSession'

export function createLongJumpPhaserGame(parent: HTMLElement, session: LongJumpSession): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#1d1637',
    scene: [new LongJumpScene(session)],
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false },
  })
}
