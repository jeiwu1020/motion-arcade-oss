import Phaser from 'phaser'

import {
  RUNNER_RULES,
  type RunnerLane,
  type RunnerObstacle,
  type RunnerState,
} from './RunnerCore'
import type { RunnerSession } from './RunnerSession'

const WIDTH = 1280
const HEIGHT = 720
const HORIZON_Y = 145
const ROAD_BOTTOM_Y = 735
const LOOK_AHEAD_MS = 6_000
const LANE_OFFSETS: Readonly<Record<RunnerLane, number>> = {
  LEFT: -1,
  CENTER: 0,
  RIGHT: 1,
}

/** Phaser projects immutable Runner Core state into an opaque arcade course. */
export class RunnerScene extends Phaser.Scene {
  readonly #session: RunnerSession
  #world!: Phaser.GameObjects.Graphics
  #obstacles!: Phaser.GameObjects.Graphics
  #avatar!: Phaser.GameObjects.Graphics
  #countdown!: Phaser.GameObjects.Text
  #instruction!: Phaser.GameObjects.Text
  #phaseBanner!: Phaser.GameObjects.Text
  #feedback!: Phaser.GameObjects.Text

  constructor(session: RunnerSession) {
    super('runner')
    this.#session = session
  }

  create(): void {
    this.#world = this.add.graphics().setDepth(0)
    this.#obstacles = this.add.graphics().setDepth(2)
    this.#avatar = this.add.graphics().setDepth(4)
    this.#countdown = this.add.text(WIDTH / 2, HEIGHT / 2 - 24, '', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '190px',
      fontStyle: 'bold',
      stroke: '#18245b',
      strokeThickness: 18,
    }).setOrigin(0.5).setDepth(8)
    this.#instruction = this.add.text(WIDTH / 2, 68, '', {
      align: 'center',
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '42px',
      fontStyle: 'bold',
      stroke: '#10234c',
      strokeThickness: 10,
    }).setOrigin(0.5).setDepth(7)
    this.#phaseBanner = this.add.text(WIDTH / 2, 146, '', {
      color: '#ffe66f',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '74px',
      fontStyle: 'bold',
      stroke: '#7a214e',
      strokeThickness: 14,
    }).setOrigin(0.5).setDepth(9)
    this.#feedback = this.add.text(WIDTH / 2, 245, '', {
      color: '#72f1be',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '82px',
      fontStyle: 'bold',
      stroke: '#102f42',
      strokeThickness: 14,
    }).setOrigin(0.5).setDepth(10)
  }

  update(): void {
    const state = this.#session.getState()
    this.#drawWorld(state)
    this.#drawObstacles(state)
    this.#drawAvatar(state)
    this.#updateText(state)
  }

  #drawWorld(state: RunnerState): void {
    const graphics = this.#world
    graphics.clear()
    const finalRush = state.gameplayPhase === 'FINAL_RUSH'
    graphics.fillStyle(finalRush ? 0x241346 : 0x0a2148, 1)
    graphics.fillRect(0, 0, WIDTH, HEIGHT)

    graphics.fillStyle(finalRush ? 0xff4f82 : 0xffb74f, 0.95)
    graphics.fillCircle(1020, 105, finalRush ? 72 : 55)
    graphics.fillStyle(0x173866, 1)
    graphics.fillTriangle(0, HORIZON_Y + 75, 250, 42, 470, HORIZON_Y + 75)
    graphics.fillTriangle(260, HORIZON_Y + 75, 545, 74, 760, HORIZON_Y + 75)
    graphics.fillTriangle(690, HORIZON_Y + 75, 980, 38, WIDTH, HORIZON_Y + 75)
    graphics.fillStyle(finalRush ? 0x5e2264 : 0x164c63, 1)
    graphics.fillRect(0, HORIZON_Y + 60, WIDTH, HEIGHT - HORIZON_Y)

    graphics.fillStyle(0x111a34, 1)
    graphics.fillTriangle(WIDTH / 2 - 145, HORIZON_Y, 105, ROAD_BOTTOM_Y, WIDTH - 105, ROAD_BOTTOM_Y)
    graphics.fillStyle(finalRush ? 0xff4f82 : 0x25c2c8, 0.45)
    graphics.fillTriangle(WIDTH / 2 - 160, HORIZON_Y, 74, ROAD_BOTTOM_Y, 105, ROAD_BOTTOM_Y)
    graphics.fillTriangle(WIDTH / 2 + 160, HORIZON_Y, WIDTH - 74, ROAD_BOTTOM_Y, WIDTH - 105, ROAD_BOTTOM_Y)

    const roadSpeed = this.#roadSpeed(state)
    const dashOffset = ((state.elapsedMs * roadSpeed) / 1_000) % 1
    for (const side of [-1, 1]) {
      for (let dash = 0; dash < 9; dash += 1) {
        const depth = (dash / 9 + dashOffset) % 1
        const nextDepth = Math.min(1, depth + 0.055 + depth * 0.025)
        const start = this.#roadPoint(side / 3, depth)
        const end = this.#roadPoint(side / 3, nextDepth)
        graphics.lineStyle(5 + depth * 7, 0xf6f2d5, 0.78)
        graphics.lineBetween(start.x, start.y, end.x, end.y)
      }
    }

    if (finalRush) {
      for (let index = 0; index < 14; index += 1) {
        const y = 190 + index * 38
        const length = 70 + (index % 3) * 35
        graphics.lineStyle(5, index % 2 === 0 ? 0xffdf6f : 0xff67a1, 0.62)
        graphics.lineBetween(12, y, 12 + length, y - 22)
        graphics.lineBetween(WIDTH - 12, y, WIDTH - 12 - length, y - 22)
      }
    }
  }

  #drawObstacles(state: RunnerState): void {
    const graphics = this.#obstacles
    graphics.clear()
    for (const obstacle of state.obstacles.slice(state.nextObstacleIndex)) {
      const timeUntil = obstacle.encounterMs - state.elapsedMs
      if (timeUntil < -80) continue
      if (timeUntil > LOOK_AHEAD_MS) break
      const depth = Phaser.Math.Clamp(1 - timeUntil / LOOK_AHEAD_MS, 0, 1)
      const y = HORIZON_Y + Math.pow(depth, 1.7) * (ROAD_BOTTOM_Y - HORIZON_Y - 40)
      const scale = 0.25 + depth * 1.05
      this.#drawObstacle(graphics, obstacle, y, scale, depth)
    }
  }

  #drawObstacle(
    graphics: Phaser.GameObjects.Graphics,
    obstacle: RunnerObstacle,
    y: number,
    scale: number,
    depth: number,
  ): void {
    if (obstacle.type === 'LANE_GATE') {
      for (const lane of ['LEFT', 'CENTER', 'RIGHT'] as const) {
        const x = this.#laneX(lane, depth)
        const width = 150 * scale
        const height = 125 * scale
        if (lane === obstacle.safeLane) {
          graphics.fillStyle(0x65f3b8, 0.2)
          graphics.fillRoundedRect(x - width / 2, y - height, width, height, 18 * scale)
          graphics.lineStyle(Math.max(3, 7 * scale), 0x65f3b8, 0.95)
          graphics.strokeRoundedRect(x - width / 2, y - height, width, height, 18 * scale)
        } else {
          graphics.fillStyle(0xff496c, 0.96)
          graphics.fillRoundedRect(x - width / 2, y - height, width, height, 15 * scale)
          graphics.lineStyle(Math.max(3, 8 * scale), 0xffd0d8, 0.9)
          graphics.lineBetween(x - width * 0.34, y - height * 0.72, x + width * 0.34, y - height * 0.28)
          graphics.lineBetween(x + width * 0.34, y - height * 0.72, x - width * 0.34, y - height * 0.28)
        }
      }
      return
    }

    const left = this.#laneX('LEFT', depth) - 100 * scale
    const right = this.#laneX('RIGHT', depth) + 100 * scale
    if (obstacle.type === 'LOW_HURDLE') {
      graphics.fillStyle(0xffc857, 1)
      graphics.fillRoundedRect(left, y - 54 * scale, right - left, 48 * scale, 12 * scale)
      graphics.fillStyle(0xffffff, 0.9)
      graphics.fillRect(left, y - 44 * scale, right - left, 9 * scale)
      graphics.fillStyle(0xff8b3d, 1)
      graphics.fillRect(left + 28 * scale, y - 58 * scale, 26 * scale, 70 * scale)
      graphics.fillRect(right - 54 * scale, y - 58 * scale, 26 * scale, 70 * scale)
      return
    }

    graphics.fillStyle(0x8c6cff, 1)
    graphics.fillRect(left, y - 220 * scale, 35 * scale, 225 * scale)
    graphics.fillRect(right - 35 * scale, y - 220 * scale, 35 * scale, 225 * scale)
    graphics.fillRoundedRect(left, y - 220 * scale, right - left, 58 * scale, 14 * scale)
    graphics.lineStyle(Math.max(3, 7 * scale), 0xe8dcff, 0.9)
    graphics.lineBetween(left + 20 * scale, y - 190 * scale, right - 20 * scale, y - 190 * scale)
  }

  #drawAvatar(state: RunnerState): void {
    const graphics = this.#avatar
    graphics.clear()
    const laneX = this.#avatarLaneX(state)
    const runCycle = Math.sin(state.elapsedMs / 95)
    const jumpProgress = state.jumpElapsedMs === null
      ? 0
      : state.jumpElapsedMs / RUNNER_RULES.jumpDurationMs
    const jumpOffset = state.jumpElapsedMs === null
      ? 0
      : Math.sin(jumpProgress * Math.PI) * 165
    const ducking = state.duckElapsedMs !== null
    const stumbling = state.stumbleRemainingMs > 0
    const finished = state.phase === 'FINISHED'
    const bob = state.phase === 'PLAYING' && !ducking ? runCycle * 8 : 0
    const baseY = 610 - jumpOffset + bob
    const tilt = stumbling
      ? Math.sin(state.stumbleRemainingMs / 45) * 0.25
      : state.laneTransition
        ? (state.laneTransition.to === 'LEFT' ? -0.12 : 0.12)
        : 0

    graphics.fillStyle(0x020817, 0.42)
    graphics.fillEllipse(laneX, 638, 155 - jumpOffset * 0.35, 34)
    graphics.save()
    graphics.translateCanvas(laneX, baseY)
    graphics.rotateCanvas(tilt)
    graphics.fillStyle(stumbling ? 0xff5a70 : 0x5cf0be, 1)

    if (ducking) {
      graphics.fillRoundedRect(-48, -90, 96, 78, 24)
      graphics.fillCircle(42, -76, 31)
      graphics.lineStyle(22, 0xffd2ad, 1)
      graphics.lineBetween(-24, -30, -70, 5)
      graphics.lineBetween(22, -28, 70, -4)
      graphics.lineStyle(27, 0x4e74ff, 1)
      graphics.lineBetween(-20, -12, -58, 38)
      graphics.lineBetween(18, -12, 58, 38)
    } else {
      graphics.fillRoundedRect(-42, -160, 84, 112, 28)
      graphics.fillStyle(0xffd2ad, 1)
      graphics.fillCircle(0, -195, 36)
      graphics.lineStyle(22, 0xffd2ad, 1)
      const armSwing = finished ? 62 : runCycle * 34
      graphics.lineBetween(-28, -135, -68, -112 - armSwing)
      graphics.lineBetween(28, -135, 68, -112 + armSwing)
      graphics.lineStyle(29, 0x4e74ff, 1)
      const legSwing = finished ? 8 : runCycle * 28
      graphics.lineBetween(-18, -52, -45, 12 + legSwing)
      graphics.lineBetween(18, -52, 45, 12 - legSwing)
      graphics.lineStyle(13, 0xffffff, 1)
      graphics.lineBetween(-48, 14 + legSwing, -74, 14 + legSwing)
      graphics.lineBetween(48, 14 - legSwing, 74, 14 - legSwing)
    }
    graphics.restore()
  }

  #updateText(state: RunnerState): void {
    if (state.phase === 'COUNTDOWN') {
      const countdown = Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000))
      this.#countdown.setText(String(countdown)).setVisible(true)
      this.#instruction.setText('準備衝刺！').setVisible(true)
      this.#phaseBanner.setVisible(false)
      this.#feedback.setVisible(false)
      return
    }
    this.#countdown.setVisible(false)
    if (state.phase === 'FINISHED') {
      this.#instruction.setText('FINISH!').setVisible(true)
      this.#phaseBanner.setText('完成！').setVisible(true)
      this.#feedback.setVisible(false)
      return
    }

    const nextObstacle = state.obstacles[state.nextObstacleIndex]
    const timeUntil = nextObstacle ? nextObstacle.encounterMs - state.elapsedMs : Number.POSITIVE_INFINITY
    const instruction = timeUntil <= 3_200 && nextObstacle
      ? nextObstacle.type === 'LANE_GATE'
        ? `安全跑道：${this.#laneLabel(nextObstacle.safeLane)}`
        : nextObstacle.type === 'LOW_HURDLE'
          ? '跳！ JUMP'
          : '蹲下！ DUCK'
      : state.gameplayPhase === 'WARM_UP'
        ? '看清障礙，準備動作'
        : '保持節奏！'
    this.#instruction.setText(instruction).setVisible(true)

    const finalRushAge = state.elapsedMs - RUNNER_RULES.challengeEndMs
    this.#phaseBanner
      .setText('FINAL RUSH!')
      .setVisible(state.gameplayPhase === 'FINAL_RUSH' && finalRushAge < 1_500)

    const feedbackAge = state.lastEncounter
      ? state.elapsedMs - state.lastEncounter.atMs
      : Number.POSITIVE_INFINITY
    if (state.lastEncounter && feedbackAge >= 0 && feedbackAge < 650) {
      const cleared = state.lastEncounter.outcome === 'CLEARED'
      this.#feedback
        .setText(cleared ? `✓ +${state.lastEncounter.scoreAward}` : '撞到了！繼續跑！')
        .setColor(cleared ? '#72f1be' : '#ff7189')
        .setVisible(true)
    } else {
      this.#feedback.setVisible(false)
    }
  }

  #roadSpeed(state: RunnerState): number {
    switch (state.gameplayPhase) {
      case 'WARM_UP': return 0.72
      case 'FLOW': return 0.9
      case 'CHALLENGE': return 1.08
      case 'FINAL_RUSH': return 1.42
    }
  }

  #roadPoint(laneOffset: number, depth: number): { readonly x: number; readonly y: number } {
    const y = HORIZON_Y + Math.pow(depth, 1.6) * (ROAD_BOTTOM_Y - HORIZON_Y)
    const halfWidth = Phaser.Math.Linear(145, 535, depth)
    return { x: WIDTH / 2 + halfWidth * laneOffset * 2, y }
  }

  #laneX(lane: RunnerLane, depth: number): number {
    const halfWidth = Phaser.Math.Linear(145, 535, depth)
    return WIDTH / 2 + LANE_OFFSETS[lane] * halfWidth * 0.63
  }

  #avatarLaneX(state: RunnerState): number {
    if (!state.laneTransition) return this.#laneX(state.lane, 1)
    const progress = Phaser.Math.Easing.Cubic.Out(
      state.laneTransition.elapsedMs / state.laneTransition.durationMs,
    )
    return Phaser.Math.Linear(
      this.#laneX(state.laneTransition.from, 1),
      this.#laneX(state.laneTransition.to, 1),
      progress,
    )
  }

  #laneLabel(lane: RunnerLane | null): string {
    if (lane === 'LEFT') return '左'
    if (lane === 'RIGHT') return '右'
    return '中間'
  }
}
