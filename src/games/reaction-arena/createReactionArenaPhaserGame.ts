import Phaser from 'phaser'

import type { ReactionArenaAudio } from './ReactionArenaAudio'
import { ReactionArenaScene } from './ReactionArenaScene'
import type { ReactionArenaSession } from './ReactionArenaSession'

export function createReactionArenaPhaserGame(
  parent: HTMLElement,
  session: ReactionArenaSession,
  audio?: ReactionArenaAudio,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: 'rgba(0,0,0,0)',
    transparent: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
    scene: [new ReactionArenaScene(session, audio)],
  })
}
