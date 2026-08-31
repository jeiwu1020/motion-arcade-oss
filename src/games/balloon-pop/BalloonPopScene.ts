import Phaser from 'phaser'

import type { BalloonPopSession } from './BalloonPopSession'

const WORLD_WIDTH = 1280
const WORLD_HEIGHT = 720
const TARGET_X = { LEFT: 330, RIGHT: 950 } as const

export type BalloonPopScenePresentation = 'STANDARD' | 'CAMERA_AR'

export class BalloonPopScene extends Phaser.Scene {
  readonly #session: BalloonPopSession
  readonly #presentation: BalloonPopScenePresentation
  #balloon!: Phaser.GameObjects.Container
  #balloonBody!: Phaser.GameObjects.Ellipse
  #countdownText!: Phaser.GameObjects.Text
  #statusText!: Phaser.GameObjects.Text
  #lastTargetId: number | null = null

  constructor(
    session: BalloonPopSession,
    presentation: BalloonPopScenePresentation = 'STANDARD',
  ) {
    super('balloon-pop')
    this.#session = session
    this.#presentation = presentation
  }

  create(): void {
    if (this.#presentation === 'STANDARD') {
      this.add.rectangle(
        WORLD_WIDTH / 2,
        WORLD_HEIGHT / 2,
        WORLD_WIDTH,
        WORLD_HEIGHT,
        0x10284b,
      )
      this.add.circle(150, 105, 230, 0x2f8cff, 0.15)
      this.add.circle(1140, 590, 290, 0xff7c9c, 0.12)
    }

    this.#addSideGuide(
      330,
      '左邊',
      this.#presentation === 'STANDARD' ? 'Z' : null,
      0x65c7ff,
    )
    this.#addSideGuide(
      950,
      '右邊',
      this.#presentation === 'STANDARD' ? 'C' : null,
      0xff8fa8,
    )

    const string = this.add
      .line(0, 155, 0, 0, 0, 155, 0xffffff, 0.68)
      .setLineWidth(4)
    const knot = this.add.triangle(0, 118, -15, 15, 15, 15, 0, -10, 0xffd34e)
    this.#balloonBody = this.add
      .ellipse(0, 0, 190, 235, 0xffd34e)
      .setStrokeStyle(10, 0xffffff, 0.92)
    const shine = this.add.ellipse(-38, -52, 30, 62, 0xffffff, 0.62)
    this.#balloon = this.add
      .container(TARGET_X.LEFT, 335, [string, knot, this.#balloonBody, shine])
      .setVisible(false)

    this.#countdownText = this.add
      .text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, '', {
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '190px',
        fontStyle: 'bold',
        stroke: '#10284b',
        strokeThickness: 18,
      })
      .setOrigin(0.5)

    this.#statusText = this.add
      .text(WORLD_WIDTH / 2, 635, '', {
        color: '#dbeeff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
  }

  update(time: number): void {
    const state = this.#session.getState()

    if (state.phase === 'COUNTDOWN') {
      this.#balloon.setVisible(false)
      this.#countdownText
        .setText(String(Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000))))
        .setVisible(true)
      this.#statusText.setText('準備好伸手拍氣球！')
      return
    }

    this.#countdownText.setVisible(false)
    if (state.phase === 'FINISHED') {
      this.#balloon.setVisible(false)
      this.#statusText.setText('時間到！')
      return
    }

    const target = state.target
    if (!target) {
      this.#balloon.setVisible(false)
      this.#statusText.setText('下一顆氣球準備中…')
      this.#lastTargetId = null
      return
    }

    if (target.id !== this.#lastTargetId) {
      this.#lastTargetId = target.id
      this.#balloon
        .setPosition(TARGET_X[target.side], 335)
        .setScale(0.78)
        .setAlpha(1)
        .setVisible(true)
      this.#balloonBody.setFillStyle(target.side === 'LEFT' ? 0x56c7ff : 0xff7898)
      this.tweens.add({
        targets: this.#balloon,
        scale: 1,
        duration: 180,
        ease: 'Back.Out',
      })
    }

    this.#balloon.y = 335 + Math.sin(time / 230) * 12
    this.#statusText.setText(target.side === 'LEFT' ? '伸左手！' : '伸右手！')
  }

  #addSideGuide(
    x: number,
    label: string,
    key: string | null,
    color: number,
  ): void {
    this.add
      .rectangle(x, 350, 500, 520, color, 0.05)
      .setStrokeStyle(4, color, 0.32)
    this.add
      .text(x, 72, label, {
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '44px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    if (key) {
      this.add
        .text(x, 548, `測試鍵 ${key}`, {
          color: '#bcd8ee',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '24px',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    }
  }
}
