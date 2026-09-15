import Phaser from 'phaser'
import { SoundCannonScene } from './SoundCannonScene'
import type { SoundCannonSession } from './SoundCannonSession'

export function createSoundCannonPhaserGame(parent: HTMLElement, session: SoundCannonSession): Phaser.Game {
  return new Phaser.Game({ type: Phaser.AUTO, parent, width: 1280, height: 720, backgroundColor: '#100b2f', scene: [new SoundCannonScene(session)], scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { antialias: true, roundPixels: false } })
}
