import Phaser from 'phaser'

export class PhaseZeroScene extends Phaser.Scene {
  constructor() {
    super('phase-zero-proof')
  }

  create(): void {
    const { width, height } = this.scale

    this.add.rectangle(width / 2, height / 2, width, height, 0x070b16)
    this.add.rectangle(width / 2, height / 2, 960, 360, 0x111a2d)
    this.add
      .text(width / 2, height / 2 - 32, 'PHASER 4 READY', {
        color: '#f6f8fc',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '56px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.add
      .text(
        width / 2,
        height / 2 + 52,
        'Logical viewport 1280 × 720 · FIT · no sensors started',
        {
          color: '#74d8c8',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '26px',
        },
      )
      .setOrigin(0.5)
  }
}
