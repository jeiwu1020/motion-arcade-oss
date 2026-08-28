import Phaser from 'phaser'

import { DeveloperInputLabScene } from './DeveloperInputLabScene'
import type { TestLabMotionBridge } from './TestLabMotionBridge'

export function createPhaserGame(
  parent: HTMLElement,
  bridge: TestLabMotionBridge,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#070b16',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
    },
    scene: [new DeveloperInputLabScene(bridge)],
  })
}
