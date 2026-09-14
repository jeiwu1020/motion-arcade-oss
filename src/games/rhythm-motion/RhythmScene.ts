import Phaser from 'phaser'

import {
  RHYTHM_RULES,
  type RhythmAction,
  type RhythmState,
} from './RhythmCore'
import type { RhythmSession } from './RhythmSession'

const WIDTH = 1280
const HEIGHT = 720
const HIT_Y = 590
const NOTE_TOP_Y = 110
const NOTE_LEAD_MS = RHYTHM_RULES.visualLeadMs
const LANE_X: Readonly<Record<RhythmAction, number>> = {
  LEFT: 170,
  REACH_LEFT: 485,
  REACH_RIGHT: 795,
  RIGHT: 1110,
}
const ACTION_LABEL: Readonly<Record<RhythmAction, string>> = {
  LEFT: '← 左移 / 左傾',
  RIGHT: '右移 / 右傾 →',
  REACH_LEFT: '↙ 左手伸出',
  REACH_RIGHT: '右手伸出 ↘',
}
const ACTION_COLOR: Readonly<Record<RhythmAction, number>> = {
  LEFT: 0x49d9ff,
  RIGHT: 0xffb45c,
  REACH_LEFT: 0x9df06e,
  REACH_RIGHT: 0xff6dc5,
}

/** Phaser projects immutable Rhythm Core state into an opaque beat stage. */
export class RhythmScene extends Phaser.Scene {
  readonly #session: RhythmSession
  #world!: Phaser.GameObjects.Graphics
  #notes!: Phaser.GameObjects.Graphics
  #countdown!: Phaser.GameObjects.Text
  #instruction!: Phaser.GameObjects.Text
  #phaseBanner!: Phaser.GameObjects.Text
  #feedback!: Phaser.GameObjects.Text

  constructor(session: RhythmSession) {
    super('rhythm-motion')
    this.#session = session
  }

  create(): void {
    this.#world = this.add.graphics().setDepth(0)
    this.#notes = this.add.graphics().setDepth(2)
    this.#countdown = this.add.text(WIDTH / 2, HEIGHT / 2 - 20, '', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '190px',
      fontStyle: 'bold',
      stroke: '#18245b',
      strokeThickness: 18,
    }).setOrigin(0.5).setDepth(8)
    this.#instruction = this.add.text(WIDTH / 2, 50, '', {
      align: 'center',
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '34px',
      fontStyle: 'bold',
      stroke: '#10234c',
      strokeThickness: 9,
    }).setOrigin(0.5).setDepth(7)
    this.#phaseBanner = this.add.text(WIDTH / 2, 154, '', {
      color: '#ffe66f',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '76px',
      fontStyle: 'bold',
      stroke: '#7a214e',
      strokeThickness: 14,
    }).setOrigin(0.5).setDepth(9)
    this.#feedback = this.add.text(WIDTH / 2, 285, '', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '78px',
      fontStyle: 'bold',
      stroke: '#17294d',
      strokeThickness: 13,
    }).setOrigin(0.5).setDepth(10)
  }

  update(): void {
    const state = this.#session.getState()
    this.#drawWorld(state)
    this.#drawHitZones(state)
    this.#drawNotes(state)
    this.#updateText(state)
  }

  #drawWorld(state: RhythmState): void {
    const graphics = this.#world
    graphics.clear()
    const finalBeat = state.rhythmPhase === 'FINAL_BEAT'
    const pulse = this.#beatPulse(state)
    graphics.fillStyle(finalBeat ? 0x301244 : 0x091b3d, 1)
    graphics.fillRect(0, 0, WIDTH, HEIGHT)
    graphics.fillStyle(finalBeat ? 0xff4f9a : 0x214f7c, 1)
    graphics.fillTriangle(0, 220, 235, 55, 490, 220)
    graphics.fillTriangle(320, 220, 640, 35, 960, 220)
    graphics.fillTriangle(790, 220, 1050, 58, WIDTH, 220)
    graphics.fillStyle(finalBeat ? 0x5d205f : 0x114a61, 1)
    graphics.fillRect(0, 220, WIDTH, HEIGHT - 220)

    graphics.fillStyle(finalBeat ? 0xff559e : 0x38cbd0, 0.11 + pulse * 0.13)
    graphics.fillRect(0, 232, WIDTH, HEIGHT - 232)
    for (let index = 0; index < 12; index += 1) {
      const y = 245 + index * 34
      const alpha = finalBeat ? 0.55 : 0.25
      graphics.lineStyle(finalBeat ? 5 : 3, index % 2 === 0 ? 0x78e6ff : 0xd48bff, alpha)
      graphics.lineBetween(22, y, 230 + index * 19, y - 32)
      graphics.lineBetween(WIDTH - 22, y, WIDTH - 230 - index * 19, y - 32)
    }

    graphics.fillStyle(0x07142e, 0.94)
    graphics.fillRoundedRect(45, 270, WIDTH - 90, 370, 36)
    graphics.lineStyle(finalBeat ? 8 : 5, finalBeat ? 0xff6fc8 : 0x3f9ed4, 0.7)
    graphics.strokeRoundedRect(45, 270, WIDTH - 90, 370, 36)
  }

  #drawHitZones(state: RhythmState): void {
    const graphics = this.#notes
    graphics.clear()
    const pulse = this.#beatPulse(state)
    for (const action of Object.keys(LANE_X) as RhythmAction[]) {
      const x = LANE_X[action]
      const color = ACTION_COLOR[action]
      graphics.fillStyle(color, 0.1 + pulse * 0.09)
      graphics.fillRoundedRect(x - 125, HIT_Y - 64, 250, 92, 22)
      graphics.lineStyle(5 + pulse * 4, color, 0.68 + pulse * 0.25)
      graphics.strokeRoundedRect(x - 125, HIT_Y - 64, 250, 92, 22)
      this.#drawActionIcon(graphics, action, x, HIT_Y - 18, 1.15 + pulse * 0.12, 0.92)
    }
    graphics.lineStyle(4, 0xffffff, 0.35)
    graphics.lineBetween(85, HIT_Y - 82, WIDTH - 85, HIT_Y - 82)
  }

  #drawNotes(state: RhythmState): void {
    const graphics = this.#notes
    for (const note of state.notes) {
      if (note.resolution !== 'PENDING') continue
      const timeUntil = note.targetTimeMs - state.elapsedMs
      if (timeUntil > NOTE_LEAD_MS || timeUntil < -RHYTHM_RULES.goodWindowMs) continue
      const progress = Phaser.Math.Clamp(1 - timeUntil / NOTE_LEAD_MS, 0, 1)
      const y = Phaser.Math.Linear(NOTE_TOP_Y, HIT_Y, progress)
      const scale = 0.62 + progress * 0.55
      this.#drawActionIcon(graphics, note.action, LANE_X[note.action], y, scale, 0.9)
    }
  }

  #drawActionIcon(
    graphics: Phaser.GameObjects.Graphics,
    action: RhythmAction,
    x: number,
    y: number,
    scale: number,
    alpha: number,
  ): void {
    const color = ACTION_COLOR[action]
    graphics.lineStyle(Math.max(4, 8 * scale), color, alpha)
    graphics.fillStyle(color, alpha * 0.3)
    if (action === 'LEFT' || action === 'RIGHT') {
      const direction = action === 'LEFT' ? -1 : 1
      graphics.fillTriangle(
        x + direction * 68 * scale, y,
        x + direction * 20 * scale, y - 38 * scale,
        x + direction * 20 * scale, y + 38 * scale,
      )
      graphics.lineBetween(x - direction * 56 * scale, y, x + direction * 24 * scale, y)
      graphics.lineBetween(x - direction * 20 * scale, y - 20 * scale, x - direction * 20 * scale, y + 20 * scale)
    } else {
      graphics.fillCircle(x, y, 42 * scale)
      graphics.strokeCircle(x, y, 42 * scale)
      graphics.strokeCircle(x, y, 23 * scale)
      const direction = action === 'REACH_LEFT' ? -1 : 1
      graphics.lineBetween(x + direction * 16 * scale, y, x + direction * 74 * scale, y - 24 * scale)
      graphics.fillCircle(x + direction * 81 * scale, y - 27 * scale, 11 * scale)
    }
  }

  #updateText(state: RhythmState): void {
    if (state.phase === 'COUNTDOWN') {
      if (state.countdownRemainingMs === RHYTHM_RULES.countdownMs) {
        this.#countdown.setText('').setVisible(false)
      } else {
        this.#countdown.setText(String(Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000)))).setVisible(true)
      }
      this.#instruction.setText('看清圖示，跟著節拍動起來！').setVisible(true)
      this.#phaseBanner.setVisible(false)
      this.#feedback.setVisible(false)
      return
    }
    this.#countdown.setVisible(false)
    if (state.phase === 'FINISHED') {
      this.#instruction.setText('節奏完成！').setVisible(true)
      this.#phaseBanner.setText('FINISH!').setVisible(true)
      this.#feedback.setVisible(false)
      return
    }

    const nextNote = state.notes.slice(state.nextNoteIndex).find((note) => note.resolution === 'PENDING')
    this.#instruction.setText(nextNote ? ACTION_LABEL[nextNote.action] : '保持節奏！').setVisible(true)
    const finalBeatAge = state.elapsedMs - RHYTHM_RULES.energyEndMs
    this.#phaseBanner
      .setText('FINAL BEAT!')
      .setVisible(state.rhythmPhase === 'FINAL_BEAT' && finalBeatAge >= 0 && finalBeatAge < 1_700)
    const resultAge = state.lastResult?.attemptAtMs === null || state.lastResult?.attemptAtMs === undefined
      ? Number.POSITIVE_INFINITY
      : state.elapsedMs - state.lastResult.attemptAtMs
    if (state.lastResult && resultAge >= 0 && resultAge < 650) {
      this.#feedback
        .setText(state.lastResult.resolution === 'MISS'
          ? 'MISS · 繼續跟拍！'
          : `${state.lastResult.resolution}  +${state.lastResult.scoreAward}`)
        .setColor(state.lastResult.resolution === 'MISS' ? '#ff9ab4' : '#fff29a')
        .setVisible(true)
    } else {
      this.#feedback.setVisible(false)
    }
  }

  #beatPulse(state: RhythmState): number {
    const nextNote = state.notes.slice(state.nextNoteIndex).find((note) => note.resolution === 'PENDING')
    if (!nextNote) return 0
    const distance = Math.abs(nextNote.targetTimeMs - state.elapsedMs)
    return Phaser.Math.Clamp(1 - distance / 300, 0, 1)
  }
}
