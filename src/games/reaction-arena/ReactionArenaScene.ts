import Phaser from 'phaser'

import type { ReactionArenaState } from './ReactionArenaCore'
import type { ReactionArenaAudio } from './ReactionArenaAudio'
import {
  getReactionArenaCueVisual,
} from './ReactionArenaPresentation'
import type { ReactionArenaSession } from './ReactionArenaSession'

const WIDTH = 1280
const HEIGHT = 720

/** Phaser only renders the normalized Reaction Arena state. */
export class ReactionArenaScene extends Phaser.Scene {
  readonly #session: ReactionArenaSession
  readonly #audio: ReactionArenaAudio | null
  #countdown!: Phaser.GameObjects.Text
  #cueLabel!: Phaser.GameObjects.Text
  #cuePrompt!: Phaser.GameObjects.Text
  #status!: Phaser.GameObjects.Text
  #grade!: Phaser.GameObjects.Text
  #speedZone!: Phaser.GameObjects.Text
  #cueGraphic!: Phaser.GameObjects.Graphics
  #presentationEventCount = 0
  #lastResultId = 0
  #lastCountdown = 0
  #bgmStarted = false

  constructor(session: ReactionArenaSession, audio?: ReactionArenaAudio) {
    super('reaction-arena')
    this.#session = session
    this.#audio = audio ?? null
  }

  create(): void {
    this.#cueGraphic = this.add.graphics().setDepth(1)
    this.#countdown = this.add.text(WIDTH / 2, HEIGHT / 2, '', {
      color: '#fff', fontFamily: 'system-ui, sans-serif', fontSize: '190px', fontStyle: 'bold',
      stroke: '#152c59', strokeThickness: 18,
    }).setOrigin(0.5).setDepth(10)
    this.#cueLabel = this.add.text(WIDTH / 2, 300, '', {
      color: '#ffffff', fontFamily: 'system-ui, sans-serif', fontSize: '108px', fontStyle: 'bold',
      stroke: '#182a5b', strokeThickness: 14,
    }).setOrigin(0.5).setDepth(5)
    this.#cuePrompt = this.add.text(WIDTH / 2, 400, '', {
      color: '#d7f6ff', fontFamily: 'system-ui, sans-serif', fontSize: '42px', fontStyle: 'bold',
      stroke: '#182a5b', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(5)
    this.#status = this.add.text(WIDTH / 2, HEIGHT - 50, '', {
      color: '#ffffff', fontFamily: 'system-ui, sans-serif', fontSize: '30px', fontStyle: 'bold',
      stroke: '#182a5b', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(5)
    this.#grade = this.add.text(WIDTH / 2, 175, '', {
      color: '#ffe57d', fontFamily: 'system-ui, sans-serif', fontSize: '62px', fontStyle: 'bold',
      stroke: '#482b72', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(6).setVisible(false)
    this.#speedZone = this.add.text(WIDTH / 2, 265, 'SPEED ZONE!\n最後 10 秒！', {
      align: 'center', color: '#ffec73', fontFamily: 'system-ui, sans-serif', fontSize: '88px', fontStyle: 'bold',
      stroke: '#7d234f', strokeThickness: 14,
    }).setOrigin(0.5).setDepth(8).setVisible(false)
  }

  update(): void {
    const state = this.#session.getState()
    if (state.phase === 'COUNTDOWN') {
      this.#audio?.resetRoundAudio()
      this.#bgmStarted = false
      this.#presentationEventCount = 0
      this.#speedZone.setVisible(false)
      this.#cueGraphic.clear()
      this.#cueLabel.setText('').setVisible(false)
      this.#cuePrompt.setText('').setVisible(false)
      if (!hasCountdownStarted(state)) {
        this.#lastCountdown = 0
        this.#countdown.setText('').setVisible(false)
        this.#status.setText('').setVisible(false)
        return
      }
      const number = Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000))
      if (number !== this.#lastCountdown) this.#audio?.play('COUNTDOWN_TICK')
      this.#lastCountdown = number
      this.#countdown.setText(String(number)).setVisible(true)
      this.#status.setText('準備好，跟著提示動作！').setVisible(true)
      return
    }

    this.#countdown.setVisible(false)
    if (state.phase === 'FINISHED') {
      if (state.presentationEvents.some((event) => event.kind === 'ROUND_FINISH')) this.#audio?.play('ROUND_FINISH')
      this.#audio?.stopBgm()
      this.#cueGraphic.clear()
      this.#cueLabel.setText('').setVisible(false)
      this.#cuePrompt.setText('').setVisible(false)
      this.#status.setText('時間到！').setVisible(true)
      return
    }

    if (!this.#bgmStarted) {
      this.#audio?.startBgm()
      this.#bgmStarted = true
    }
    for (const event of state.presentationEvents.slice(this.#presentationEventCount)) {
      if (event.kind === 'SPEED_ZONE_START') this.#showSpeedZone()
      if (event.kind === 'COMBO_MILESTONE') this.#showAnnouncement(`${event.value} COMBO!`)
      if (event.kind === 'SPECIAL_EVENT_START') {
        this.#showAnnouncement(event.event.replaceAll('_', ' '))
        this.#audio?.play('SPECIAL_EVENT_START')
      }
    }
    this.#presentationEventCount = state.presentationEvents.length
    if (state.lastResult && state.lastResult.cueId !== this.#lastResultId) {
      this.#lastResultId = state.lastResult.cueId
      if (state.lastResult.grade) {
        this.#grade.setText(state.lastResult.grade).setAlpha(1).setVisible(true)
        this.tweens.add({ targets: this.#grade, alpha: 0, duration: 420 })
        this.#audio?.play(state.lastResult.grade === 'PERFECT' ? 'PERFECT' : 'SUCCESS')
      }
    }
    this.#drawCue(state)
    this.#status.setText('看提示，做出動作！').setVisible(true)
  }

  #drawCue(state: ReactionArenaState): void {
    this.#cueGraphic.clear()
    const cue = state.currentCue
    if (!cue) {
      this.#cueLabel.setVisible(false)
      this.#cuePrompt.setVisible(false)
      return
    }
    const visual = getReactionArenaCueVisual(cue.kind)
    this.#cueLabel.setText(visual.label).setVisible(true)
    this.#cuePrompt.setText(visual.prompt).setVisible(true)
    if (visual.family === 'SIDE_GATE') {
      const x = visual.direction === 'LEFT' ? 180 : WIDTH - 180
      this.#cueGraphic.fillStyle(visual.direction === 'LEFT' ? 0x52d5ff : 0xffb75e, 0.25)
      this.#cueGraphic.fillRoundedRect(55, 145, WIDTH / 2 - 90, 300, 36)
      this.#cueGraphic.fillRoundedRect(WIDTH / 2 + 35, 145, WIDTH / 2 - 90, 300, 36)
      this.#cueGraphic.lineStyle(14, visual.direction === 'LEFT' ? 0x52d5ff : 0xffb75e, 0.9)
      this.#cueGraphic.strokeCircle(x, 300, 100)
      this.#cueGraphic.lineBetween(x + (visual.direction === 'LEFT' ? 80 : -80), 300, x + (visual.direction === 'LEFT' ? -45 : 45), 300)
      this.#cueGraphic.lineBetween(x + (visual.direction === 'LEFT' ? -45 : 45), 300, x + (visual.direction === 'LEFT' ? -10 : 10), 260)
      this.#cueGraphic.lineBetween(x + (visual.direction === 'LEFT' ? -45 : 45), 300, x + (visual.direction === 'LEFT' ? -10 : 10), 340)
    } else if (visual.family === 'REACH_TARGET') {
      const x = visual.direction === 'LEFT' ? 220 : WIDTH - 220
      this.#cueGraphic.fillStyle(visual.direction === 'LEFT' ? 0x51d9ff : 0xffad66, 0.3)
      this.#cueGraphic.fillCircle(x, 190, 115)
      this.#cueGraphic.lineStyle(12, visual.direction === 'LEFT' ? 0x51d9ff : 0xffad66, 0.95)
      this.#cueGraphic.strokeCircle(x, 190, 115)
      this.#cueGraphic.strokeCircle(x, 190, 78)
    } else {
      this.#cueGraphic.fillStyle(0xffe07e, 0.35)
      this.#cueGraphic.fillRoundedRect(110, 170, WIDTH - 220, 36, 18)
      this.#cueGraphic.lineStyle(12, 0xffe07e, 0.95)
      this.#cueGraphic.strokeRoundedRect(95, 152, WIDTH - 190, 72, 25)
      this.#cueGraphic.lineBetween(235, 235, 180, 430)
      this.#cueGraphic.lineBetween(WIDTH - 235, 235, WIDTH - 180, 430)
    }
  }

  #showAnnouncement(text: string): void {
    this.#cuePrompt.setText(text).setVisible(true).setScale(1.15)
    this.tweens.add({ targets: this.#cuePrompt, scale: 1, duration: 500 })
  }

  #showSpeedZone(): void {
    this.#audio?.play('SPEED_ZONE_START')
    this.#speedZone.setVisible(true).setAlpha(1).setScale(0.65)
    this.tweens.add({ targets: this.#speedZone, scale: 1, alpha: 0, delay: 450, duration: 900 })
  }
}

function hasCountdownStarted(state: ReactionArenaState): boolean {
  return state.countdownRemainingMs < 3_000
}
