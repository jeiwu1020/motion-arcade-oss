import Phaser from 'phaser'

import {
  BADMINTON_RULES,
  type BadmintonGameplayPhase,
  type BadmintonShuttle,
  type BadmintonState,
  type BadmintonTargetRegion,
} from './BadmintonCore'
import type { BadmintonSession } from './BadmintonSession'

const WIDTH = 1280
const HEIGHT = 720
const PLAYER_Y = 590
const OPPONENT_Y = 170
const NET_Y = 355

const PHASE_LABEL: Readonly<Record<BadmintonGameplayPhase, string>> = {
  WARM_UP: 'WARM-UP',
  RALLY: 'RALLY',
  SMASH_ZONE: 'SMASH ZONE',
  SHUTTLE_RUSH: 'SHUTTLE RUSH',
}

const PHASE_COLOR: Readonly<Record<BadmintonGameplayPhase, number>> = {
  WARM_UP: 0x78ecde,
  RALLY: 0x67c9ff,
  SMASH_ZONE: 0xffd066,
  SHUTTLE_RUSH: 0xff6aa9,
}

const TARGETS: Readonly<Record<BadmintonTargetRegion, readonly [number, number]>> = {
  HIGH_LEFT: [465, 410],
  HIGH_RIGHT: [815, 410],
  MID_LEFT: [520, 515],
  MID_RIGHT: [760, 515],
}

/** Phaser is a read-only projection of Badminton Core; it never judges contact. */
export class BadmintonScene extends Phaser.Scene {
  readonly #session: BadmintonSession
  #world!: Phaser.GameObjects.Graphics
  #actors!: Phaser.GameObjects.Graphics
  #effects!: Phaser.GameObjects.Graphics
  #countdown!: Phaser.GameObjects.Text
  #phaseBanner!: Phaser.GameObjects.Text
  #feedback!: Phaser.GameObjects.Text
  #instruction!: Phaser.GameObjects.Text

  constructor(session: BadmintonSession) {
    super('badminton')
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
      stroke: '#14224e',
      strokeThickness: 18,
    }).setOrigin(0.5).setDepth(10)
    this.#phaseBanner = this.add.text(WIDTH / 2, 92, '', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '62px',
      fontStyle: 'bold',
      stroke: '#111d46',
      strokeThickness: 12,
    }).setOrigin(0.5).setDepth(9)
    this.#feedback = this.add.text(WIDTH / 2, 285, '', {
      color: '#fff1a3',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '82px',
      fontStyle: 'bold',
      stroke: '#17204b',
      strokeThickness: 13,
    }).setOrigin(0.5).setDepth(10)
    this.#instruction = this.add.text(WIDTH / 2, 676, '', {
      color: '#ecfbff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '25px',
      fontStyle: 'bold',
      stroke: '#12204a',
      strokeThickness: 7,
    }).setOrigin(0.5).setDepth(8)
  }

  update(): void {
    const state = this.#session.getState()
    this.#drawCourt(state)
    this.#drawActors(state)
    this.#effects.clear()
    this.#drawIncomingShuttle(state)
    this.#drawReturnEffects(state)
    this.#updateText(state)
  }

  #drawCourt(state: BadmintonState): void {
    const graphics = this.#world
    graphics.clear()
    const rush = state.badmintonPhase === 'SHUTTLE_RUSH'
    const pulse = rush ? 0.5 + 0.5 * Math.sin(state.elapsedMs / 105) : 0
    const phaseColor = PHASE_COLOR[state.badmintonPhase]
    graphics.fillStyle(rush ? 0x30183e : 0x101d49, 1)
    graphics.fillRect(0, 0, WIDTH, HEIGHT)
    graphics.fillStyle(rush ? 0xff4c9a : 0x36d7c1, 0.12 + pulse * 0.16)
    graphics.fillCircle(110, 80, 200 + pulse * 42)
    graphics.fillStyle(rush ? 0x31667b : 0x1f6c88, 1)
    graphics.fillTriangle(72, 130, WIDTH - 72, 130, WIDTH - 2, HEIGHT)
    graphics.fillTriangle(72, 130, WIDTH - 2, HEIGHT, 2, HEIGHT)
    graphics.fillStyle(rush ? 0x3c7890 : 0x2c8b9b, 1)
    graphics.fillTriangle(164, 205, WIDTH - 164, 205, WIDTH - 112, HEIGHT - 18)
    graphics.fillTriangle(164, 205, WIDTH - 112, HEIGHT - 18, 112, HEIGHT - 18)

    graphics.lineStyle(rush ? 7 : 5, 0xf0ffff, 0.92)
    graphics.lineBetween(72, 130, WIDTH - 72, 130)
    graphics.lineBetween(2, HEIGHT, 72, 130)
    graphics.lineBetween(WIDTH - 2, HEIGHT, WIDTH - 72, 130)
    graphics.lineBetween(2, HEIGHT, WIDTH - 2, HEIGHT)
    graphics.lineBetween(164, 205, WIDTH - 164, 205)
    graphics.lineBetween(112, HEIGHT - 18, WIDTH - 112, HEIGHT - 18)
    graphics.lineBetween(164, 205, 112, HEIGHT - 18)
    graphics.lineBetween(WIDTH - 164, 205, WIDTH - 112, HEIGHT - 18)
    graphics.lineStyle(3, 0xf0ffff, 0.5)
    graphics.lineBetween(WIDTH / 2, 130, WIDTH / 2, 205)
    graphics.lineBetween(WIDTH / 2, HEIGHT - 18, WIDTH / 2, HEIGHT)

    graphics.fillStyle(0x081435, 0.9)
    graphics.fillRoundedRect(35, 226, 240, 68, 18)
    graphics.fillRoundedRect(WIDTH - 275, 226, 240, 68, 18)
    graphics.lineStyle(3, phaseColor, 0.72)
    graphics.strokeRoundedRect(35, 226, 240, 68, 18)
    graphics.strokeRoundedRect(WIDTH - 275, 226, 240, 68, 18)

    graphics.fillStyle(phaseColor, 0.17 + pulse * 0.18)
    graphics.fillRoundedRect(300, 310, 680, 310, 34)
    graphics.lineStyle(rush ? 7 : 4, phaseColor, 0.58)
    graphics.strokeRoundedRect(300, 310, 680, 310, 34)

    graphics.lineStyle(rush ? 10 : 7, 0xffffff, 0.82)
    graphics.lineBetween(125, NET_Y, WIDTH - 125, NET_Y)
    graphics.lineStyle(3, 0xcceeff, 0.42)
    for (let x = 145; x <= WIDTH - 145; x += 42) graphics.lineBetween(x, NET_Y - 22, x, NET_Y + 22)
    graphics.lineBetween(125, NET_Y - 22, WIDTH - 125, NET_Y - 22)
    graphics.lineBetween(125, NET_Y + 22, WIDTH - 125, NET_Y + 22)
  }

  #drawActors(state: BadmintonState): void {
    const graphics = this.#actors
    graphics.clear()
    const rush = state.badmintonPhase === 'SHUTTLE_RUSH'
    this.#drawAvatar(graphics, WIDTH / 2, OPPONENT_Y, 0xb7e7ff, false, 0.86)
    this.#drawAvatar(graphics, WIDTH / 2, PLAYER_Y, rush ? 0xffc267 : 0x76f0d1, true, 1)
    graphics.fillStyle(0x07102d, 0.5)
    graphics.fillEllipse(WIDTH / 2, PLAYER_Y + 42, 190, 32)

    const pending = state.shuttles.find((shuttle) => shuttle.resolution === 'PENDING')
    if (pending) {
      const [targetX, targetY] = TARGETS[pending.targetRegion]
      graphics.lineStyle(5, PHASE_COLOR[state.badmintonPhase], 0.46)
      graphics.strokeEllipse(targetX, targetY + 27, 150, 40)
      graphics.lineStyle(3, 0xffffff, 0.38)
      graphics.lineBetween(targetX - 48, targetY + 27, targetX + 48, targetY + 27)
      graphics.lineBetween(targetX, targetY + 10, targetX, targetY + 44)
    }
  }

  #drawAvatar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    color: number,
    player: boolean,
    scale: number,
  ): void {
    graphics.fillStyle(0x091334, 0.88)
    graphics.fillCircle(x, y - 70 * scale, 30 * scale)
    graphics.fillStyle(color, 0.94)
    graphics.fillRoundedRect(x - 48 * scale, y - 42 * scale, 96 * scale, 92 * scale, 28 * scale)
    graphics.lineStyle(10 * scale, color, 0.9)
    graphics.lineBetween(x - 36 * scale, y - 20 * scale, x - 88 * scale, y + 18 * scale)
    graphics.lineBetween(x + 36 * scale, y - 20 * scale, x + 88 * scale, y + 18 * scale)
    graphics.lineStyle(12 * scale, color, 0.9)
    graphics.lineBetween(x - 26 * scale, y + 42 * scale, x - 42 * scale, y + 88 * scale)
    graphics.lineBetween(x + 26 * scale, y + 42 * scale, x + 42 * scale, y + 88 * scale)
    if (player) {
      graphics.lineStyle(4, 0xffffff, 0.5)
      graphics.strokeCircle(x, y - 70 * scale, 35 * scale)
    }
  }

  #drawIncomingShuttle(state: BadmintonState): void {
    const graphics = this.#effects
    const shuttle = state.shuttles.find((candidate) => candidate.resolution === 'PENDING')
    if (!shuttle) return
    const visualLead = shuttle.family === 'CLEAR'
      ? BADMINTON_RULES.clearVisualLeadMs
      : BADMINTON_RULES.visualLeadMs
    const timeUntil = shuttle.targetTimeMs - state.elapsedMs
    if (timeUntil > visualLead || timeUntil < -BADMINTON_RULES.goodWindowMs) return
    const progress = Phaser.Math.Clamp(1 - timeUntil / visualLead, 0, 1)
    const [targetX, targetY] = TARGETS[shuttle.targetRegion]
    const startX = WIDTH / 2 + (targetX - WIDTH / 2) * 0.56
    const startY = OPPONENT_Y + 35
    const x = Phaser.Math.Linear(startX, targetX, progress)
    const arcHeight = shuttle.family === 'CLEAR' ? 180 : shuttle.family === 'DROP' ? 205 : 52
    let y = Phaser.Math.Linear(startY, targetY, progress) - Math.sin(progress * Math.PI) * arcHeight
    if (shuttle.family === 'DROP' && progress > 0.55) y += (progress - 0.55) * 150
    for (let trail = 3; trail >= 1; trail -= 1) {
      const trailProgress = Math.max(0, progress - trail * 0.045)
      const trailX = Phaser.Math.Linear(startX, targetX, trailProgress)
      const trailY = Phaser.Math.Linear(startY, targetY, trailProgress) - Math.sin(trailProgress * Math.PI) * arcHeight
      graphics.lineStyle(7 - trail, shuttle.family === 'DROP' ? 0xffd178 : 0xe6ffff, 0.12 + (3 - trail) * 0.08)
      graphics.lineBetween(trailX, trailY, x, y)
    }
    this.#drawShuttle(graphics, x, y, 25 + progress * 11, shuttle.family === 'DRIVE' ? 0xfff29a : 0xf4ffff)
    graphics.fillStyle(0x09112f, 0.28)
    graphics.fillEllipse(targetX, targetY + 32, 58 + progress * 30, 14)
  }

  #drawReturnEffects(state: BadmintonState): void {
    const graphics = this.#effects
    const result = state.lastResult
    if (!result) return
    const age = state.elapsedMs - result.resolvedAtMs
    if (age < -40 || age > 1_250) return
    const [startX, startY] = result.returnDirection === 'LEFT'
      ? [470, 515]
      : result.returnDirection === 'RIGHT' ? [810, 515] : [640, 515]
    if (result.resolution === 'MISS') {
      graphics.lineStyle(8, 0xffb183, 0.42)
      graphics.lineBetween(startX, startY, startX + 50, startY + 30)
      graphics.fillStyle(0xffb183, 0.48)
      graphics.fillCircle(startX, startY + 20, 24 + Math.min(1, age / 350) * 34)
      return
    }
    const returnProgress = Phaser.Math.Clamp(age / (result.smash ? 820 : 1_020), 0, 1)
    const destinationX = result.returnDirection === 'LEFT' ? 320 : result.returnDirection === 'RIGHT' ? 960 : 640
    const destinationY = OPPONENT_Y + 38
    const arc = 80 + Math.abs(result.returnArc ?? 0) * 90 + (result.smash ? 50 : 0)
    const x = Phaser.Math.Linear(startX, destinationX, returnProgress)
    const y = Phaser.Math.Linear(startY, destinationY, returnProgress) - Math.sin(returnProgress * Math.PI) * arc
    const trailColor = result.smash ? 0xff8bf0 : result.resolution === 'PERFECT' ? 0xfff28e : result.resolution === 'GREAT' ? 0x91f6ff : 0xb9ffd0
    graphics.lineStyle(state.badmintonPhase === 'SHUTTLE_RUSH' || result.smash ? 15 : 9, trailColor, 0.65)
    graphics.lineBetween(startX, startY, x, y)
    graphics.fillStyle(trailColor, 0.24)
    graphics.fillCircle(startX, startY, 52 + Math.min(1, age / 260) * 35)
    this.#drawShuttle(graphics, x, y, result.smash ? 34 : 29, trailColor)

    const swingSide = result.hand === 'LEFT' ? -1 : 1
    if (age < 560) {
      graphics.lineStyle(result.smash ? 16 : 11, trailColor, 0.88)
      graphics.arc(WIDTH / 2 + swingSide * 68, PLAYER_Y - 30, 90, swingSide < 0 ? 3.55 : 5.9, swingSide < 0 ? 5.9 : 8.2, false)
      graphics.fillStyle(0xffffff, 0.72)
      graphics.fillCircle(startX, startY, 18 + age / 18)
    }
  }

  #drawShuttle(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number, color: number): void {
    graphics.fillStyle(0x07102b, 0.45)
    graphics.fillEllipse(x + 5, y + 7, size * 1.1, size * 0.8)
    graphics.fillStyle(color, 1)
    graphics.fillCircle(x, y + size * 0.22, size * 0.34)
    graphics.fillTriangle(x - size * 0.54, y - size * 0.48, x + size * 0.54, y - size * 0.48, x, y + size * 0.18)
    graphics.lineStyle(Math.max(2, size / 8), 0x6b7ba8, 0.78)
    graphics.lineBetween(x - size * 0.45, y - size * 0.38, x - size * 0.12, y + size * 0.07)
    graphics.lineBetween(x + size * 0.45, y - size * 0.38, x + size * 0.12, y + size * 0.07)
  }

  #updateText(state: BadmintonState): void {
    if (state.phase === 'COUNTDOWN') {
      this.#countdown.setText(String(Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000)))).setVisible(true)
      this.#phaseBanner.setVisible(false)
      this.#feedback.setVisible(false)
      this.#instruction.setText('看準羽球落點，左右手快速揮拍！').setVisible(true)
      return
    }
    this.#countdown.setVisible(false)
    if (state.phase === 'FINISHED') {
      this.#phaseBanner.setText('RALLY COMPLETE').setColor('#fff18a').setVisible(true)
      this.#feedback.setVisible(false)
      this.#instruction.setText('漂亮的快速交換！').setVisible(true)
      return
    }
    const color = Phaser.Display.Color.IntegerToColor(PHASE_COLOR[state.badmintonPhase]).rgba
    this.#phaseBanner.setText(PHASE_LABEL[state.badmintonPhase]).setColor(color).setVisible(true)
    const result = state.lastResult
    const age = result ? state.elapsedMs - result.resolvedAtMs : Number.POSITIVE_INFINITY
    if (result && age >= 0 && age < 850) {
      const label = result.resolution === 'MISS'
        ? 'MISS'
        : result.smash ? `SMASH!  +${result.scoreAward}` : `${result.resolution}  +${result.scoreAward}`
      this.#feedback.setText(label).setColor(result.resolution === 'MISS' ? '#ffd0bd' : '#fff3a5').setVisible(true)
    } else {
      this.#feedback.setVisible(false)
    }
    const nextShuttle = state.shuttles.find((shuttle) => shuttle.resolution === 'PENDING')
    this.#instruction.setText(nextShuttle ? this.#shuttleInstruction(nextShuttle) : '準備下一球！').setVisible(true)
  }

  #shuttleInstruction(shuttle: BadmintonShuttle): string {
    if (shuttle.family === 'CLEAR') return 'CLEAR 高飛球！看清高點落位'
    if (shuttle.family === 'DRIVE') return 'DRIVE 快球！快速回擊'
    return 'DROP 吊球！注意急墜落點'
  }
}
