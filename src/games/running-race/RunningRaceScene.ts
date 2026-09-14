import Phaser from 'phaser'

import {
  RUNNING_RACE_RULES,
  type RunningAiRunner,
  type RunningRaceGameplayPhase,
  type RunningRaceParticipantId,
  type RunningRaceState,
  type RunningStepSide,
} from './RunningRaceCore'
import type { RunningRaceSession } from './RunningRaceSession'

const WIDTH = 1280
const HEIGHT = 720
const LANE_X: Readonly<Record<RunningRaceParticipantId, number>> = {
  PLAYER: 190,
  STEADY: 490,
  BURST: 790,
  FINISHER: 1_090,
}
const PHASE_LABEL: Readonly<Record<RunningRaceGameplayPhase, string>> = {
  START: 'START',
  PACE: 'PACE',
  CHASE: 'CHASE',
  FINAL_SPRINT: 'FINAL SPRINT!',
}
const PHASE_COLOR: Readonly<Record<RunningRaceGameplayPhase, number>> = {
  START: 0x76e8cb,
  PACE: 0x6dc8ff,
  CHASE: 0xffd369,
  FINAL_SPRINT: 0xff6fae,
}

/** Read-only Phaser projection of Running Race state. */
export class RunningRaceScene extends Phaser.Scene {
  readonly #session: RunningRaceSession
  #world!: Phaser.GameObjects.Graphics
  #runners!: Phaser.GameObjects.Graphics
  #effects!: Phaser.GameObjects.Graphics
  #countdown!: Phaser.GameObjects.Text
  #phaseBanner!: Phaser.GameObjects.Text
  #feedback!: Phaser.GameObjects.Text
  #instruction!: Phaser.GameObjects.Text

  constructor(session: RunningRaceSession) {
    super('running-race')
    this.#session = session
  }

  create(): void {
    this.#world = this.add.graphics().setDepth(0)
    this.#runners = this.add.graphics().setDepth(2)
    this.#effects = this.add.graphics().setDepth(4)
    this.#countdown = this.add.text(WIDTH / 2, HEIGHT / 2 - 20, '', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '190px',
      fontStyle: 'bold',
      stroke: '#132548',
      strokeThickness: 18,
    }).setOrigin(0.5).setDepth(10)
    this.#phaseBanner = this.add.text(WIDTH / 2, 82, '', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '62px',
      fontStyle: 'bold',
      stroke: '#122342',
      strokeThickness: 12,
    }).setOrigin(0.5).setDepth(9)
    this.#feedback = this.add.text(WIDTH / 2, 300, '', {
      color: '#fff0a0',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '84px',
      fontStyle: 'bold',
      stroke: '#122342',
      strokeThickness: 14,
    }).setOrigin(0.5).setDepth(10)
    this.#instruction = this.add.text(WIDTH / 2, 682, '', {
      color: '#e8fbff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '25px',
      fontStyle: 'bold',
      stroke: '#102442',
      strokeThickness: 7,
    }).setOrigin(0.5).setDepth(8)
  }

  update(): void {
    const state = this.#session.getState()
    this.#drawTrack(state)
    this.#drawRunners(state)
    this.#effects.clear()
    this.#drawEffects(state)
    this.#updateText(state)
  }

  #drawTrack(state: RunningRaceState): void {
    const graphics = this.#world
    graphics.clear()
    const rush = state.racePhase === 'FINAL_SPRINT'
    const pulse = rush ? 0.5 + 0.5 * Math.sin(state.elapsedMs / 95) : 0
    const phaseColor = PHASE_COLOR[state.racePhase]
    graphics.fillStyle(rush ? 0x2e153b : 0x071a35, 1)
    graphics.fillRect(0, 0, WIDTH, HEIGHT)
    graphics.fillStyle(rush ? 0xff4f9f : 0x54d7c3, 0.1 + pulse * 0.16)
    graphics.fillCircle(rush ? 1100 : 160, 120, 220 + pulse * 40)
    graphics.fillStyle(rush ? 0x54264e : 0x153a56, 1)
    graphics.fillTriangle(70, 140, WIDTH - 70, 140, WIDTH - 5, HEIGHT)
    graphics.fillTriangle(70, 140, WIDTH - 5, HEIGHT, 5, HEIGHT)
    graphics.lineStyle(rush ? 9 : 6, phaseColor, 0.76)
    graphics.lineBetween(70, 140, WIDTH - 70, 140)
    graphics.lineBetween(70, 140, 5, HEIGHT)
    graphics.lineBetween(WIDTH - 70, 140, WIDTH - 5, HEIGHT)
    graphics.lineBetween(5, HEIGHT, WIDTH - 5, HEIGHT)

    const roadProgress = (state.elapsedMs % 1_600) / 1_600
    for (let lane = 0; lane < 5; lane += 1) {
      const x = 190 + lane * 225
      graphics.lineStyle(4, 0xb8e7ed, 0.38)
      graphics.lineBetween(x, 168, x + (lane - 2) * 28, HEIGHT)
    }
    for (let stripe = 0; stripe < 9; stripe += 1) {
      const depth = (stripe / 9 + roadProgress) % 1
      const y = 180 + Math.pow(depth, 1.6) * 510
      const halfWidth = 110 + depth * 420
      graphics.lineStyle(rush ? 7 : 5, 0xffffff, 0.14 + depth * 0.22)
      graphics.lineBetween(WIDTH / 2 - halfWidth, y, WIDTH / 2 + halfWidth, y)
    }
    graphics.fillStyle(0xf6fbff, 0.9)
    graphics.fillRect(115, 160, 1_050, 7)
    graphics.fillStyle(phaseColor, 0.2 + pulse * 0.2)
    graphics.fillRoundedRect(44, 190, 255, 72, 18)
    graphics.fillRoundedRect(WIDTH - 299, 190, 255, 72, 18)
    graphics.lineStyle(3, phaseColor, 0.72)
    graphics.strokeRoundedRect(44, 190, 255, 72, 18)
    graphics.strokeRoundedRect(WIDTH - 299, 190, 255, 72, 18)
  }

  #drawRunners(state: RunningRaceState): void {
    const graphics = this.#runners
    graphics.clear()
    const playerY = this.#runnerY(state.playerProgress)
    this.#drawRunner(graphics, 'PLAYER', playerY, state.racePhase, state.latestStep?.side ?? 'LEFT', state.latestStep?.atMs ?? -10_000, state.elapsedMs)
    for (const runner of state.aiRunners) {
      this.#drawRunner(graphics, runner.id, this.#runnerY(runner.progress), state.racePhase, 'RIGHT', -10_000, state.elapsedMs, runner)
    }
    graphics.fillStyle(0x061225, 0.56)
    graphics.fillEllipse(WIDTH / 2, HEIGHT - 42, 760, 44)
  }

  #drawRunner(
    graphics: Phaser.GameObjects.Graphics,
    id: RunningRaceParticipantId,
    y: number,
    phase: RunningRaceGameplayPhase,
    stepSide: RunningStepSide,
    stepAtMs: number,
    elapsedMs: number,
    ai?: RunningAiRunner,
  ): void {
    const x = LANE_X[id]
    const isPlayer = id === 'PLAYER'
    const color = isPlayer ? (phase === 'FINAL_SPRINT' ? 0xffc46e : 0x6ff0cf) :
      id === 'STEADY' ? 0x9bc6ff : id === 'BURST' ? 0xffdc72 : 0xff91ba
    const recentStep = isPlayer && elapsedMs - stepAtMs < 650
    const stride = recentStep ? (stepSide === 'LEFT' ? 1 : -1) * 15 : 0
    graphics.fillStyle(0x081325, 0.62)
    graphics.fillEllipse(x, y + 38, 112, 24)
    graphics.fillStyle(0x09162c, 0.96)
    graphics.fillCircle(x, y - 54, 22)
    graphics.fillStyle(color, 0.96)
    graphics.fillRoundedRect(x - 33, y - 32, 66, 68, 18)
    graphics.lineStyle(9, color, 0.92)
    graphics.lineBetween(x - 24, y - 12, x - 64 - stride, y + 20)
    graphics.lineBetween(x + 24, y - 12, x + 64 + stride, y + 20)
    graphics.lineStyle(11, color, 0.92)
    graphics.lineBetween(x - 16, y + 35, x - 28 + stride, y + 76)
    graphics.lineBetween(x + 16, y + 35, x + 28 - stride, y + 76)
    if (isPlayer) {
      graphics.lineStyle(4, 0xffffff, 0.7)
      graphics.strokeCircle(x, y - 54, 28)
    }
    if (ai) {
      graphics.fillStyle(0x061225, 0.8)
      graphics.fillRoundedRect(x - 68, y + 55, 136, 25, 10)
    }
  }

  #runnerY(progress: number): number {
    return 610 - Phaser.Math.Clamp(progress / RUNNING_RACE_RULES.roundMs, 0, 0.78) * 450
  }

  #drawEffects(state: RunningRaceState): void {
    const graphics = this.#effects
    const rush = state.racePhase === 'FINAL_SPRINT'
    const stepAge = state.latestStep ? state.elapsedMs - state.latestStep.atMs : Number.POSITIVE_INFINITY
    if (stepAge >= 0 && stepAge < 430) {
      const x = LANE_X.PLAYER + (state.latestStep?.side === 'LEFT' ? -66 : 66)
      graphics.lineStyle(rush ? 13 : 8, rush ? 0xffd279 : 0x8dfff0, 0.72)
      graphics.arc(x, 545, 64, state.latestStep?.side === 'LEFT' ? 3.7 : 5.7, state.latestStep?.side === 'LEFT' ? 5.7 : 7.7, false)
    }
    if (rush) {
      for (let line = 0; line < 8; line += 1) {
        const x = 90 + ((line * 173 + state.elapsedMs * 0.8) % 1_080)
        graphics.lineStyle(5, 0xff8eba, 0.28)
        graphics.lineBetween(x, 310 + (line % 3) * 55, x - 60, 310 + (line % 3) * 55)
      }
    }
  }

  #updateText(state: RunningRaceState): void {
    if (state.phase === 'COUNTDOWN') {
      this.#countdown.setText(String(Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000)))).setVisible(true)
      this.#phaseBanner.setVisible(false)
      this.#feedback.setVisible(false)
      this.#instruction.setText('左右交替抬膝，保持節奏追上對手！').setVisible(true)
      return
    }
    this.#countdown.setVisible(false)
    if (state.phase === 'FINISHED') {
      this.#phaseBanner.setText('RACE COMPLETE').setColor('#fff08a').setVisible(true)
      this.#feedback.setText(`第 ${state.finalPlace} 名`).setColor('#fff0a0').setVisible(true)
      this.#instruction.setText('60 秒完成！看看你的遊戲排名。').setVisible(true)
      return
    }
    const phaseColor = Phaser.Display.Color.IntegerToColor(PHASE_COLOR[state.racePhase]).rgba
    this.#phaseBanner.setText(PHASE_LABEL[state.racePhase]).setColor(phaseColor).setVisible(true)
    const newestOvertake = state.overtakeEvents.at(-1)
    const overtakeAge = newestOvertake ? state.elapsedMs - newestOvertake.atMs : Number.POSITIVE_INFINITY
    if (newestOvertake && overtakeAge >= 0 && overtakeAge < 1_050) {
      this.#feedback.setText('超車！').setColor('#fff0a0').setVisible(true)
    } else if (state.racePhase === 'FINAL_SPRINT' && state.elapsedMs - RUNNING_RACE_RULES.finalSprintStartMs < 1_400) {
      this.#feedback.setText('FINAL SPRINT!').setColor('#ffb0d0').setVisible(true)
    } else {
      this.#feedback.setVisible(false)
    }
    this.#instruction.setText(`第 ${state.playerRank} 名　速度 ${state.speedMeter}　左右交替抬膝！`).setVisible(true)
  }
}
