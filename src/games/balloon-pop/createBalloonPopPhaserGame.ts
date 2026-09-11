import Phaser from 'phaser'

import type { SpatialCollisionInputAdapter } from '../../spatial/SpatialCollisionInputAdapter'
import {
  BalloonPopScene,
  type BalloonPopScenePresentation,
} from './BalloonPopScene'
import type { BalloonPopSession } from './BalloonPopSession'

export function createBalloonPopPhaserGame(
  parent: HTMLElement,
  session: BalloonPopSession,
  presentation: BalloonPopScenePresentation = 'STANDARD',
  spatialCollisionInput?: SpatialCollisionInputAdapter,
): Phaser.Game {
  const cameraAr = presentation === 'CAMERA_AR'
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: cameraAr ? 'rgba(0,0,0,0)' : '#10284b',
    transparent: cameraAr,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
    },
    scene: [new BalloonPopScene(session, presentation, spatialCollisionInput)],
  })
}
