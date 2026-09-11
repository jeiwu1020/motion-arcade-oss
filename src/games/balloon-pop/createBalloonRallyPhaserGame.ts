import Phaser from 'phaser'

import { BalloonRallyScene } from './BalloonRallyScene'
import type { BalloonRallySession } from './BalloonRallySession'
import type { BalloonRallyAudio } from './BalloonRallyAudio'

export function createBalloonRallyPhaserGame(
  parent: HTMLElement,
  session: BalloonRallySession,
  audio?: BalloonRallyAudio,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: 'rgba(0,0,0,0)',
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
    },
    scene: [new BalloonRallyScene(session, audio)],
  })
}
