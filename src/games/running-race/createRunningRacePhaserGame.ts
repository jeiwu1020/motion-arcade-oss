import Phaser from 'phaser'

import { RunningRaceScene } from './RunningRaceScene'
import type { RunningRaceSession } from './RunningRaceSession'

export function createRunningRacePhaserGame(
  parent: HTMLElement,
  session: RunningRaceSession,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 1280,
    height: 720,
    backgroundColor: '#071a35',
    scene: [new RunningRaceScene(session)],
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
