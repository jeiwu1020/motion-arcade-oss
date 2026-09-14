import Phaser from 'phaser'

import {
  TENNIS_RULES,
  type TennisGameplayPhase,
  type TennisShot,
  type TennisState,
} from './TennisCore'
import type { TennisSession } from './TennisSession'

const WIDTH = 1280
const HEIGHT = 720
const PLAYER_Y = 585
const OPPONENT_Y = 170
const CONTACT_Y = 535
const CONTACT_X = 640

const PHASE_LABEL: Readonly<Record<TennisGameplayPhase, string>> = {
  WARM_UP: 'WARM-UP',
  RALLY: 'RALLY',
  PRESSURE: 'PRESSURE',
  MATCH_RUSH: 'MATCH RUSH',
}

const PHASE_COLOR: Readonly<Record<TennisGameplayPhase, number>> = {
  WARM_UP: 0x7fe7c4,
  RALLY: 0x75d9ff,
  PRESSURE: 0xffcf70,
  MATCH_RUSH: 0xff72b8,
}

/** Phaser is a read-only projection of Tennis Core; it never judges contact. */
export class TennisScene extends Phaser.Scene {
  readonly #session: TennisSession
  #world!: Phaser.GameObjects.Graphics
  #actors!: Phaser.GameObjects.Graphics
  #effects!: Phaser.GameObjects.Graphics
  #countdown!: Phaser.GameObjects.Text
  #phaseBanner!: Phaser.GameObjects.Text
  #feedback!: Phaser.GameObjects.Text
  #instruction!: Phaser.GameObjects.Text

  constructor(session: TennisSession) {
    super('tennis')
    this.#session = session
  }

  create(): void {
    this.#world = this.add.graphics().setDepth(0)
    this.#actors = this.add.graphics().setDepth(2)
    this.#effects = this.add.graphics().setDepth(4)
    this.#countdown = this.add.text(WIDTH / 2, HEIGHT / 2 - 20, '', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '190px',
      fontStyle: 'bold',
      stroke: '#08252e',
      strokeThickness: 18,
    }).setOrigin(0.5).setDepth(10)
    this.#phaseBanner = this.add.text(WIDTH / 2, 92, '', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '62px',
      fontStyle: 'bold',
      stroke: '#06282d',
      strokeThickness: 12,
    }).setOrigin(0.5).setDepth(9)
    this.#feedback = this.add.text(WIDTH / 2, 292, '', {
      color: '#fff5a8',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '82px',
      fontStyle: 'bold',
      stroke: '#092d31',
      strokeThickness: 13,
    }).setOrigin(0.5).setDepth(10)
    this.#instruction = this.add.text(WIDTH / 2, 676, '', {
      color: '#d9fff5',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '25px',
      fontStyle: 'bold',
      stroke: '#06282d',
      strokeThickness: 7,
    }).setOrigin(0.5).setDepth(8)
  }

  update(): void {
    const state = this.#session.getState()
    this.#drawCourt(state)
    this.#drawActors(state)
    this.#effects.clear()
    this.#drawBall(state)
    this.#drawEffects(state)
    this.#updateText(state)
  }

  #drawCourt(state: TennisState): void {
    const graphics = this.#world
    graphics.clear()
    const rush = state.tennisPhase === 'MATCH_RUSH'
    const pulse = rush ? 0.5 + 0.5 * Math.sin(state.elapsedMs / 115) : 0
    graphics.fillStyle(rush ? 0x331737 : 0x06282e, 1)
    graphics.fillRect(0, 0, WIDTH, HEIGHT)
    graphics.fillStyle(rush ? 0xff4d9a : 0x1b8077, 0.2 + pulse * 0.14)
    graphics.fillCircle(80, 90, 180 + pulse * 40)
    graphics.fillCircle(WIDTH - 80, 90, 180 + pulse * 40)

    graphics.fillStyle(rush ? 0x203e56 : 0x0a4b51, 1)
    graphics.fillTriangle(90, 150, WIDTH - 90, 150, WIDTH - 8, HEIGHT)
    graphics.fillTriangle(90, 150, WIDTH - 8, HEIGHT, 8, HEIGHT)
    graphics.fillStyle(rush ? 0x284e62 : 0x12646a, 1)
    graphics.fillTriangle(170, 205, WIDTH - 170, 205, WIDTH - 105, HEIGHT - 16)
    graphics.fillTriangle(170, 205, WIDTH - 105, HEIGHT - 16, 105, HEIGHT - 16)

    graphics.lineStyle(rush ? 7 : 5, 0xe8fff7, 0.9)
    graphics.lineBetween(90, 150, WIDTH - 90, 150)
    graphics.lineBetween(8, HEIGHT, 90, 150)
    graphics.lineBetween(WIDTH - 8, HEIGHT, WIDTH - 90, 150)
    graphics.lineBetween(8, HEIGHT, WIDTH - 8, HEIGHT)
    graphics.lineBetween(170, 205, WIDTH - 170, 205)
    graphics.lineBetween(105, HEIGHT - 16, WIDTH - 105, HEIGHT - 16)
    graphics.lineBetween(170, 205, 105, HEIGHT - 16)
    graphics.lineBetween(WIDTH - 170, 205, WIDTH - 105, HEIGHT - 16)
    graphics.lineStyle(3, 0xe8fff7, 0.55)
    graphics.lineBetween(WIDTH / 2, 150, WIDTH / 2, 205)
    graphics.lineBetween(WIDTH / 2, HEIGHT - 16, WIDTH / 2, HEIGHT)

    graphics.fillStyle(0x071e25, 0.85)
    graphics.fillRoundedRect(42, 232, 232, 65, 18)
    graphics.fillRoundedRect(WIDTH - 274, 232, 232, 65, 18)
    graphics.lineStyle(3, PHASE_COLOR[state.tennisPhase], 0.7)
    graphics.strokeRoundedRect(42, 232, 232, 65, 18)
    graphics.strokeRoundedRect(WIDTH - 274, 232, 232, 65, 18)

    graphics.fillStyle(PHASE_COLOR[state.tennisPhase], 0.16 + pulse * 0.16)
    graphics.fillRoundedRect(310, 318, 660, 292, 32)
    graphics.lineStyle(rush ? 6 : 4, PHASE_COLOR[state.tennisPhase], 0.5)
    graphics.strokeRoundedRect(310, 318, 660, 292, 32)
  }

  #drawActors(state: TennisState): void {
    const graphics = this.#actors
    graphics.clear()
    const rush = state.tennisPhase === 'MATCH_RUSH'
    this.#drawAvatar(graphics, WIDTH / 2, OPPONENT_Y, 0x8ed9ff, false, 0.88)
    this.#drawAvatar(graphics, WIDTH / 2, PLAYER_Y, rush ? 0xffc16e : 0x7fe7c4, true, 1)

    graphics.fillStyle(0x020f14, 0.5)
    graphics.fillEllipse(WIDTH / 2, CONTACT_Y + 20, 160, 28)
    graphics.lineStyle(5, 0xffffff, 0.25)
    graphics.strokeEllipse(CONTACT_X, CONTACT_Y, 120, 42)
  }

  #drawAvatar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    color: number,
    player: boolean,
    scale: number,
  ): void {
    graphics.fillStyle(0x071c25, 0.85)
    graphics.fillCircle(x, y - 70 * scale, 30 * scale)
    graphics.fillStyle(color, 0.92)
    graphics.fillRoundedRect(x - 48 * scale, y - 42 * scale, 96 * scale, 92 * scale, 28 * scale)
    graphics.lineStyle(10 * scale, color, 0.9)
    graphics.lineBetween(x - 36 * scale, y - 20 * scale, x - 88 * scale, y + 18 * scale)
    graphics.lineBetween(x + 36 * scale, y - 20 * scale, x + 88 * scale, y + 18 * scale)
    graphics.lineStyle(12 * scale, color, 0.9)
    graphics.lineBetween(x - 26 * scale, y + 42 * scale, x - 42 * scale, y + 88 * scale)
    graphics.lineBetween(x + 26 * scale, y + 42 * scale, x + 42 * scale, y + 88 * scale)
    if (player) {
      graphics.lineStyle(4, 0xf8fff9, 0.5)
      graphics.strokeCircle(x, y - 70 * scale, 35 * scale)
    }
  }

  #drawBall(state: TennisState): void {
    const graphics = this.#effects
    const shot = state.shots.find((candidate) => candidate.resolution === 'PENDING')
    if (!shot) return
    const timeUntil = shot.targetTimeMs - state.elapsedMs
    if (timeUntil > TENNIS_RULES.visualLeadMs || timeUntil < -TENNIS_RULES.goodWindowMs) return
    const progress = Phaser.Math.Clamp(1 - timeUntil / TENNIS_RULES.visualLeadMs, 0, 1)
    const side = shot.incomingSide === 'LEFT' ? -1 : 1
    const startX = CONTACT_X + side * 250
    const x = Phaser.Math.Linear(startX, CONTACT_X, progress)
    const y = Phaser.Math.Linear(OPPONENT_Y + 45, CONTACT_Y, progress) - Math.sin(progress * Math.PI) * (shot.type === 'LOB' ? 120 : shot.type === 'FAST' ? 28 : 65)
    this.#drawTennisBall(graphics, x, y, 24 + progress * 9, shot.type === 'FAST' ? 0xffd268 : 0xf7fff2)
    graphics.fillStyle(0x031216, 0.35)
    graphics.fillEllipse(x, CONTACT_Y + 12, 62 * progress + 16, 14)
  }

  #drawEffects(state: TennisState): void {
    const graphics = this.#effects
    const result = state.lastResult
    if (!result || result.attemptAtMs === null) return
    const age = state.elapsedMs - result.attemptAtMs
    if (age < -40 || age > 1_250) return
    if (result.resolution === 'MISS') {
      graphics.fillStyle(0xff896d, 0.6)
      graphics.fillCircle(CONTACT_X, CONTACT_Y, 30 + Math.min(1, age / 350) * 28)
      return
    }
    const returnProgress = Phaser.Math.Clamp(age / 1_050, 0, 1)
    const direction = result.returnDirection ?? 'CENTER'
    const side = direction === 'LEFT' ? -1 : direction === 'RIGHT' ? 1 : 0
    const x = Phaser.Math.Linear(CONTACT_X, CONTACT_X + side * 310, returnProgress)
    const y = Phaser.Math.Linear(CONTACT_Y, OPPONENT_Y + 45, returnProgress) - Math.sin(returnProgress * Math.PI) * (90 + Math.abs(result.returnArc ?? 0) * 90)
    const trailColor = result.resolution === 'PERFECT' ? 0xfff28c : result.resolution === 'GREAT' ? 0x8ff8ff : 0xb3ffca
    graphics.lineStyle(state.tennisPhase === 'MATCH_RUSH' ? 13 : 8, trailColor, 0.55)
    graphics.lineBetween(CONTACT_X, CONTACT_Y, x, y)
    graphics.fillStyle(trailColor, 0.24)
    graphics.fillCircle(CONTACT_X, CONTACT_Y, 52 + Math.min(1, age / 260) * 30)
    this.#drawTennisBall(graphics, x, y, 30, trailColor)

    const swingSide = result.hand === 'LEFT' ? -1 : 1
    if (age < 540) {
      graphics.lineStyle(11, trailColor, 0.85)
      graphics.arc(CONTACT_X + swingSide * 64, PLAYER_Y - 30, 85, swingSide < 0 ? 3.55 : 5.9, swingSide < 0 ? 5.9 : 8.2, false)
      graphics.fillStyle(0xffffff, 0.7)
      graphics.fillCircle(CONTACT_X, CONTACT_Y, 18 + age / 18)
    }
  }

  #drawTennisBall(graphics: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number): void {
    graphics.fillStyle(0x04151a, 0.5)
    graphics.fillCircle(x + 5, y + 7, radius + 3)
    graphics.fillStyle(color, 1)
    graphics.fillCircle(x, y, radius)
    graphics.lineStyle(Math.max(2, radius / 9), 0x3f7d59, 0.85)
    graphics.arc(x - 4, y, radius * 0.72, 5.1, 1.25, false)
    graphics.arc(x + 5, y, radius * 0.7, 2, 4.45, false)
  }

  #updateText(state: TennisState): void {
    if (state.phase === 'COUNTDOWN') {
      this.#countdown.setText(String(Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000)))).setVisible(true)
      this.#phaseBanner.setVisible(false)
      this.#feedback.setVisible(false)
      this.#instruction.setText('看準來球，左右手都可以揮拍！').setVisible(true)
      return
    }
    this.#countdown.setVisible(false)
    if (state.phase === 'FINISHED') {
      this.#phaseBanner.setText('MATCH COMPLETE').setColor('#fff28c').setVisible(true)
      this.#feedback.setVisible(false)
      this.#instruction.setText('精彩回球！').setVisible(true)
      return
    }
    const color = Phaser.Display.Color.IntegerToColor(PHASE_COLOR[state.tennisPhase]).rgba
    this.#phaseBanner.setText(PHASE_LABEL[state.tennisPhase]).setColor(color).setVisible(true)
    const result = state.lastResult
    const age = result?.attemptAtMs === null || result?.attemptAtMs === undefined
      ? Number.POSITIVE_INFINITY
      : state.elapsedMs - result.attemptAtMs
    if (result && age >= 0 && age < 850) {
      const label = result.resolution === 'MISS' ? 'MISS' : `${result.resolution}  +${result.scoreAward}`
      this.#feedback.setText(label).setColor(result.resolution === 'MISS' ? '#ffd0b9' : '#fff5a8').setVisible(true)
    } else {
      this.#feedback.setVisible(false)
    }
    const nextShot = state.shots.find((shot) => shot.resolution === 'PENDING')
    this.#instruction.setText(nextShot ? this.#shotInstruction(nextShot) : '準備下一球！').setVisible(true)
  }

  #shotInstruction(shot: TennisShot): string {
    if (shot.type === 'FAST') return 'FAST 來球！準備快速回球'
    if (shot.type === 'LOB') return 'LOB 高飛球！看清弧線'
    return '來球！抓準接觸區揮拍'
  }
}
