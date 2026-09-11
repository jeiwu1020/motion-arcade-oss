import Phaser from 'phaser'

import type { BalloonRallyBalloon, BalloonRallyState } from './BalloonRallyCore'
import type { BalloonRallySession } from './BalloonRallySession'

const WORLD_WIDTH = 1280
const WORLD_HEIGHT = 720
const BALLOON_COLORS = [0xff668f, 0x56c7ff, 0xffc857, 0x8ce6a7] as const

interface RenderedBalloon {
  readonly container: Phaser.GameObjects.Container
  readonly body: Phaser.GameObjects.Ellipse
  readonly hp: Phaser.GameObjects.Text
  readonly lastHp: number
}

/** Phaser presentation only. Core/session own rules, contact, and physics. */
export class BalloonRallyScene extends Phaser.Scene {
  readonly #session: BalloonRallySession
  readonly #balloons = new Map<number, RenderedBalloon>()
  #countdownText!: Phaser.GameObjects.Text
  #statusText!: Phaser.GameObjects.Text
  #partyRushText!: Phaser.GameObjects.Text
  #partyRushSeen = false

  constructor(session: BalloonRallySession) {
    super('balloon-rally')
    this.#session = session
  }

  create(): void {
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
      .text(WORLD_WIDTH / 2, 660, '', {
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '31px',
        fontStyle: 'bold',
        stroke: '#10284b',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
    this.#partyRushText = this.add
      .text(WORLD_WIDTH / 2, 170, 'PARTY RUSH!', {
        color: '#ffec70',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '76px',
        fontStyle: 'bold',
        stroke: '#6d1f4a',
        strokeThickness: 13,
      })
      .setOrigin(0.5)
      .setVisible(false)
  }

  update(): void {
    const state = this.#session.getState()
    if (!state.partyRush) this.#partyRushSeen = false
    if (state.phase === 'COUNTDOWN') {
      this.#clearBalloons()
      this.#countdownText
        .setText(String(Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000))))
        .setVisible(true)
      this.#statusText.setText('雙手準備好，拍破氣球！').setVisible(true)
      return
    }

    this.#countdownText.setVisible(false)
    if (state.phase === 'FINISHED') {
      this.#clearBalloons()
      this.#statusText.setText('時間到！').setVisible(true)
      return
    }

    this.#reconcileBalloons(state)
    this.#statusText
      .setText(state.partyRush ? 'PARTY RUSH！加速拍氣球！' : '雙手拍氣球！')
      .setVisible(true)
    if (state.partyRush && !this.#partyRushSeen) {
      this.#partyRushSeen = true
      this.#partyRushText.setAlpha(1).setScale(0.72).setVisible(true)
      this.tweens.add({
        targets: this.#partyRushText,
        scale: 1,
        alpha: 0,
        duration: 1_350,
        ease: 'Back.Out',
        onComplete: () => this.#partyRushText.setVisible(false),
      })
    }
  }

  #reconcileBalloons(state: BalloonRallyState): void {
    const expectedIds = new Set(state.balloons.map((balloon) => balloon.id))
    for (const [id, rendered] of this.#balloons) {
      if (!expectedIds.has(id)) {
        this.#pop(rendered.container.x, rendered.container.y)
        rendered.container.destroy()
        this.#balloons.delete(id)
      }
    }
    for (const balloon of state.balloons) {
      const rendered = this.#balloons.get(balloon.id) ?? this.#createBalloon(balloon)
      rendered.container.setPosition(balloon.x, balloon.y).setVisible(true)
      rendered.hp.setText('●'.repeat(balloon.hp) + '○'.repeat(balloon.maxHp - balloon.hp))
      if (balloon.hp < rendered.lastHp) {
        this.tweens.killTweensOf(rendered.container)
        rendered.container.setScale(1.16, 0.82)
        this.tweens.add({
          targets: rendered.container,
          scaleX: 1,
          scaleY: 1,
          duration: 150,
          ease: 'Back.Out',
        })
        this.#balloons.set(balloon.id, { ...rendered, lastHp: balloon.hp })
      }
    }
  }

  #createBalloon(balloon: BalloonRallyBalloon): RenderedBalloon {
    const color = BALLOON_COLORS[(balloon.id - 1) % BALLOON_COLORS.length] ?? 0xff668f
    const string = this.add.line(0, balloon.radius + 18, 0, 0, 0, 64, 0xffffff, 0.78).setLineWidth(4)
    const knot = this.add.triangle(0, balloon.radius - 4, -13, 12, 13, 12, 0, -10, color)
    const body = this.add
      .ellipse(0, 0, balloon.radius * 1.56, balloon.radius * 1.95, color)
      .setStrokeStyle(8, 0xffffff, 0.92)
    const shine = this.add.ellipse(-balloon.radius * 0.32, -balloon.radius * 0.42, 22, 50, 0xffffff, 0.62)
    const hp = this.add
      .text(0, 8, '●●●', {
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        stroke: '#10284b',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
    const container = this.add.container(balloon.x, balloon.y, [string, knot, body, shine, hp])
    const rendered = { container, body, hp, lastHp: balloon.hp }
    this.#balloons.set(balloon.id, rendered)
    this.tweens.add({ targets: container, scale: { from: 0.72, to: 1 }, duration: 170, ease: 'Back.Out' })
    return rendered
  }

  #pop(x: number, y: number): void {
    const ring = this.add.circle(x, y, 32, 0xffffff, 0).setStrokeStyle(10, 0xffef8a, 1)
    this.tweens.add({
      targets: ring,
      scale: 2.3,
      alpha: 0,
      duration: 250,
      onComplete: () => ring.destroy(),
    })
  }

  #clearBalloons(): void {
    for (const rendered of this.#balloons.values()) rendered.container.destroy()
    this.#balloons.clear()
  }
}
