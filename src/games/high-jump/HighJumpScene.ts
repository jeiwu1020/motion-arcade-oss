import Phaser from 'phaser'

import {
  HIGH_JUMP_RULES,
  type HighJumpGrade,
  type HighJumpPhase,
  type HighJumpState,
} from './HighJumpCore'
import type { HighJumpSession } from './HighJumpSession'

const WIDTH = 1280
const HEIGHT = 720
const PHASE_LABEL: Readonly<Record<HighJumpPhase, string>> = {
  COUNTDOWN: 'GET READY',
  READY_FOR_ATTEMPT: 'READY FOR ATTEMPT',
  APPROACH: 'TIME YOUR TAKEOFF',
  TAKEOFF: 'TAKEOFF!',
  FLIGHT: 'FLIGHT',
  RESULT: 'RESULT',
  STAGE_TRANSITION: 'NEXT LEVEL',
  FINISHED: 'CHALLENGE COMPLETE',
}
const GRADE_COLOR: Readonly<Record<HighJumpGrade, string>> = {
  PERFECT: '#fff09a',
  GREAT: '#9ff7ff',
  GOOD: '#c9b5ff',
  OK: '#d9e2ef',
}

/** Opaque procedural Phaser projection; Core remains the timing authority. */
export class HighJumpScene extends Phaser.Scene {
  readonly #session: HighJumpSession
  #stadium!: Phaser.GameObjects.Graphics
  #avatar!: Phaser.GameObjects.Graphics
  #effects!: Phaser.GameObjects.Graphics
  #meter!: Phaser.GameObjects.Graphics
  #countdown!: Phaser.GameObjects.Text
  #phaseBanner!: Phaser.GameObjects.Text
  #feedback!: Phaser.GameObjects.Text
  #instruction!: Phaser.GameObjects.Text

  constructor(session: HighJumpSession) {
    super('high-jump')
    this.#session = session
  }

  create(): void {
    this.#stadium = this.add.graphics().setDepth(0)
    this.#meter = this.add.graphics().setDepth(3)
    this.#avatar = this.add.graphics().setDepth(4)
    this.#effects = this.add.graphics().setDepth(5)
    this.#countdown = this.add.text(WIDTH / 2, HEIGHT / 2 - 25, '', {
      color: '#ffffff', fontFamily: 'system-ui, sans-serif', fontSize: '190px', fontStyle: 'bold',
      stroke: '#191a3e', strokeThickness: 18,
    }).setOrigin(0.5).setDepth(12)
    this.#phaseBanner = this.add.text(WIDTH / 2, 70, '', {
      color: '#ffffff', fontFamily: 'system-ui, sans-serif', fontSize: '54px', fontStyle: 'bold',
      stroke: '#191a3e', strokeThickness: 11,
    }).setOrigin(0.5).setDepth(11)
    this.#feedback = this.add.text(WIDTH / 2, 265, '', {
      color: '#fff09a', fontFamily: 'system-ui, sans-serif', fontSize: '90px', fontStyle: 'bold',
      stroke: '#191a3e', strokeThickness: 15,
    }).setOrigin(0.5).setDepth(12)
    this.#instruction = this.add.text(WIDTH / 2, 683, '', {
      color: '#f1f7ff', fontFamily: 'system-ui, sans-serif', fontSize: '25px', fontStyle: 'bold',
      stroke: '#191a3e', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(10)
  }

  update(): void {
    const state = this.#session.getState()
    this.#drawStadium(state)
    this.#drawMeter(state)
    this.#drawAvatar(state)
    this.#drawEffects(state)
    this.#updateText(state)
  }

  #drawStadium(state: HighJumpState): void {
    const graphics = this.#stadium
    graphics.clear()
    const finalStage = state.currentStage === 5
    const pulse = finalStage ? 0.5 + 0.5 * Math.sin(state.elapsedMs / 100) : 0
    graphics.fillStyle(finalStage ? 0x29153e : 0x161739, 1)
    graphics.fillRect(0, 0, WIDTH, HEIGHT)
    graphics.fillStyle(finalStage ? 0xff6eb5 : 0x62d6db, 0.1 + pulse * 0.12)
    graphics.fillCircle(finalStage ? 1080 : 180, 125, 250 + pulse * 35)

    for (let row = 0; row < 5; row += 1) {
      graphics.fillStyle(row % 2 === 0 ? 0x252755 : 0x202147, 0.95)
      graphics.fillRect(0, 130 + row * 56, WIDTH, 46)
    }
    graphics.fillStyle(0x0e1027, 1)
    graphics.fillTriangle(340, 310, 940, 310, 1_110, HEIGHT)
    graphics.fillTriangle(340, 310, 1_110, HEIGHT, 170, HEIGHT)
    graphics.lineStyle(5, finalStage ? 0xffd56e : 0x8eeaf0, 0.74)
    graphics.lineBetween(340, 310, 1_110, HEIGHT)
    graphics.lineBetween(940, 310, 170, HEIGHT)
    graphics.lineBetween(340, 310, 940, 310)
    graphics.fillStyle(0x403666, 1)
    graphics.fillRoundedRect(390, 560, 500, 72, 20)
    graphics.fillStyle(0x9e79cf, 0.3)
    graphics.fillRoundedRect(415, 578, 450, 35, 16)

    for (let line = 0; line < 8; line += 1) {
      const x = 380 + line * 75
      graphics.lineStyle(4, finalStage ? 0xffb4dd : 0x82dce5, 0.3)
      graphics.lineBetween(x, 318, 500 + line * 42, HEIGHT - 88)
    }

    const barY = this.#barY(state.currentStage)
    graphics.fillStyle(0x101127, 0.48)
    graphics.fillRoundedRect(185, barY + 24, 910, 30, 14)
    graphics.lineStyle(finalStage ? 16 : 13, finalStage ? 0xffcc72 : 0xfff0a3, 0.98)
    graphics.lineBetween(250, barY, 1_030, barY)
    graphics.lineStyle(10, 0xc3d6e8, 0.78)
    graphics.lineBetween(250, barY, 250, barY + 210)
    graphics.lineBetween(1_030, barY, 1_030, barY + 210)
    graphics.fillStyle(finalStage ? 0xff6eb5 : 0x79f1e6, 0.16 + pulse * 0.16)
    graphics.fillRoundedRect(60, 28, 270, 62, 18)
    graphics.fillRoundedRect(WIDTH - 330, 28, 270, 62, 18)
    graphics.fillStyle(0xffffff, 0.08)
    graphics.fillCircle(90, 108, 7)
    graphics.fillCircle(WIDTH - 90, 108, 7)
  }

  #drawMeter(state: HighJumpState): void {
    const graphics = this.#meter
    graphics.clear()
    const x = 72
    const top = 190
    const height = 275
    graphics.fillStyle(0x090b20, 0.72)
    graphics.fillRoundedRect(x, top, 92, height, 22)
    graphics.lineStyle(4, 0xbbe8f1, 0.7)
    graphics.strokeRoundedRect(x, top, 92, height, 22)
    graphics.fillStyle(0x79f1e6, 0.18)
    graphics.fillRoundedRect(x + 20, top + 20, 52, height - 40, 15)
    const markerY = top + height - 28 - state.takeoffValue * (height - 56)
    graphics.fillStyle(0xffeb94, 1)
    graphics.fillCircle(x + 46, markerY, 17)
    graphics.lineStyle(8, 0xffeb94, 0.42)
    graphics.lineBetween(x + 22, markerY, x + 70, markerY)
    graphics.fillStyle(0xffffff, 0.92)
    graphics.fillRoundedRect(x + 8, top + 20, 76, 4, 2)
    graphics.fillRoundedRect(x + 8, top + height - 24, 76, 4, 2)
  }

  #drawAvatar(state: HighJumpState): void {
    const graphics = this.#avatar
    graphics.clear()
    const flight = state.phase === 'TAKEOFF' || state.phase === 'FLIGHT'
    const total = HIGH_JUMP_RULES.takeoffMs + HIGH_JUMP_RULES.flightMs
    const elapsed = state.phase === 'TAKEOFF'
      ? HIGH_JUMP_RULES.takeoffMs - state.phaseRemainingMs
      : state.phase === 'FLIGHT'
        ? HIGH_JUMP_RULES.takeoffMs + HIGH_JUMP_RULES.flightMs - state.phaseRemainingMs
        : 0
    const progress = flight ? Phaser.Math.Clamp(elapsed / total, 0, 1) : 0
    const arc = flight ? Math.sin(progress * Math.PI) : 0
    const visualApex = state.lastAttempt ? 0.55 + state.lastAttempt.takeoffValue * 0.45 : 0.55
    const x = 640 + (flight ? Math.sin(progress * Math.PI) * 54 : 0)
    const y = 540 - arc * (170 + visualApex * 135)
    graphics.fillStyle(0x0b0d24, 0.6)
    graphics.fillEllipse(640, 611, flight ? 105 : 140, 28)
    graphics.fillStyle(state.currentStage === 5 ? 0xffbd70 : 0x82f0df, 0.98)
    graphics.fillCircle(x, y - 64, 25)
    graphics.fillRoundedRect(x - 35, y - 36, 70, 92, 22)
    graphics.lineStyle(12, 0x82f0df, 0.95)
    graphics.lineBetween(x - 20, y - 14, x - 82, y + 18)
    graphics.lineBetween(x + 20, y - 14, x + 82, y + 18)
    graphics.lineStyle(13, 0x82f0df, 0.95)
    graphics.lineBetween(x - 18, y + 52, x - 52, y + 105)
    graphics.lineBetween(x + 18, y + 52, x + 52, y + 105)
    graphics.lineStyle(5, 0xffffff, 0.75)
    graphics.strokeCircle(x, y - 64, 32)
    if (flight) {
      graphics.lineStyle(8, state.lastAttempt?.cleared ? 0xffef9a : 0xff94b1, 0.65)
      graphics.arc(x, y + 2, 72, 3.7, 5.8, false)
    }
  }

  #drawEffects(state: HighJumpState): void {
    const graphics = this.#effects
    graphics.clear()
    const finalStage = state.currentStage === 5
    const recentResult = state.phase === 'RESULT' || state.phase === 'STAGE_TRANSITION'
    if (recentResult && state.lastAttempt?.cleared) {
      graphics.fillStyle(finalStage ? 0xff72bd : 0xffed91, 0.16)
      graphics.fillCircle(WIDTH / 2, this.#barY(state.currentStage), 105)
      graphics.lineStyle(finalStage ? 14 : 10, finalStage ? 0xffb2dc : 0xfff2a1, 0.82)
      graphics.arc(WIDTH / 2, 400, 135, 3.4, 6, false)
    }
    if (state.phase === 'APPROACH') {
      graphics.lineStyle(5, state.meterDirection === 'RISING' ? 0x77e9e1 : 0xffd778, 0.55)
      graphics.lineBetween(184, 195, 184, 465)
    }
  }

  #updateText(state: HighJumpState): void {
    if (state.phase === 'COUNTDOWN') {
      this.#countdown.setText(String(Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000)))).setVisible(true)
      this.#phaseBanner.setVisible(false)
      this.#feedback.setVisible(false)
      this.#instruction.setText('輕輕向上跳即可，重點是抓準起跳時機。').setVisible(true)
      return
    }
    this.#countdown.setVisible(false)
    this.#phaseBanner.setText(`${PHASE_LABEL[state.phase]}  ·  LEVEL ${state.currentStage}`).setVisible(true)
    if (state.phase === 'FINISHED') {
      this.#feedback.setText('ALL LEVELS CLEAR?').setColor('#fff09a').setVisible(true)
      this.#instruction.setText('五關挑戰完成！').setVisible(true)
      return
    }
    if (state.phase === 'RESULT' || state.phase === 'STAGE_TRANSITION') {
      const attempt = state.lastAttempt
      const label = attempt?.resolution === 'NO_JUMP' ? 'MISS' : attempt?.cleared ? 'CLEAR!' : 'MISS'
      const color = attempt?.grade ? GRADE_COLOR[attempt.grade] : '#d9e2ef'
      this.#feedback.setText(attempt?.grade ? `${label}  ${attempt.grade}` : label).setColor(color).setVisible(true)
      this.#instruction.setText('下一關繼續，專注抓準節奏。').setVisible(true)
      return
    }
    if (state.phase === 'READY_FOR_ATTEMPT') {
      this.#feedback.setText(`LEVEL ${state.currentStage}`).setColor('#fff09a').setVisible(true)
      this.#instruction.setText('準備好後，等待標記接近頂端再輕輕起跳。').setVisible(true)
      return
    }
    this.#feedback.setVisible(false)
    this.#instruction.setText(`起跳標記 ${Math.round(state.takeoffValue * 100)}%　門檻 ${Math.round(state.stageThreshold * 100)}%`).setVisible(true)
  }

  #barY(stage: number): number {
    return 462 - (Math.max(1, Math.min(5, stage)) - 1) * 62
  }
}
