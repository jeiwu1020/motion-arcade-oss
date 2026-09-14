import Phaser from 'phaser'

import {
  SWIMMING_RULES,
  type SwimmingGameplayPhase,
  type SwimmingParticipantId,
  type SwimmingState,
  type SwimmingStrokeSide,
} from './SwimmingCore'
import type { SwimmingSession } from './SwimmingSession'

const WIDTH = 1280
const HEIGHT = 720
const LANE_Y: Readonly<Record<SwimmingParticipantId, number>> = {
  STEADY: 190,
  SURGER: 315,
  FINISHER: 440,
  PLAYER: 575,
}
const PHASE_LABEL: Readonly<Record<SwimmingGameplayPhase, string>> = {
  WARM_UP: 'WARM UP',
  CRUISE: 'CRUISE',
  CHASE: 'CHASE',
  FINAL_SPLASH: 'FINAL SPLASH!',
}
const PHASE_COLOR: Readonly<Record<SwimmingGameplayPhase, number>> = {
  WARM_UP: 0x68f2dc,
  CRUISE: 0x65d8ff,
  CHASE: 0xffd76a,
  FINAL_SPLASH: 0xff73bd,
}

/** Opaque read-only Phaser projection; Core remains authoritative. */
export class SwimmingScene extends Phaser.Scene {
  readonly #session: SwimmingSession
  #water!: Phaser.GameObjects.Graphics
  #swimmers!: Phaser.GameObjects.Graphics
  #effects!: Phaser.GameObjects.Graphics
  #countdown!: Phaser.GameObjects.Text
  #phaseBanner!: Phaser.GameObjects.Text
  #feedback!: Phaser.GameObjects.Text
  #instruction!: Phaser.GameObjects.Text

  constructor(session: SwimmingSession) {
    super('swimming')
    this.#session = session
  }

  create(): void {
    this.#water = this.add.graphics().setDepth(0)
    this.#swimmers = this.add.graphics().setDepth(2)
    this.#effects = this.add.graphics().setDepth(4)
    this.#countdown = this.add.text(WIDTH / 2, HEIGHT / 2, '', {
      color: '#ffffff', fontFamily: 'system-ui, sans-serif', fontSize: '190px', fontStyle: 'bold',
      stroke: '#08274c', strokeThickness: 18,
    }).setOrigin(0.5).setDepth(10)
    this.#phaseBanner = this.add.text(WIDTH / 2, 72, '', {
      color: '#ffffff', fontFamily: 'system-ui, sans-serif', fontSize: '58px', fontStyle: 'bold',
      stroke: '#08274c', strokeThickness: 12,
    }).setOrigin(0.5).setDepth(9)
    this.#feedback = this.add.text(WIDTH / 2, 310, '', {
      color: '#fff29a', fontFamily: 'system-ui, sans-serif', fontSize: '82px', fontStyle: 'bold',
      stroke: '#08274c', strokeThickness: 14,
    }).setOrigin(0.5).setDepth(10)
    this.#instruction = this.add.text(WIDTH / 2, 687, '', {
      color: '#e9fdff', fontFamily: 'system-ui, sans-serif', fontSize: '25px', fontStyle: 'bold',
      stroke: '#062548', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(8)
  }

  update(): void {
    const state = this.#session.getState()
    this.#drawPool(state)
    this.#drawSwimmers(state)
    this.#drawEffects(state)
    this.#updateText(state)
  }

  #drawPool(state: SwimmingState): void {
    const graphics = this.#water
    graphics.clear()
    const finalSplash = state.swimmingPhase === 'FINAL_SPLASH'
    const pulse = finalSplash ? 0.5 + Math.sin(state.elapsedMs / 90) * 0.5 : 0
    graphics.fillStyle(finalSplash ? 0x27174b : 0x032a50, 1)
    graphics.fillRect(0, 0, WIDTH, HEIGHT)
    graphics.fillStyle(finalSplash ? 0xff4fa5 : 0x18c9de, 0.1 + pulse * 0.12)
    graphics.fillCircle(1080, 90, 250 + pulse * 35)
    graphics.fillStyle(0x0877a4, 1)
    graphics.fillRoundedRect(35, 120, 1210, 520, 24)
    const drift = (state.elapsedMs * (finalSplash ? 0.18 : 0.1)) % 110
    for (let lane = 0; lane < 4; lane += 1) {
      const top = 130 + lane * 125
      graphics.fillStyle(lane % 2 === 0 ? 0x0b8fba : 0x087ca9, 0.9)
      graphics.fillRect(45, top, 1190, 116)
      graphics.lineStyle(7, lane === 3 ? 0xffe279 : 0xf1f8ff, lane === 3 ? 0.78 : 0.5)
      graphics.lineBetween(45, top + 118, 1235, top + 118)
      for (let wave = -1; wave < 13; wave += 1) {
        const x = 55 + wave * 105 + drift
        graphics.lineStyle(finalSplash ? 5 : 3, 0xc8f8ff, 0.14 + pulse * 0.12)
        graphics.arc(x, top + 56, 34, 3.35, 6.05, false)
      }
    }
    graphics.fillStyle(PHASE_COLOR[state.swimmingPhase], 0.22 + pulse * 0.16)
    graphics.fillRoundedRect(55, 28, 280, 60, 18)
    graphics.fillRoundedRect(WIDTH - 335, 28, 280, 60, 18)
  }

  #drawSwimmers(state: SwimmingState): void {
    const graphics = this.#swimmers
    graphics.clear()
    this.#drawSwimmer(graphics, 'PLAYER', state.playerProgress, state.latestStroke?.side ?? 'LEFT', state)
    for (const swimmer of state.aiSwimmers) this.#drawSwimmer(graphics, swimmer.id, swimmer.progress, 'RIGHT', state)
  }

  #drawSwimmer(
    graphics: Phaser.GameObjects.Graphics,
    id: SwimmingParticipantId,
    progress: number,
    strokeSide: SwimmingStrokeSide,
    state: SwimmingState,
  ): void {
    const y = LANE_Y[id]
    const normalized = Phaser.Math.Clamp(progress / 65, 0, 1)
    const x = 115 + normalized * 1040
    const player = id === 'PLAYER'
    const color = player ? 0x7bffe5 : id === 'STEADY' ? 0x9cc8ff : id === 'SURGER' ? 0xffdc78 : 0xff91c4
    const recentStroke = player && state.latestStroke && state.elapsedMs - state.latestStroke.atMs < 560
    const armLift = recentStroke ? (strokeSide === 'LEFT' ? -22 : 22) : 0
    graphics.fillStyle(0x042a4d, 0.42)
    graphics.fillEllipse(x - 10, y + 24, 150, 35)
    graphics.fillStyle(color, 0.96)
    graphics.fillRoundedRect(x - 45, y - 12, 90, 38, 18)
    graphics.fillCircle(x + 48, y + 7, 21)
    graphics.lineStyle(player ? 13 : 10, color, 0.95)
    graphics.lineBetween(x - 10, y - 5, x - 62, y - 25 - armLift)
    graphics.lineBetween(x + 5, y + 10, x - 46, y + 37 + armLift)
    graphics.lineStyle(8, 0xd9fbff, player ? 0.9 : 0.48)
    graphics.lineBetween(x - 52, y + 14, x - 105, y + 18)
    if (player) {
      graphics.lineStyle(4, 0xffffff, 0.78)
      graphics.strokeRoundedRect(x - 53, y - 20, 116, 55, 24)
    }
  }

  #drawEffects(state: SwimmingState): void {
    const graphics = this.#effects
    graphics.clear()
    const strokeAge = state.latestStroke ? state.elapsedMs - state.latestStroke.atMs : Number.POSITIVE_INFINITY
    if (state.latestStroke && strokeAge >= 0 && strokeAge < 620) {
      const x = 115 + Phaser.Math.Clamp(state.playerProgress / 65, 0, 1) * 1040
      const side = state.latestStroke.side === 'LEFT' ? -1 : 1
      graphics.lineStyle(12, state.swimmingPhase === 'FINAL_SPLASH' ? 0xff9bd2 : 0xa8ffff, 0.78)
      graphics.arc(x - 25, LANE_Y.PLAYER + side * 24, 70, side < 0 ? 3.4 : 0.2, side < 0 ? 5.9 : 2.7, false)
      for (let drop = 0; drop < 7; drop += 1) {
        graphics.fillStyle(0xe8ffff, 0.75 - drop * 0.07)
        graphics.fillCircle(x - 70 - drop * 12, LANE_Y.PLAYER - 30 + (drop % 3) * 22, 7 - drop * 0.45)
      }
    }
    if (state.swimmingPhase === 'FINAL_SPLASH') {
      for (let line = 0; line < 10; line += 1) {
        const x = 90 + ((line * 149 + state.elapsedMs * 0.75) % 1120)
        graphics.lineStyle(5, line % 2 === 0 ? 0xff83c4 : 0x8cffff, 0.32)
        graphics.lineBetween(x, 145 + (line % 4) * 125, x - 80, 145 + (line % 4) * 125)
      }
    }
  }

  #updateText(state: SwimmingState): void {
    if (state.phase === 'COUNTDOWN') {
      this.#countdown.setText(String(Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000)))).setVisible(true)
      this.#phaseBanner.setVisible(false)
      this.#feedback.setVisible(false)
      this.#instruction.setText('左右手交替划動，保持流暢節奏！').setVisible(true)
      return
    }
    this.#countdown.setVisible(false)
    if (state.phase === 'FINISHED') {
      this.#phaseBanner.setText('RACE COMPLETE').setColor('#fff29a').setVisible(true)
      this.#feedback.setText(`第 ${state.finalPlace} 名`).setColor('#fff29a').setVisible(true)
      this.#instruction.setText('60 秒泳池衝刺完成！').setVisible(true)
      return
    }
    const color = Phaser.Display.Color.IntegerToColor(PHASE_COLOR[state.swimmingPhase]).rgba
    this.#phaseBanner.setText(PHASE_LABEL[state.swimmingPhase]).setColor(color).setVisible(true)
    const lastEvent = state.presentationEvents.at(-1)
    const age = lastEvent && 'atMs' in lastEvent ? state.elapsedMs - lastEvent.atMs : Number.POSITIVE_INFINITY
    if (lastEvent?.kind === 'OVERTAKE' && age < 1_050) {
      this.#feedback.setText('超越！').setColor('#fff29a').setVisible(true)
    } else if (lastEvent?.kind === 'OTHER_HAND_HINT' && age < 850) {
      this.#feedback.setText('換另一手').setColor('#bffaff').setFontSize(58).setVisible(true)
    } else if (state.swimmingPhase === 'FINAL_SPLASH' && state.elapsedMs - SWIMMING_RULES.finalSplashStartMs < 1_400) {
      this.#feedback.setText('FINAL SPLASH!').setColor('#ffb4dc').setFontSize(82).setVisible(true)
    } else {
      this.#feedback.setFontSize(82).setVisible(false)
    }
    this.#instruction.setText(`第 ${state.playerRank} 名　速度 ${state.speedMeter}　左右手交替划水！`).setVisible(true)
  }
}
