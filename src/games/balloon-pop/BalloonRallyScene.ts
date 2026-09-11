import Phaser from 'phaser'

import type { BalloonRallyBalloon, BalloonRallyState } from './BalloonRallyCore'
import type { BalloonRallySession } from './BalloonRallySession'
import {
  BALLOON_RALLY_HAND_GLOW_CONFIG,
  getComboMilestoneCrossed,
  updateBalloonRallyHandGlowTrail,
  type BalloonRallyHandGlowTrailState,
} from './BalloonRallyPresentation'

const WORLD_WIDTH = 1280
const WORLD_HEIGHT = 720
const BALLOON_COLORS = [0xff668f, 0x56c7ff, 0xffc857, 0x8ce6a7] as const

interface RenderedBalloon {
  readonly container: Phaser.GameObjects.Container
  readonly body: Phaser.GameObjects.Ellipse
  readonly hp: Phaser.GameObjects.Text
  readonly kind: BalloonRallyBalloon['kind']
  readonly lastHp: number
}

/** Phaser presentation only. Core/session own rules, contact, and physics. */
export class BalloonRallyScene extends Phaser.Scene {
  readonly #session: BalloonRallySession
  readonly #balloons = new Map<number, RenderedBalloon>()
  #countdownText!: Phaser.GameObjects.Text
  #statusText!: Phaser.GameObjects.Text
  #partyRushText!: Phaser.GameObjects.Text
  #announcementText!: Phaser.GameObjects.Text
  #partyEdgePulse!: Phaser.GameObjects.Rectangle
  #handGlow!: Phaser.GameObjects.Graphics
  #handGlowState: BalloonRallyHandGlowTrailState = {
    left: { anchor: null, points: [] },
    right: { anchor: null, points: [] },
  }
  #partyRushSeen = false
  #lastCombo = 0
  #lastMiniEventSequence = 0
  #giantCueSeen = false

  constructor(session: BalloonRallySession) {
    super('balloon-rally')
    this.#session = session
  }

  create(): void {
    this.#handGlow = this.add.graphics().setDepth(4)
    this.#partyEdgePulse = this.add
      .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0xffd85c, 0)
      .setStrokeStyle(28, 0xffef8a, 0)
      .setDepth(20)
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
      .setDepth(21)
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
      .setDepth(21)
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
      .setDepth(22)
      .setVisible(false)
    this.#announcementText = this.add
      .text(WORLD_WIDTH / 2, 160, '', {
        color: '#fff4ab',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '68px',
        fontStyle: 'bold',
        stroke: '#40285e',
        strokeThickness: 13,
      })
      .setOrigin(0.5)
      .setDepth(23)
      .setVisible(false)
  }

  update(time = 0): void {
    const state = this.#session.getState()
    if (!state.partyRush) this.#partyRushSeen = false
    if (state.phase === 'COUNTDOWN') {
      this.#clearBalloons()
      this.#clearHandGlow()
      this.#lastCombo = 0
      this.#giantCueSeen = false
      this.#countdownText
        .setText(String(Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000))))
        .setVisible(true)
      this.#statusText.setText('雙手準備好，拍破氣球！').setVisible(true)
      return
    }

    this.#countdownText.setVisible(false)
    if (state.phase === 'FINISHED') {
      this.#clearBalloons()
      this.#clearHandGlow()
      this.#statusText.setText('時間到！').setVisible(true)
      return
    }

    this.#reconcileBalloons(state)
    this.#renderHandGlow(time)
    this.#showGameplayCues(state)
    this.#statusText
      .setText(state.partyRush ? 'PARTY RUSH！一拍爆氣球！' : '雙手拍氣球！')
      .setVisible(true)
    if (state.partyRush && !this.#partyRushSeen) this.#showPartyRushCue()
  }

  #showGameplayCues(state: BalloonRallyState): void {
    if (state.miniEventSequence < this.#lastMiniEventSequence) this.#lastMiniEventSequence = 0
    const milestone = getComboMilestoneCrossed(this.#lastCombo, state.combo)
    if (milestone) this.#showAnnouncement(milestone.label, milestone.value >= 10 ? '#ffec70' : '#ffffff', milestone.value >= 10 ? 82 : 70)
    this.#lastCombo = state.combo

    if (state.miniEventSequence > this.#lastMiniEventSequence) {
      const eventLabel = state.miniEventKind === 'GOLD_RUSH'
        ? 'GOLD RUSH!'
        : state.miniEventKind === 'BALLOON_RAIN'
          ? 'BALLOON RAIN!'
          : 'SCORE FEVER!'
      const eventColor = state.miniEventKind === 'GOLD_RUSH'
        ? 0xffd45c
        : state.miniEventKind === 'BALLOON_RAIN'
          ? 0x62e6d4
          : 0xbd92ff
      this.#showAnnouncement(eventLabel, '#ffe978', 76, eventColor)
      this.#lastMiniEventSequence = state.miniEventSequence
    }
    if (state.giantSpawned && !this.#giantCueSeen) {
      this.#showAnnouncement('GIANT BALLOON!', '#ffd75f', 76, 0xd9a8ff)
      this.#giantCueSeen = true
    }
  }

  #showAnnouncement(text: string, color: string, fontSize: number, pulseColor = 0xffec70): void {
    this.tweens.killTweensOf(this.#announcementText)
    this.#announcementText
      .setText(text)
      .setColor(color)
      .setFontSize(fontSize)
      .setAlpha(1)
      .setScale(0.72)
      .setVisible(true)
    this.#partyEdgePulse
      .setAlpha(0.72)
      .setFillStyle(pulseColor, 0.08)
      .setStrokeStyle(16, pulseColor, 0.72)
    this.tweens.add({
      targets: this.#partyEdgePulse,
      alpha: 0,
      duration: 520,
      ease: 'Sine.Out',
      onComplete: () => this.#partyEdgePulse.setFillStyle(0xffca5f, 0).setStrokeStyle(28, 0xffef8a, 0),
    })
    this.tweens.add({
      targets: this.#announcementText,
      scale: 1,
      alpha: 0,
      duration: 1_050,
      ease: 'Back.Out',
      onComplete: () => this.#announcementText.setVisible(false),
    })
  }

  #renderHandGlow(time: number): void {
    this.#handGlowState = updateBalloonRallyHandGlowTrail(
      this.#handGlowState,
      this.#session.getHandVisualSnapshot(),
      time,
    )
    this.#handGlow.clear()
    this.#drawHandGlowTrack(this.#handGlowState.left, 0x4de9ff, time)
    this.#drawHandGlowTrack(this.#handGlowState.right, 0xffb347, time)
  }

  #drawHandGlowTrack(
    track: BalloonRallyHandGlowTrailState['left'],
    color: number,
    time: number,
  ): void {
    for (const point of track.points) {
      const age = Math.max(0, time - point.createdAtMs)
      const alpha = Math.max(0, 1 - age / BALLOON_RALLY_HAND_GLOW_CONFIG.trailLifetimeMs)
      this.#handGlow.fillStyle(color, alpha * 0.2)
      this.#handGlow.fillCircle(point.x, point.y, 22)
    }
    if (!track.anchor) return
    this.#handGlow.fillStyle(color, 0.16)
    this.#handGlow.fillCircle(track.anchor.x, track.anchor.y, 48)
    this.#handGlow.fillStyle(color, 0.38)
    this.#handGlow.fillCircle(track.anchor.x, track.anchor.y, 32)
    this.#handGlow.fillStyle(0xffffff, 0.92)
    this.#handGlow.fillCircle(track.anchor.x, track.anchor.y, 15)
  }

  #clearHandGlow(): void {
    this.#handGlowState = { left: { anchor: null, points: [] }, right: { anchor: null, points: [] } }
    if (this.#handGlow) this.#handGlow.clear()
  }

  #showPartyRushCue(): void {
    this.#partyRushSeen = true
    this.#partyRushText.setAlpha(1).setScale(0.72).setVisible(true)
    this.#partyEdgePulse
      .setAlpha(1)
      .setFillStyle(0xffca5f, 0.22)
      .setStrokeStyle(28, 0xffef8a, 0.96)
    this.tweens.add({
      targets: this.#partyRushText,
      scale: 1,
      alpha: 0,
      duration: 1_350,
      ease: 'Back.Out',
      onComplete: () => this.#partyRushText.setVisible(false),
    })
    this.tweens.add({
      targets: this.#partyEdgePulse,
      alpha: 0,
      duration: 650,
      ease: 'Sine.Out',
      onComplete: () => this.#partyEdgePulse.setFillStyle(0xffca5f, 0).setStrokeStyle(28, 0xffef8a, 0),
    })
  }

  #reconcileBalloons(state: BalloonRallyState): void {
    const expectedIds = new Set(state.balloons.map((balloon) => balloon.id))
    for (const [id, rendered] of this.#balloons) {
      if (!expectedIds.has(id)) {
        this.#pop(rendered.container.x, rendered.container.y, rendered.kind)
        rendered.container.destroy()
        this.#balloons.delete(id)
      }
    }
    for (const balloon of state.balloons) {
      let rendered = this.#balloons.get(balloon.id)
      if (!rendered || rendered.kind !== balloon.kind) {
        if (rendered) rendered.container.destroy()
        rendered = this.#createBalloon(balloon)
      }
      rendered.container.setPosition(balloon.x, balloon.y).setVisible(true)
      rendered.hp.setText('●'.repeat(balloon.hp) + '○'.repeat(balloon.maxHp - balloon.hp))
      if (balloon.hp < rendered.lastHp) {
        this.#impact(balloon.x, balloon.y, balloon.kind)
        this.tweens.killTweensOf(rendered.container)
        rendered.container.setScale(1.18, 0.78)
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
    const party = balloon.kind === 'PARTY'
    const golden = balloon.kind === 'GOLDEN'
    const giant = balloon.kind === 'GIANT'
    const bonus = balloon.kind === 'BONUS'
    const bodyColor = golden ? 0xffc928 : giant ? 0xb779ff : bonus ? 0x62e6d4 : color
    const outline = golden ? 0xfff1a0 : giant ? 0xf0d6ff : bonus ? 0xb6fff3 : party ? 0xffec70 : 0xffffff
    const string = this.add.line(0, balloon.radius + 18, 0, 0, 0, 64, outline, 0.78).setLineWidth(4)
    const knot = this.add.triangle(0, balloon.radius - 4, -13, 12, 13, 12, 0, -10, bodyColor)
    const body = this.add
      .ellipse(0, 0, balloon.radius * 1.56, balloon.radius * 1.95, bodyColor)
      .setStrokeStyle(giant || golden || party ? 12 : 8, outline, giant || golden || party ? 1 : 0.92)
    const shine = this.add.ellipse(-balloon.radius * 0.32, -balloon.radius * 0.42, giant ? 30 : 22, giant ? 64 : 50, 0xffffff, golden || giant || party ? 0.86 : 0.62)
    const hp = this.add
      .text(0, 8, '●'.repeat(balloon.hp), {
        color: golden || giant || party ? '#fff4ab' : '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: giant ? '34px' : party ? '28px' : '24px',
        fontStyle: 'bold',
        stroke: '#10284b',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
    const container = this.add.container(balloon.x, balloon.y, [string, knot, body, shine, hp])
    const rendered = { container, body, hp, kind: balloon.kind, lastHp: balloon.hp }
    this.#balloons.set(balloon.id, rendered)
    this.tweens.add({ targets: container, scale: { from: 0.72, to: 1 }, duration: 170, ease: 'Back.Out' })
    return rendered
  }

  #impact(x: number, y: number, kind: BalloonRallyBalloon['kind']): void {
    const strong = kind === 'PARTY' || kind === 'GOLDEN' || kind === 'GIANT'
    const ring = this.add.circle(x, y, kind === 'GIANT' ? 34 : 24, 0xffffff, 0).setStrokeStyle(strong ? 12 : 9, kind === 'GOLDEN' ? 0xffec70 : kind === 'GIANT' ? 0xd9a8ff : strong ? 0xffec70 : 0xffffff, 1)
    this.tweens.add({
      targets: ring,
      scale: kind === 'GIANT' ? 2.8 : strong ? 2.5 : 1.85,
      alpha: 0,
      duration: strong ? 220 : 170,
      onComplete: () => ring.destroy(),
    })
  }

  #pop(x: number, y: number, kind: BalloonRallyBalloon['kind']): void {
    const strong = kind === 'PARTY' || kind === 'GOLDEN' || kind === 'GIANT'
    const radius = kind === 'GIANT' ? 55 : strong ? 38 : 32
    const color = kind === 'GOLDEN' ? 0xffd85c : kind === 'GIANT' ? 0xd9a8ff : strong ? 0xffd85c : 0xffef8a
    const ring = this.add.circle(x, y, radius, 0xffffff, 0)
      .setStrokeStyle(kind === 'GIANT' ? 18 : strong ? 14 : 10, color, 1)
    this.tweens.add({
      targets: ring,
      scale: kind === 'GIANT' ? 3.4 : strong ? 3 : 2.3,
      alpha: 0,
      duration: kind === 'GIANT' ? 380 : strong ? 300 : 250,
      onComplete: () => ring.destroy(),
    })
  }

  #clearBalloons(): void {
    for (const rendered of this.#balloons.values()) rendered.container.destroy()
    this.#balloons.clear()
  }
}
