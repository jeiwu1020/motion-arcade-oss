import Phaser from 'phaser'

import {
  VOCAL_HOP_RULES,
  type VocalHopGameplayPhase,
  type VocalHopObstacle,
  type VocalHopState,
} from './VocalHopCore'
import type { VocalHopSession } from './VocalHopSession'

const WIDTH = 1280
const HEIGHT = 720
const GROUND_Y = 570
const AVATAR_X = 220

const PHASE_LABEL: Readonly<Record<VocalHopGameplayPhase, string>> = {
  WARM_UP: 'WARM UP',
  HOP_RUN: 'HOP RUN',
  SKY_PATH: 'SKY PATH',
  FINAL_HOP: 'FINAL HOP!',
}

const PHASE_COLOR: Readonly<Record<VocalHopGameplayPhase, number>> = {
  WARM_UP: 0x79e6d0,
  HOP_RUN: 0x78d8ff,
  SKY_PATH: 0xffd169,
  FINAL_HOP: 0xff709d,
}

/** Phaser projection only; VocalHopCore owns timing, physics, and collisions. */
export class VocalHopScene extends Phaser.Scene {
  readonly #session: VocalHopSession
  #world!: Phaser.GameObjects.Graphics
  #actors!: Phaser.GameObjects.Graphics
  #effects!: Phaser.GameObjects.Graphics
  #countdown!: Phaser.GameObjects.Text
  #phaseBanner!: Phaser.GameObjects.Text
  #feedback!: Phaser.GameObjects.Text
  #instruction!: Phaser.GameObjects.Text
  #voiceMeter!: Phaser.GameObjects.Text

  constructor(session: VocalHopSession) {
    super('vocal-hop')
    this.#session = session
  }

  create(): void {
    this.#world = this.add.graphics().setDepth(0)
    this.#actors = this.add.graphics().setDepth(2)
    this.#effects = this.add.graphics().setDepth(4)
    this.#countdown = this.add.text(WIDTH / 2, HEIGHT / 2 - 30, '', {
      color: '#ffffff', fontFamily: 'system-ui, sans-serif', fontSize: '190px',
      fontStyle: 'bold', stroke: '#152344', strokeThickness: 18,
    }).setOrigin(0.5).setDepth(12)
    this.#phaseBanner = this.add.text(WIDTH / 2, 72, '', {
      color: '#ffffff', fontFamily: 'system-ui, sans-serif', fontSize: '58px',
      fontStyle: 'bold', stroke: '#152344', strokeThickness: 12,
    }).setOrigin(0.5).setDepth(10)
    this.#feedback = this.add.text(WIDTH / 2, 290, '', {
      color: '#fff4a8', fontFamily: 'system-ui, sans-serif', fontSize: '82px',
      fontStyle: 'bold', stroke: '#152344', strokeThickness: 14,
    }).setOrigin(0.5).setDepth(12)
    this.#instruction = this.add.text(WIDTH / 2, 680, '', {
      color: '#eaffff', fontFamily: 'system-ui, sans-serif', fontSize: '25px',
      fontStyle: 'bold', stroke: '#152344', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(8)
    this.#voiceMeter = this.add.text(28, 30, '', {
      color: '#ffffff', fontFamily: 'system-ui, sans-serif', fontSize: '25px',
      fontStyle: 'bold', stroke: '#152344', strokeThickness: 7,
    }).setDepth(9)
  }

  update(): void {
    const state = this.#session.getState()
    this.#drawWorld(state)
    this.#drawActors(state)
    this.#effects.clear()
    this.#drawEffects(state)
    this.#updateText(state)
  }

  #drawWorld(state: VocalHopState): void {
    const g = this.#world
    g.clear()
    const rush = state.gamePhase === 'FINAL_HOP'
    const pulse = 0.5 + 0.5 * Math.sin(state.elapsedMs / (rush ? 85 : 190))
    g.fillStyle(rush ? 0x32163e : 0x102650, 1)
    g.fillRect(0, 0, WIDTH, HEIGHT)
    g.fillStyle(rush ? 0xe45b98 : 0x3c8bb3, 0.2 + pulse * 0.08)
    g.fillCircle(1080, 120, 170 + pulse * (rush ? 28 : 10))
    g.fillStyle(0x1c4c72, 0.75)
    for (let i = 0; i < 9; i += 1) {
      const x = ((i * 183 - state.horizontalProgress * 95) % 1450 + 1450) % 1450 - 90
      g.fillRoundedRect(x, 125 + (i % 3) * 45, 130, 22, 11)
    }
    g.fillStyle(rush ? 0x4c265d : 0x1b5e6b, 1)
    g.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y)
    g.fillStyle(rush ? 0xff7f9e : 0x6ad1b7, 0.85)
    g.fillRect(0, GROUND_Y - 12, WIDTH, 12)
    for (let x = -80; x < WIDTH + 120; x += 120) {
      const offset = ((state.horizontalProgress * 260) % 120)
      g.fillStyle(0x9df5d6, 0.22)
      g.fillRect(x - offset, GROUND_Y + 65, 72, 9)
    }
    const pending = state.course.filter((obstacle) => obstacle.resolution === 'PENDING')
    for (const obstacle of pending.slice(0, 6)) this.#drawObstacle(g, obstacle, state)
  }

  #drawObstacle(g: Phaser.GameObjects.Graphics, obstacle: VocalHopObstacle, state: VocalHopState): void {
    const until = obstacle.targetTimeMs - state.elapsedMs
    const x = AVATAR_X + 280 + (until / VOCAL_HOP_RULES.visualLeadMs) * 520
    if (x < AVATAR_X - 40 || x > WIDTH + 160) return
    const color = obstacle.type === 'STAR_GATE' ? 0xffe27a : obstacle.type === 'HIGH_BLOCK' ? 0xff7d70 : obstacle.type === 'GAP' ? 0x281b51 : 0xffb76d
    if (obstacle.type === 'GAP') {
      g.fillStyle(color, 1)
      g.fillRect(x - 58, GROUND_Y, 116, HEIGHT - GROUND_Y)
      g.lineStyle(5, 0xfcc7ff, 0.8)
      g.lineBetween(x - 58, GROUND_Y, x + 58, GROUND_Y)
      return
    }
    if (obstacle.type === 'STAR_GATE') {
      g.lineStyle(12, color, 0.95)
      g.strokeCircle(x, GROUND_Y - 145, 42)
      g.fillStyle(color, 0.95)
      g.fillTriangle(x, GROUND_Y - 190, x + 14, GROUND_Y - 155, x + 50, GROUND_Y - 155)
      g.fillTriangle(x, GROUND_Y - 100, x - 14, GROUND_Y - 135, x - 50, GROUND_Y - 135)
      return
    }
    const height = obstacle.type === 'HIGH_BLOCK' ? 142 : 82
    g.fillStyle(color, 1)
    g.fillRoundedRect(x - 48, GROUND_Y - height, 96, height, 18)
    g.fillStyle(0x31264a, 0.55)
    g.fillRect(x - 34, GROUND_Y - height + 18, 68, 12)
  }

  #drawActors(state: VocalHopState): void {
    const g = this.#actors
    g.clear()
    const y = GROUND_Y + state.verticalPosition * 150
    const airborne = state.hopState === 'AIRBORNE'
    const stumble = state.hopState === 'STUMBLE'
    const bob = airborne || stumble ? 0 : Math.sin(state.elapsedMs / 95) * 6
    g.fillStyle(0x081c37, 0.45)
    g.fillEllipse(AVATAR_X, GROUND_Y + 16, airborne ? 92 : 142, 24)
    if (airborne && state.voiceLiftLevel > 0) {
      g.lineStyle(12 + state.voiceLiftLevel * 14, 0x79f1e0, 0.24)
      g.strokeCircle(AVATAR_X, y - 58, 78 + state.voiceLiftLevel * 20)
    }
    g.fillStyle(stumble ? 0xff876d : 0xffc36b, 1)
    g.fillCircle(AVATAR_X, y - 125 + bob, 31)
    g.fillStyle(stumble ? 0xa94362 : 0x6ce0d0, 1)
    g.fillRoundedRect(AVATAR_X - 42, y - 94 + bob, 84, 104, 26)
    g.lineStyle(16, 0x213462, 1)
    const legTilt = airborne ? 26 : Math.sin(state.elapsedMs / 90) * 19
    g.lineBetween(AVATAR_X - 20, y + 2 + bob, AVATAR_X - 30 - legTilt, y + 67)
    g.lineBetween(AVATAR_X + 20, y + 2 + bob, AVATAR_X + 30 + legTilt, y + 67)
    g.lineStyle(13, 0xffc36b, 1)
    const arm = stumble ? 0.75 : airborne ? -0.7 : Math.sin(state.elapsedMs / 90) * 0.45
    g.lineBetween(AVATAR_X - 36, y - 65 + bob, AVATAR_X - 78, y - 24 + arm * 34 + bob)
    g.lineBetween(AVATAR_X + 36, y - 65 + bob, AVATAR_X + 78, y - 24 - arm * 34 + bob)
  }

  #drawEffects(state: VocalHopState): void {
    const g = this.#effects
    const pulse = 0.5 + 0.5 * Math.sin(state.elapsedMs / 120)
    g.lineStyle(5, PHASE_COLOR[state.gamePhase], 0.22 + pulse * 0.18)
    g.strokeCircle(AVATAR_X, GROUND_Y - 58 + state.verticalPosition * 150, 90 + pulse * 22)
    for (const event of state.presentationEvents) {
      if (event.kind === 'HOP_START') {
        g.lineStyle(8, 0x9bfff0, 0.7)
        g.strokeCircle(AVATAR_X, GROUND_Y - 55 + state.verticalPosition * 150, 105)
      } else if (event.kind === 'STUMBLE') {
        g.lineStyle(12, 0xff9b78, 0.8)
        g.strokeCircle(AVATAR_X, GROUND_Y - 55, 92)
      }
    }
  }

  #updateText(state: VocalHopState): void {
    this.#countdown.setText(state.phase === 'COUNTDOWN' ? String(Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000))) : '')
    this.#phaseBanner.setText(state.phase === 'PLAYING' ? PHASE_LABEL[state.gamePhase] : '')
    const latest = state.presentationEvents[state.presentationEvents.length - 1]
    this.#feedback.setText(
      latest?.kind === 'STUMBLE' ? 'SAFE RESET' :
        latest?.kind === 'STAR_COLLECT' ? '+100 STAR' :
          latest?.kind === 'OBSTACLE_CLEAR' ? 'CLEAR!' : '',
    )
    this.#instruction.setText(state.phase === 'COUNTDOWN' ? '發出舒服的聲音，讓角色跳起來！' : 'V：發聲跳躍　聲音清楚就好，不必大喊')
    this.#voiceMeter.setText(`聲音  ${Math.round(state.voiceLiftLevel * 100)}`)
  }
}
