import Phaser from 'phaser'

import {
  LONG_JUMP_RULES,
  type LongJumpGrade,
  type LongJumpPhase,
  type LongJumpState,
} from './LongJumpCore'
import type { LongJumpSession } from './LongJumpSession'

const WIDTH = 1_280
const HEIGHT = 720
const PHASE_LABEL: Readonly<Record<LongJumpPhase, string>> = {
  COUNTDOWN: 'GET READY',
  ATTEMPT_READY: 'ATTEMPT READY',
  CHARGE: 'BUILD ARCADE CHARGE',
  TAKEOFF_WINDOW: 'TAKEOFF WINDOW',
  FLIGHT: 'FLIGHT!',
  RESULT: 'LANDING RESULT',
  ATTEMPT_TRANSITION: 'NEXT ATTEMPT',
  FINISHED: 'CHALLENGE COMPLETE',
}
const GRADE_COLOR: Readonly<Record<LongJumpGrade, string>> = {
  PERFECT: '#fff09a',
  GREAT: '#9ff7ff',
  GOOD: '#c8b9ff',
  OK: '#e7d2bc',
}

/** Opaque procedural projection. Core decides charge, timing, and distance. */
export class LongJumpScene extends Phaser.Scene {
  readonly #session: LongJumpSession
  #stadium!: Phaser.GameObjects.Graphics
  #runway!: Phaser.GameObjects.Graphics
  #meter!: Phaser.GameObjects.Graphics
  #avatar!: Phaser.GameObjects.Graphics
  #effects!: Phaser.GameObjects.Graphics
  #countdown!: Phaser.GameObjects.Text
  #banner!: Phaser.GameObjects.Text
  #feedback!: Phaser.GameObjects.Text
  #instruction!: Phaser.GameObjects.Text

  constructor(session: LongJumpSession) {
    super('long-jump')
    this.#session = session
  }

  create(): void {
    this.#stadium = this.add.graphics().setDepth(0)
    this.#runway = this.add.graphics().setDepth(1)
    this.#meter = this.add.graphics().setDepth(3)
    this.#avatar = this.add.graphics().setDepth(4)
    this.#effects = this.add.graphics().setDepth(5)
    this.#countdown = this.add.text(WIDTH / 2, HEIGHT / 2 - 30, '', {
      color: '#ffffff', fontFamily: 'system-ui, sans-serif', fontSize: '190px', fontStyle: 'bold',
      stroke: '#1a1739', strokeThickness: 18,
    }).setOrigin(0.5).setDepth(12)
    this.#banner = this.add.text(WIDTH / 2, 69, '', {
      color: '#ffffff', fontFamily: 'system-ui, sans-serif', fontSize: '52px', fontStyle: 'bold',
      stroke: '#1a1739', strokeThickness: 11,
    }).setOrigin(0.5).setDepth(11)
    this.#feedback = this.add.text(WIDTH / 2, 248, '', {
      color: '#fff09a', fontFamily: 'system-ui, sans-serif', fontSize: '88px', fontStyle: 'bold',
      stroke: '#1a1739', strokeThickness: 15,
    }).setOrigin(0.5).setDepth(12)
    this.#instruction = this.add.text(WIDTH / 2, 680, '', {
      color: '#f1f7ff', fontFamily: 'system-ui, sans-serif', fontSize: '25px', fontStyle: 'bold',
      stroke: '#1a1739', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(10)
  }

  update(): void {
    const state = this.#session.getState()
    this.#drawStadium(state)
    this.#drawRunway(state)
    this.#drawMeter(state)
    this.#drawAvatar(state)
    this.#drawEffects(state)
    this.#updateText(state)
  }

  #drawStadium(state: LongJumpState): void {
    const graphics = this.#stadium
    const finale = state.attemptIndex === 2
    const pulse = finale ? 0.5 + Math.sin(state.elapsedMs / 130) * 0.5 : 0
    graphics.clear()
    graphics.fillStyle(finale ? 0x32163e : 0x17183b, 1)
    graphics.fillRect(0, 0, WIDTH, HEIGHT)
    graphics.fillStyle(finale ? 0xff6c9d : 0x58d7e0, 0.1 + pulse * 0.12)
    graphics.fillCircle(finale ? 1_080 : 175, 120, 245 + pulse * 34)
    for (let row = 0; row < 5; row += 1) {
      graphics.fillStyle(row % 2 === 0 ? 0x28264f : 0x222246, 0.94)
      graphics.fillRect(0, 125 + row * 51, WIDTH, 42)
    }
    for (let light = 0; light < 12; light += 1) {
      graphics.fillStyle(finale ? 0xffc77f : 0x9cebf2, 0.5)
      graphics.fillCircle(75 + light * 103, 98 + (light % 2) * 14, 5)
    }
    graphics.fillStyle(0x11132e, 0.82)
    graphics.fillRoundedRect(38, 28, 285, 64, 18)
    graphics.fillRoundedRect(WIDTH - 323, 28, 285, 64, 18)
  }

  #drawRunway(state: LongJumpState): void {
    const graphics = this.#runway
    const finale = state.attemptIndex === 2
    graphics.clear()
    graphics.fillStyle(0x2b2a59, 1)
    graphics.fillTriangle(230, 305, 910, 305, 1_160, HEIGHT)
    graphics.fillTriangle(230, 305, 1_160, HEIGHT, 120, HEIGHT)
    graphics.lineStyle(6, finale ? 0xffd677 : 0x8cecf0, 0.72)
    graphics.lineBetween(230, 305, 120, HEIGHT)
    graphics.lineBetween(910, 305, 1_160, HEIGHT)
    graphics.lineBetween(230, 305, 910, 305)
    for (let line = 0; line < 8; line += 1) {
      graphics.lineStyle(4, finale ? 0xffb4d1 : 0x8ddfe8, 0.34)
      graphics.lineBetween(272 + line * 82, 320, 355 + line * 99, HEIGHT)
    }
    const scroll = (state.elapsedMs * 0.08) % 56
    for (let mark = 0; mark < 8; mark += 1) {
      const y = 380 + mark * 57 + scroll
      graphics.fillStyle(0xffffff, 0.22)
      graphics.fillRoundedRect(500 - mark * 12, y, 86 + mark * 4, 8, 4)
    }
    graphics.fillStyle(0x4e2d47, 1)
    graphics.fillRoundedRect(780, 505, 360, 160, 24)
    graphics.fillStyle(0xd9a16e, 0.84)
    graphics.fillRoundedRect(805, 528, 315, 115, 20)
    graphics.fillStyle(finale ? 0xffe78e : 0xfff0ac, 1)
    graphics.fillRoundedRect(682, 402, 20, 253, 8)
    graphics.fillStyle(0xffffff, 0.94)
    graphics.fillRoundedRect(650, 390, 85, 13, 6)
    graphics.fillStyle(0x83f4e5, 0.28)
    graphics.fillRoundedRect(620, 378, 145, 34, 15)
    graphics.fillStyle(0xffec9b, 0.9)
    graphics.fillTriangle(642, 340, 722, 340, 682, 382)
    graphics.fillStyle(0xffffff, 0.75)
    graphics.fillRoundedRect(1025, 465, 4, 175, 2)
    graphics.fillCircle(1027, 460, 14)
  }

  #drawMeter(state: LongJumpState): void {
    const graphics = this.#meter
    graphics.clear()
    const x = 70
    const top = 183
    const height = 290
    graphics.fillStyle(0x0a0c24, 0.74)
    graphics.fillRoundedRect(x, top, 106, height, 24)
    graphics.lineStyle(4, 0xb5edf0, 0.7)
    graphics.strokeRoundedRect(x, top, 106, height, 24)
    graphics.fillStyle(0x72e6de, 0.2)
    graphics.fillRoundedRect(x + 20, top + 21, 66, height - 42, 16)
    const fillHeight = Math.max(0, height - 66) * state.charge
    if (fillHeight > 0) {
      graphics.fillStyle(0xffdf8a, 0.72)
      graphics.fillRoundedRect(x + 28, top + height - 33 - fillHeight, 50, fillHeight, 12)
    }
    graphics.fillStyle(0xffeb95, 1)
    graphics.fillCircle(x + 53, top + height - 31 - state.charge * (height - 62), 17)
    graphics.lineStyle(8, 0xffeb95, 0.42)
    graphics.lineBetween(x + 25, top + height - 31 - state.charge * (height - 62), x + 81, top + height - 31 - state.charge * (height - 62))
  }

  #drawAvatar(state: LongJumpState): void {
    const graphics = this.#avatar
    graphics.clear()
    const flight = state.phase === 'FLIGHT'
    const flightProgress = flight ? Phaser.Math.Clamp(1 - state.phaseRemainingMs / LONG_JUMP_RULES.flightMs, 0, 1) : 0
    const arc = flight ? Math.sin(flightProgress * Math.PI) : 0
    const travel = state.lastAttempt?.visualTravel ?? LONG_JUMP_RULES.visualTravelBase
    const x = 370 + (flight ? flightProgress * travel * 520 : 0)
    const y = 585 - arc * (115 + (state.timingQuality * 90)) + (flight ? 0 : Math.sin(state.elapsedMs / 170) * state.charge * 8)
    graphics.fillStyle(0x07091e, 0.66)
    graphics.fillEllipse(390 + (flight ? flightProgress * travel * 520 : 0), 650, flight ? 100 : 145, 28)
    graphics.fillStyle(state.attemptIndex === 2 ? 0xffbd74 : 0x84eee2, 0.98)
    graphics.fillCircle(x, y - 66, 28)
    graphics.fillRoundedRect(x - 38, y - 37, 76, 100, 24)
    const leftArm = state.latestStepSide === 'LEFT' ? -92 : -76
    const rightArm = state.latestStepSide === 'RIGHT' ? 92 : 76
    graphics.lineStyle(13, 0x84eee2, 0.95)
    graphics.lineBetween(x - 18, y - 12, x + leftArm, y + (flight ? -15 : 18))
    graphics.lineBetween(x + 18, y - 12, x + rightArm, y + (flight ? -15 : 18))
    graphics.lineBetween(x - 18, y + 59, x - 57, y + (flight ? 116 : 117))
    graphics.lineBetween(x + 18, y + 59, x + 57, y + (flight ? 116 : 117))
    graphics.lineStyle(5, 0xffffff, 0.76)
    graphics.strokeCircle(x, y - 66, 35)
    if (flight) {
      graphics.lineStyle(9, state.lastAttempt?.timingQuality && state.lastAttempt.timingQuality >= 0.5 ? 0xffef9a : 0xff9bba, 0.62)
      graphics.arc(x - 68, y + 24, 90, 3.5, 5.75, false)
    }
  }

  #drawEffects(state: LongJumpState): void {
    const graphics = this.#effects
    graphics.clear()
    if (state.phase === 'TAKEOFF_WINDOW') {
      graphics.lineStyle(7, 0xffe995, 0.76)
      graphics.lineBetween(612, 370, 752, 370)
      graphics.fillStyle(0xffed98, 0.2)
      graphics.fillCircle(682, 386, 80 + Math.sin(state.takeoffElapsedMs / 90) * 9)
    }
    if (state.phase === 'RESULT' && state.lastAttempt) {
      const success = state.lastAttempt.arcadeDistance > 0
      graphics.fillStyle(success ? 0x8af1e2 : 0xff9aaf, 0.15)
      graphics.fillCircle(850, 555, success ? 122 : 82)
      graphics.lineStyle(success ? 12 : 7, success ? 0xffee9f : 0xff9cae, 0.7)
      graphics.arc(850, 555, success ? 105 : 75, 3.35, 5.95, false)
    }
    if (state.phase === 'FLIGHT') {
      graphics.lineStyle(8, 0xfff1a5, 0.5)
      graphics.lineBetween(292, 590, 490, 590)
      graphics.lineBetween(270, 608, 440, 608)
    }
  }

  #updateText(state: LongJumpState): void {
    if (state.phase === 'COUNTDOWN') {
      this.#countdown.setText(String(Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000)))).setVisible(true)
      this.#banner.setVisible(false)
      this.#feedback.setVisible(false)
      this.#instruction.setText('原地抬膝蓄力，看到起跳提示後輕輕向上跳即可。不要往前跳。').setVisible(true)
      return
    }
    this.#countdown.setVisible(false)
    this.#banner.setText(`${PHASE_LABEL[state.phase]}  ·  ATTEMPT ${state.attemptIndex + 1} / 3`).setVisible(true)
    if (state.phase === 'FINISHED') {
      this.#feedback.setText('CHALLENGE COMPLETE').setColor('#fff09a').setVisible(true)
      this.#instruction.setText('三次挑戰完成！').setVisible(true)
      return
    }
    if (state.phase === 'RESULT' || state.phase === 'ATTEMPT_TRANSITION') {
      const attempt = state.lastAttempt
      if (attempt?.resolution === 'NO_JUMP') {
        this.#feedback.setText('未起跳').setColor('#e4d6c7').setVisible(true)
      } else if (attempt) {
        this.#feedback.setText(`${attempt.grade}  ·  遊戲距離 ${attempt.arcadeDistance}`).setColor(attempt.grade ? GRADE_COLOR[attempt.grade] : '#fff09a').setVisible(true)
      }
      this.#instruction.setText('下一次繼續，專注蓄力與時機。').setVisible(true)
      return
    }
    if (state.phase === 'ATTEMPT_READY') {
      this.#feedback.setText(`第 ${state.attemptIndex + 1} 次挑戰`).setColor('#fff09a').setVisible(true)
      this.#instruction.setText('原地抬膝蓄力，等等看起跳提示。').setVisible(true)
      return
    }
    if (state.phase === 'CHARGE') {
      this.#feedback.setText(`蓄力 ${Math.round(state.charge * 100)}%`).setColor('#9ff7ff').setVisible(true)
      this.#instruction.setText('保持原地抬膝，蓄力越完整，角色飛得越遠。').setVisible(true)
      return
    }
    if (state.phase === 'TAKEOFF_WINDOW') {
      this.#feedback.setText('起跳！').setColor('#fff09a').setVisible(true)
      this.#instruction.setText(`理想時機 ${LONG_JUMP_RULES.idealTakeoffTimeMs}ms　請輕輕向上跳`).setVisible(true)
      return
    }
    this.#feedback.setVisible(false)
    this.#instruction.setText('角色正在飛行，準備查看遊戲距離。').setVisible(true)
  }
}
