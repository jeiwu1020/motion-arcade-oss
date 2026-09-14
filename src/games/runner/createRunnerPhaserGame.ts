import Phaser from 'phaser'

import { RunnerScene } from './RunnerScene'
import type { RunnerSession } from './RunnerSession'

export function createRunnerPhaserGame(
  parent: HTMLElement,
  session: RunnerSession,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#07132c',
    scene: [new RunnerScene(session)],
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
