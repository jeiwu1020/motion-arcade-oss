import Phaser from 'phaser'

import {
  BOWLING_PIN_POSITIONS,
  BOWLING_RULES,
  type BowlingPhase,
  type BowlingState,
} from './BowlingCore'
import type { BowlingSession } from './BowlingSession'

const WIDTH = 1280
const HEIGHT = 720
const LANE_TOP_Y = 172
const LANE_BOTTOM_Y = 688
const PIN_Y = 218
const PIN_SCALE = 1.08

const PHASE_LABEL: Readonly<Record<BowlingPhase, string>> = {
  COUNTDOWN: 'GET READY',
  AIMING: 'AIM & ROLL',
  BALL_ROLLING: 'BALL ROLLING',
  PINS_SETTLING: 'PINS SETTLING',
  FRAME_TRANSITION: 'NEXT FRAME',
  FINISHED: 'MATCH COMPLETE',
}

const PIN_LAYOUT: Readonly<Record<number, readonly [number, number]>> = {
  1: [0, 0],
  2: [-0.16, 1],
  3: [0.16, 1],
  4: [-0.32, 2],
  5: [0, 2],
  6: [0.32, 2],
  7: [-0.48, 3],
  8: [-0.16, 3],
  9: [0.16, 3],
  10: [0.48, 3],
}

/** Phaser is a read-only projection of Bowling Core and never scores pins. */
export class BowlingScene extends Phaser.Scene {
  readonly #session: BowlingSession
  #world!: Phaser.GameObjects.Graphics
  #actors!: Phaser.GameObjects.Graphics
  #effects!: Phaser.GameObjects.Graphics
  #countdown!: Phaser.GameObjects.Text
  #phaseBanner!: Phaser.GameObjects.Text
  #feedback!: Phaser.GameObjects.Text
  #instruction!: Phaser.GameObjects.Text

  constructor(session: BowlingSession) {
    super('bowling')
    this.#session = session
  }

  create(): void {
    this.#world = this.add.graphics().setDepth(0)
    this.#actors = this.add.graphics().setDepth(2)
    this.#effects = this.add.graphics().setDepth(5)
    this.#countdown = this.add.text(WIDTH / 2, HEIGHT / 2 - 20, '', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '190px',
      fontStyle: 'bold',
      stroke: '#321b1d',
      strokeThickness: 18,
    }).setOrigin(0.5).setDepth(10)
    this.#phaseBanner = this.add.text(WIDTH / 2, 76, '', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '56px',
      fontStyle: 'bold',
      stroke: '#321b1d',
      strokeThickness: 12,
    }).setOrigin(0.5).setDepth(9)
    this.#feedback = this.add.text(WIDTH / 2, 318, '', {
      color: '#fff1a3',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '82px',
      fontStyle: 'bold',
      stroke: '#321b1d',
      strokeThickness: 13,
    }).setOrigin(0.5).setDepth(10)
    this.#instruction = this.add.text(WIDTH / 2, 680, '', {
      color: '#fff8e7',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      stroke: '#321b1d',
      strokeThickness: 7,
    }).setOrigin(0.5).setDepth(8)
  }

  update(): void {
    const state = this.#session.getState()
    this.#drawLane(state)
    this.#drawActors(state)
    this.#effects.clear()
    this.#drawAimAndArrow(state)
    this.#drawBall(state)
    this.#drawImpact(state)
    this.#updateText(state)
  }

  #drawLane(state: BowlingState): void {
    const graphics = this.#world
    graphics.clear()
    const settling = state.phase === 'PINS_SETTLING' || state.phase === 'FRAME_TRANSITION'
    const pulse = settling ? 0.5 + 0.5 * Math.sin(state.phaseElapsedMs / 70) : 0
    graphics.fillStyle(0x1a0e22, 1)
    graphics.fillRect(0, 0, WIDTH, HEIGHT)
    graphics.fillStyle(0xf39a4b, 0.12)
    graphics.fillCircle(1120, 80, 240 + pulse * 30)
    graphics.fillStyle(0x6f3142, 0.32)
    graphics.fillCircle(120, 100, 220)

    graphics.fillStyle(0x8d4f35, 1)
    graphics.fillTriangle(155, LANE_BOTTOM_Y, 1125, LANE_BOTTOM_Y, 770, LANE_TOP_Y)
    graphics.fillTriangle(155, LANE_BOTTOM_Y, 770, LANE_TOP_Y, 510, LANE_TOP_Y)
    graphics.fillStyle(0xb97045, 0.92)
    graphics.fillTriangle(205, LANE_BOTTOM_Y - 22, 1075, LANE_BOTTOM_Y - 22, 762, LANE_TOP_Y + 18)
    graphics.fillTriangle(205, LANE_BOTTOM_Y - 22, 762, LANE_TOP_Y + 18, 518, LANE_TOP_Y + 18)
    graphics.fillStyle(0x593044, 0.7)
    graphics.fillTriangle(0, 185, 510, LANE_TOP_Y, 155, LANE_BOTTOM_Y)
    graphics.fillTriangle(WIDTH, 185, 1125, LANE_BOTTOM_Y, 770, LANE_TOP_Y)

    graphics.lineStyle(6, 0xffe7bc, 0.92)
    graphics.lineBetween(155, LANE_BOTTOM_Y, 510, LANE_TOP_Y)
    graphics.lineBetween(1125, LANE_BOTTOM_Y, 770, LANE_TOP_Y)
    graphics.lineBetween(155, LANE_BOTTOM_Y, 1125, LANE_BOTTOM_Y)
    graphics.lineStyle(3, 0xffdca7, 0.42)
    for (let x = 280; x <= 1000; x += 120) graphics.lineBetween(x, LANE_BOTTOM_Y - 12, 640 + (x - 640) * 0.13, LANE_TOP_Y + 30)
    graphics.lineStyle(4, 0xfff2bd, 0.55)
    for (let y = 300; y <= 610; y += 72) {
      const progress = (y - LANE_TOP_Y) / (LANE_BOTTOM_Y - LANE_TOP_Y)
      const left = Phaser.Math.Linear(510, 155, progress)
      const right = Phaser.Math.Linear(770, 1125, progress)
      graphics.lineBetween(left + 20, y, right - 20, y)
    }

    graphics.fillStyle(0x29152b, 0.88)
    graphics.fillRoundedRect(28, 138, 250, 72, 18)
    graphics.fillRoundedRect(WIDTH - 278, 138, 250, 72, 18)
    graphics.lineStyle(3, 0xffbd62, 0.7)
    graphics.strokeRoundedRect(28, 138, 250, 72, 18)
    graphics.strokeRoundedRect(WIDTH - 278, 138, 250, 72, 18)
    graphics.fillStyle(0x321c31, 0.92)
    graphics.fillRoundedRect(390, 118, 500, 78, 24)
    graphics.lineStyle(4, 0xffd674, 0.6)
    graphics.strokeRoundedRect(390, 118, 500, 78, 24)
    graphics.fillStyle(0x2a1428, 0.82)
    graphics.fillRoundedRect(425, 570, 430, 84, 28)
    graphics.lineStyle(3, 0xffb95c, 0.45)
    graphics.strokeRoundedRect(425, 570, 430, 84, 28)
  }

  #drawActors(state: BowlingState): void {
    const graphics = this.#actors
    graphics.clear()
    this.#drawAvatar(graphics, WIDTH / 2, 615, 0xffc96f, true)
    this.#drawAvatar(graphics, WIDTH / 2, 214, 0x9ed4ff, false)
    graphics.fillStyle(0x160e20, 0.46)
    graphics.fillEllipse(WIDTH / 2, 674, 280, 34)

    for (const pin of BOWLING_PIN_POSITIONS) {
      if (!state.standingPinIds.includes(pin.id)) continue
      const [xOffset, row] = PIN_LAYOUT[pin.id]!
      const x = WIDTH / 2 + xOffset * 330 - row * 1
      const y = PIN_Y + row * 32
      this.#drawPin(graphics, x, y, PIN_SCALE)
    }
  }

  #drawAvatar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    color: number,
    player: boolean,
  ): void {
    graphics.fillStyle(0x160d21, 0.9)
    graphics.fillCircle(x, y - 82, player ? 32 : 25)
    graphics.fillStyle(color, 0.95)
    graphics.fillRoundedRect(x - (player ? 54 : 42), y - 52, player ? 108 : 84, player ? 100 : 78, 28)
    graphics.lineStyle(player ? 13 : 10, color, 0.9)
    graphics.lineBetween(x - 38, y - 24, x - (player ? 98 : 78), y + 18)
    graphics.lineBetween(x + 38, y - 24, x + (player ? 98 : 78), y + 18)
    graphics.lineStyle(player ? 14 : 11, color, 0.9)
    graphics.lineBetween(x - 28, y + 42, x - 46, y + 92)
    graphics.lineBetween(x + 28, y + 42, x + 46, y + 92)
    if (player) {
      graphics.lineStyle(4, 0xffffff, 0.56)
      graphics.strokeCircle(x, y - 82, 38)
    }
  }

  #drawPin(graphics: Phaser.GameObjects.Graphics, x: number, y: number, scale: number): void {
    graphics.fillStyle(0x231024, 0.4)
    graphics.fillEllipse(x + 6, y + 20, 46 * scale, 14 * scale)
    graphics.fillStyle(0xfff9ef, 1)
    graphics.fillRoundedRect(x - 13 * scale, y - 25 * scale, 26 * scale, 48 * scale, 12 * scale)
    graphics.fillCircle(x, y - 29 * scale, 13 * scale)
    graphics.fillStyle(0xe94552, 1)
    graphics.fillRect(x - 12 * scale, y - 20 * scale, 24 * scale, 5 * scale)
    graphics.fillStyle(0xffd6d0, 0.85)
    graphics.fillRect(x - 11 * scale, y - 10 * scale, 22 * scale, 4 * scale)
  }

  #drawAimAndArrow(state: BowlingState): void {
    if (state.phase !== 'AIMING') return
    const graphics = this.#effects
    const markerX = WIDTH / 2 + state.aimValue * 330
    const targetX = WIDTH / 2 + state.aimValue * 210
    graphics.lineStyle(7, 0xffe27b, 0.32)
    graphics.lineBetween(markerX, 560, markerX, 642)
    graphics.fillStyle(0xfff2a1, 0.9)
    graphics.fillTriangle(markerX, 542, markerX - 22, 570, markerX + 22, 570)
    graphics.lineStyle(8, 0xfff2a1, 0.72)
    graphics.lineBetween(WIDTH / 2, 565, targetX, 565)
    graphics.fillStyle(0xfff2a1, 0.9)
    graphics.fillTriangle(targetX + 32, 565, targetX, 546, targetX, 584)
    graphics.fillStyle(0x2b172c, 0.8)
    graphics.fillRoundedRect(markerX - 74, 492, 148, 40, 14)
    this.#drawAimLabel(graphics, markerX, 512)
  }

  #drawAimLabel(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    graphics.lineStyle(3, 0xffe27b, 0.8)
    graphics.strokeRoundedRect(x - 74, y - 20, 148, 40, 14)
  }

  #drawBall(state: BowlingState): void {
    if (state.phase !== 'BALL_ROLLING' || state.ballAimAtRelease === null) return
    const graphics = this.#effects
    const progress = Phaser.Math.Clamp(state.ballProgressMs / BOWLING_RULES.ballRollingMs, 0, 1)
    const startX = WIDTH / 2
    const endX = WIDTH / 2 + state.ballAimAtRelease * 260
    const curve = (state.ballCurveBias ?? 0) * 150
    const x = Phaser.Math.Linear(startX, endX, progress) + Math.sin(progress * Math.PI) * curve
    const y = Phaser.Math.Linear(628, 250, Math.pow(progress, 0.78)) - Math.sin(progress * Math.PI) * 28
    const radius = 27 - progress * 11 + (state.ballPower ?? 0.65) * 3
    for (let trail = 4; trail >= 1; trail -= 1) {
      const trailProgress = Math.max(0, progress - trail * 0.045)
      const trailX = Phaser.Math.Linear(startX, endX, trailProgress) + Math.sin(trailProgress * Math.PI) * curve
      const trailY = Phaser.Math.Linear(628, 250, Math.pow(trailProgress, 0.78)) - Math.sin(trailProgress * Math.PI) * 28
      graphics.lineStyle(8 - trail + (state.ballPower ?? 0.65) * 2, 0xffbc5d, 0.1 + (4 - trail) * 0.08)
      graphics.lineBetween(trailX, trailY, x, y)
    }
    graphics.fillStyle(0x1a0d1c, 0.4)
    graphics.fillEllipse(x + 9, y + 12, radius * 1.7, radius * 0.54)
    graphics.fillStyle(0xffa646, 1)
    graphics.fillCircle(x, y, radius)
    graphics.fillStyle(0xffefb3, 0.62)
    graphics.fillCircle(x - radius * 0.32, y - radius * 0.35, radius * 0.26)
  }

  #drawImpact(state: BowlingState): void {
    if (state.phase !== 'PINS_SETTLING' && state.phase !== 'FRAME_TRANSITION') return
    const graphics = this.#effects
    const progress = Phaser.Math.Clamp(state.phaseElapsedMs / BOWLING_RULES.pinsSettlingMs, 0, 1)
    const impactStrength = state.lastRoll?.power ?? 0.65
    const radius = 44 + progress * (110 + impactStrength * 28)
    graphics.lineStyle(12 + impactStrength * 4, 0xffd36c, 0.68 * (1 - progress))
    graphics.strokeCircle(WIDTH / 2, 258, radius)
    graphics.fillStyle(0xfff2a8, 0.16 * (1 - progress))
    graphics.fillCircle(WIDTH / 2, 258, radius * 0.74)
    for (const id of state.lastKnockedPinIds) {
      const [xOffset, row] = PIN_LAYOUT[id]!
      const x = WIDTH / 2 + xOffset * 330
      const y = PIN_Y + row * 32 + progress * 35
      graphics.lineStyle(8, 0xff9b54, 0.4 * (1 - progress))
      graphics.lineBetween(x, y, x + (id % 2 === 0 ? 42 : -42), y + 24)
    }
  }

  #updateText(state: BowlingState): void {
    if (state.phase === 'COUNTDOWN') {
      this.#countdown.setText(String(Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000)))).setVisible(true)
      this.#phaseBanner.setVisible(false)
      this.#feedback.setVisible(false)
      this.#instruction.setText('準備投球！看準自動瞄準標記').setVisible(true)
      return
    }
    this.#countdown.setVisible(false)
    this.#phaseBanner.setText(PHASE_LABEL[state.phase]).setColor(state.phase === 'FRAME_TRANSITION' ? '#ffdf7e' : '#fff5dd').setVisible(true)
    if (state.phase === 'FINISHED') {
      this.#feedback.setVisible(false)
      this.#instruction.setText('五框 Arcade Match 完成！').setVisible(true)
      return
    }
    const result = state.lastRoll
    const showResult = result && (state.phase === 'PINS_SETTLING' || state.phase === 'FRAME_TRANSITION')
    if (showResult) {
      const label = result.strike ? 'STRIKE!' : result.spare ? 'SPARE!' : `${result.pinsKnocked} PINS!`
      this.#feedback.setText(label).setColor(result.strike || result.spare ? '#fff09a' : '#ffe1b0').setVisible(true)
    } else {
      this.#feedback.setVisible(false)
    }
    this.#instruction.setText(state.phase === 'AIMING' ? '自動瞄準中 · 左右手揮臂投球' : '球瓶正在整理，準備下一球').setVisible(true)
  }
}
