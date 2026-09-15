import Phaser from 'phaser'

import { VocalHopScene } from './VocalHopScene'
import type { VocalHopSession } from './VocalHopSession'

export function createVocalHopPhaserGame(parent: HTMLElement, session: VocalHopSession): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#102650',
    scene: [new VocalHopScene(session)],
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false },
  })
}
