import Phaser from 'phaser'

import {
  BASEBALL_RULES,
  type BaseballGameplayPhase,
  type BaseballHitMetadata,
  type BaseballPitch,
  type BaseballState,
} from './BaseballCore'
import type { BaseballSession } from './BaseballSession'

const WIDTH = 1280
const HEIGHT = 720
const PITCHER_X = 640
const PITCHER_Y = 235
const CONTACT_X = 735
const CONTACT_Y = 515
const BATTER_X = 520
const BATTER_Y = 565

const PHASE_LABEL: Readonly<Record<BaseballGameplayPhase, string>> = {
  WARM_UP: 'WARM-UP',
  BATTING: 'BATTING',
  POWER_INNING: 'POWER INNING',
  HOME_RUN_RUSH: 'HOME RUN RUSH',
}

const PHASE_COLOR: Readonly<Record<BaseballGameplayPhase, number>> = {
  WARM_UP: 0x7be5d4,
  BATTING: 0x82d6ff,
  POWER_INNING: 0xffbd62,
  HOME_RUN_RUSH: 0xff675f,
}

const ZONE_Y = Object.freeze({ HIGH: 450, CENTER: 510, LOW: 566 })

/** Read-only Phaser projection; Baseball Core remains authoritative. */
export class BaseballScene extends Phaser.Scene {
  readonly #session: BaseballSession
  #world!: Phaser.GameObjects.Graphics
  #actors!: Phaser.GameObjects.Graphics
  #ballLayer!: Phaser.GameObjects.Graphics
  #effects!: Phaser.GameObjects.Graphics
  #countdown!: Phaser.GameObjects.Text
  #phaseBanner!: Phaser.GameObjects.Text
  #feedback!: Phaser.GameObjects.Text
  #resultCallout!: Phaser.GameObjects.Text
  #instruction!: Phaser.GameObjects.Text

  constructor(session: BaseballSession) {
    super('baseball')
    this.#session = session
  }

  create(): void {
    this.#world = this.add.graphics().setDepth(0)
    this.#actors = this.add.graphics().setDepth(2)
    this.#ballLayer = this.add.graphics().setDepth(4)
    this.#effects = this.add.graphics().setDepth(6)
    this.#countdown = this.add.text(WIDTH / 2, HEIGHT / 2, '', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '190px',
      fontStyle: 'bold',
      stroke: '#061725',
      strokeThickness: 18,
    }).setOrigin(0.5).setDepth(12)
    this.#phaseBanner = this.add.text(WIDTH / 2, 74, '', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '58px',
      fontStyle: 'bold',
      stroke: '#061725',
      strokeThickness: 12,
    }).setOrigin(0.5).setDepth(10)
    this.#feedback = this.add.text(WIDTH / 2, 298, '', {
      color: '#fff2a4',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '82px',
      fontStyle: 'bold',
      stroke: '#071725',
      strokeThickness: 14,
      align: 'center',
    }).setOrigin(0.5).setDepth(12)
    this.#resultCallout = this.add.text(WIDTH / 2, 382, '', {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '47px',
      fontStyle: 'bold',
      stroke: '#7e261d',
      strokeThickness: 10,
    }).setOrigin(0.5).setDepth(12)
    this.#instruction = this.add.text(WIDTH / 2, 681, '', {
      color: '#fff4d1',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '27px',
      fontStyle: 'bold',
      stroke: '#071725',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(10)
  }

  update(): void {
    const state = this.#session.getState()
    this.#drawStadium(state)
    this.#drawActors(state)
    this.#ballLayer.clear()
    this.#effects.clear()
    this.#drawIncomingPitch(state)
    this.#drawContactResult(state)
    this.#updateText(state)
  }

  #drawStadium(state: BaseballState): void {
    const graphics = this.#world
    graphics.clear()
    const rush = state.baseballPhase === 'HOME_RUN_RUSH'
    const pulse = 0.5 + 0.5 * Math.sin(state.elapsedMs / (rush ? 105 : 260))
    graphics.fillStyle(rush ? 0x281021 : 0x071827, 1)
    graphics.fillRect(0, 0, WIDTH, HEIGHT)

    graphics.fillStyle(rush ? 0xc1373c : 0x17374e, 0.72)
    graphics.fillRect(0, 90, WIDTH, 185)
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 22; column += 1) {
        const lit = (row * 7 + column * 3) % 5
        graphics.fillStyle(lit === 0 ? 0xffc56b : lit === 1 ? 0x72d9d0 : 0x31546b, 0.52)
        graphics.fillCircle(22 + column * 59, 118 + row * 38, 7 + pulse * (rush ? 4 : 1))
      }
    }

    for (const x of [92, 1188]) {
      graphics.fillStyle(0xe9fbff, 0.7 + pulse * (rush ? 0.3 : 0.08))
      graphics.fillRoundedRect(x - 58, 38, 116, 30, 8)
      graphics.fillStyle(rush ? 0xff665b : 0x97ecff, 0.11 + pulse * 0.12)
      graphics.fillTriangle(x - 86, 68, x + 86, 68, x, 410)
    }

    graphics.fillStyle(0x146346, 1)
    graphics.fillTriangle(0, 270, WIDTH, 270, WIDTH, HEIGHT)
    graphics.fillTriangle(0, 270, WIDTH, HEIGHT, 0, HEIGHT)
    graphics.fillStyle(0x1b7a50, 1)
    graphics.fillTriangle(140, 310, WIDTH - 140, 310, WIDTH - 60, HEIGHT)
    graphics.fillTriangle(140, 310, WIDTH - 60, HEIGHT, 60, HEIGHT)
    graphics.fillStyle(0xb77a45, 1)
    graphics.fillTriangle(640, 320, 1120, 690, 160, 690)
    graphics.fillStyle(0xc99359, 1)
    graphics.fillTriangle(640, 350, 955, 655, 325, 655)
    graphics.fillStyle(0xe7c993, 0.75)
    graphics.fillCircle(PITCHER_X, PITCHER_Y + 80, 54)
    graphics.fillStyle(0xeed9ae, 1)
    graphics.fillTriangle(CONTACT_X - 42, CONTACT_Y + 72, CONTACT_X + 42, CONTACT_Y + 72, CONTACT_X, CONTACT_Y + 100)

    graphics.lineStyle(5, 0xf6e2b8, 0.86)
    graphics.lineBetween(160, 690, 640, 350)
    graphics.lineBetween(1120, 690, 640, 350)
    graphics.lineStyle(3, 0xffffff, 0.28)
    graphics.strokeRoundedRect(CONTACT_X - 74, CONTACT_Y - 103, 148, 172, 16)
    graphics.lineStyle(6, PHASE_COLOR[state.baseballPhase], 0.45 + pulse * 0.18)
    graphics.strokeRoundedRect(CONTACT_X - 87, CONTACT_Y - 116, 174, 198, 20)
  }

  #drawActors(state: BaseballState): void {
    const graphics = this.#actors
    graphics.clear()
    const pitch = state.pitches.find((candidate) => candidate.resolution === 'PENDING')
    const windup = pitch
      ? Phaser.Math.Clamp(1 - (pitch.targetTimeMs - state.elapsedMs) / BASEBALL_RULES.visualLeadMs, 0, 1)
      : 0
    this.#drawPitcher(graphics, windup)
    this.#drawCatcher(graphics)
    this.#drawBatter(graphics, state)
  }

  #drawPitcher(graphics: Phaser.GameObjects.Graphics, windup: number): void {
    const lift = Math.sin(Phaser.Math.Clamp(windup * 1.35, 0, 1) * Math.PI) * 22
    graphics.fillStyle(0x06111d, 0.45)
    graphics.fillEllipse(PITCHER_X, PITCHER_Y + 105, 116, 24)
    graphics.fillStyle(0xf5c998, 1)
    graphics.fillCircle(PITCHER_X, PITCHER_Y, 24)
    graphics.fillStyle(0xf0f4ea, 1)
    graphics.fillRoundedRect(PITCHER_X - 38, PITCHER_Y + 22, 76, 82, 20)
    graphics.fillStyle(0x244a72, 1)
    graphics.fillRect(PITCHER_X - 38, PITCHER_Y + 68, 76, 36)
    graphics.lineStyle(12, 0xf0f4ea, 1)
    graphics.lineBetween(PITCHER_X - 28, PITCHER_Y + 43, PITCHER_X - 70, PITCHER_Y + 43 - lift)
    graphics.lineBetween(PITCHER_X + 28, PITCHER_Y + 43, PITCHER_X + 70, PITCHER_Y + 65 - lift)
    graphics.lineStyle(13, 0x244a72, 1)
    graphics.lineBetween(PITCHER_X - 18, PITCHER_Y + 100, PITCHER_X - 34, PITCHER_Y + 142)
    graphics.lineBetween(PITCHER_X + 18, PITCHER_Y + 100, PITCHER_X + 34 + lift * 0.8, PITCHER_Y + 142 - lift)
  }

  #drawCatcher(graphics: Phaser.GameObjects.Graphics): void {
    const x = CONTACT_X + 116
    const y = CONTACT_Y + 34
    graphics.fillStyle(0x06111d, 0.5)
    graphics.fillEllipse(x, y + 78, 115, 24)
    graphics.fillStyle(0xf1b07c, 1)
    graphics.fillCircle(x, y - 36, 25)
    graphics.fillStyle(0x1e4164, 1)
    graphics.fillRoundedRect(x - 43, y - 11, 86, 82, 22)
    graphics.lineStyle(12, 0x1e4164, 1)
    graphics.lineBetween(x - 28, y + 20, x - 64, y + 62)
    graphics.lineBetween(x + 28, y + 20, x + 57, y + 58)
    graphics.fillStyle(0xb86b35, 1)
    graphics.fillCircle(x - 68, y + 65, 24)
  }

  #drawBatter(graphics: Phaser.GameObjects.Graphics, state: BaseballState): void {
    const hit = state.lastHit
    const age = hit ? state.elapsedMs - hit.resolvedAtMs : Number.POSITIVE_INFINITY
    const activeSwing = hit && age >= 0 && age < 520
    const swingSide = activeSwing && hit.hand === 'LEFT' ? -1 : 1
    const swingProgress = activeSwing ? Phaser.Math.Clamp(age / 420, 0, 1) : 0
    const lean = activeSwing ? Math.sin(swingProgress * Math.PI) * 0.16 * swingSide : 0
    const x = BATTER_X
    const y = BATTER_Y
    graphics.fillStyle(0x06111d, 0.55)
    graphics.fillEllipse(x, y + 92, 175, 31)
    graphics.fillStyle(0xf0ba83, 1)
    graphics.fillCircle(x + lean * 80, y - 92, 35)
    graphics.fillStyle(state.baseballPhase === 'HOME_RUN_RUSH' ? 0xff5f57 : 0xff9a4f, 1)
    graphics.fillRoundedRect(x - 59 + lean * 60, y - 55, 118, 122, 30)
    graphics.fillStyle(0xf5f2e7, 1)
    graphics.fillRect(x - 58 + lean * 60, y + 10, 116, 42)
    graphics.lineStyle(16, 0x17324a, 1)
    graphics.lineBetween(x - 31, y + 62, x - 56, y + 121)
    graphics.lineBetween(x + 31, y + 62, x + 62, y + 121)

    const batAngle = activeSwing
      ? Phaser.Math.Linear(swingSide < 0 ? -2.55 : -0.6, swingSide < 0 ? -0.15 : -3.0, swingProgress)
      : -0.9
    const handX = x + 45
    const handY = y - 25
    graphics.lineStyle(14, 0xf0ba83, 1)
    graphics.lineBetween(x - 38, y - 22, handX - 18, handY + 8)
    graphics.lineBetween(x + 38, y - 22, handX, handY)
    graphics.lineStyle(15, 0xd8b16f, 1)
    graphics.lineBetween(
      handX,
      handY,
      handX + Math.cos(batAngle) * 170,
      handY + Math.sin(batAngle) * 170,
    )
    graphics.lineStyle(4, 0xffefc1, 0.72)
    graphics.lineBetween(
      handX,
      handY,
      handX + Math.cos(batAngle) * 168,
      handY + Math.sin(batAngle) * 168,
    )
  }

  #drawIncomingPitch(state: BaseballState): void {
    if (state.phase !== 'PLAYING') return
    const pitch = state.pitches.find((candidate) => candidate.resolution === 'PENDING')
    if (!pitch) return
    const timeUntil = pitch.targetTimeMs - state.elapsedMs
    if (timeUntil > BASEBALL_RULES.visualLeadMs || timeUntil < -BASEBALL_RULES.goodWindowMs) return
    const rawProgress = Phaser.Math.Clamp(1 - timeUntil / BASEBALL_RULES.visualLeadMs, 0, 1)
    const progress = this.#pitchVisualProgress(pitch, rawProgress)
    const zoneY = ZONE_Y[pitch.targetZone]
    const curve = pitch.type === 'CURVEBALL' ? Math.sin(progress * Math.PI) * 105 : 0
    const x = Phaser.Math.Linear(PITCHER_X, CONTACT_X, progress) + curve
    const y = Phaser.Math.Linear(PITCHER_Y + 35, zoneY, progress)
    const trailColor = pitch.type === 'FASTBALL'
      ? 0x9cecff
      : pitch.type === 'CURVEBALL'
        ? 0xff9dca
        : 0xffd175

    const trailSteps = pitch.type === 'FASTBALL' ? 6 : 4
    for (let step = trailSteps; step >= 1; step -= 1) {
      const back = Math.max(0, progress - step * 0.035)
      const backCurve = pitch.type === 'CURVEBALL' ? Math.sin(back * Math.PI) * 105 : 0
      const backX = Phaser.Math.Linear(PITCHER_X, CONTACT_X, back) + backCurve
      const backY = Phaser.Math.Linear(PITCHER_Y + 35, zoneY, back)
      this.#ballLayer.fillStyle(trailColor, 0.08 + (trailSteps - step) * 0.045)
      this.#ballLayer.fillCircle(backX, backY, 8 + back * 9)
    }
    if (pitch.type === 'CHANGEUP') {
      this.#ballLayer.lineStyle(6, trailColor, 0.35 + 0.15 * Math.sin(state.elapsedMs / 90))
      this.#ballLayer.strokeCircle(x, y, 34 + 5 * Math.sin(state.elapsedMs / 85))
    }
    this.#drawBaseball(this.#ballLayer, x, y, 17 + progress * 15)
  }

  #pitchVisualProgress(pitch: BaseballPitch, progress: number): number {
    if (pitch.type === 'FASTBALL') return Math.pow(progress, 0.78)
    if (pitch.type === 'CHANGEUP') {
      return progress < 0.58
        ? progress * 1.18
        : 0.6844 + (progress - 0.58) * 0.7514
    }
    return progress
  }

  #drawContactResult(state: BaseballState): void {
    const result = state.lastResult
    if (!result) return
    const age = state.elapsedMs - result.resolvedAtMs
    if (age < 0 || age > 1_700) return
    if (!result.hit) {
      const passProgress = Phaser.Math.Clamp(age / 650, 0, 1)
      this.#drawBaseball(
        this.#effects,
        CONTACT_X + passProgress * 130,
        CONTACT_Y + passProgress * 70,
        28 - passProgress * 7,
      )
      this.#effects.fillStyle(0xff715e, 0.18 * (1 - passProgress))
      this.#effects.fillCircle(CONTACT_X, CONTACT_Y, 50 + passProgress * 45)
      return
    }
    this.#drawBattedBall(state, result.hit, age)
  }

  #drawBattedBall(state: BaseballState, hit: BaseballHitMetadata, age: number): void {
    const duration = hit.result === 'HOME_RUN' ? 1_550 : hit.result === 'TRIPLE' ? 1_350 : 1_150
    const progress = Phaser.Math.Clamp(age / duration, 0, 1)
    const destinationX = hit.fieldDirection === 'LEFT_FIELD'
      ? 230
      : hit.fieldDirection === 'RIGHT_FIELD'
        ? 1_055
        : 660
    const resultDistance = hit.result === 'HOME_RUN'
      ? 60
      : hit.result === 'TRIPLE'
        ? 145
        : hit.result === 'DOUBLE'
          ? 225
          : 315
    const arcHeight = 105 + hit.launchArc * (hit.result === 'HOME_RUN' ? 250 : 175)
    const x = Phaser.Math.Linear(CONTACT_X, destinationX, progress)
    const y = Phaser.Math.Linear(CONTACT_Y, resultDistance, progress) - Math.sin(progress * Math.PI) * arcHeight
    const color = hit.result === 'HOME_RUN' ? 0xffe063 : hit.grade === 'PERFECT' ? 0xffb85c : 0x84e7e2
    const rushScale = state.baseballPhase === 'HOME_RUN_RUSH' ? 1.45 : 1
    this.#effects.lineStyle((hit.result === 'HOME_RUN' ? 18 : 10) * rushScale, color, 0.48)
    this.#effects.lineBetween(CONTACT_X, CONTACT_Y, x, y)
    for (let ring = 0; ring < 3; ring += 1) {
      this.#effects.lineStyle(5, color, Math.max(0, 0.55 - age / 1_100 - ring * 0.12))
      this.#effects.strokeCircle(CONTACT_X, CONTACT_Y, 34 + ring * 24 + Math.min(age, 360) * 0.16)
    }
    this.#drawBaseball(this.#effects, x, y, 31 - progress * 12)
    if (hit.result === 'HOME_RUN') {
      for (let spark = 0; spark < 14; spark += 1) {
        const angle = spark / 14 * Math.PI * 2 + age / 420
        const radius = 48 + Math.min(age, 700) * 0.13
        this.#effects.fillStyle(spark % 2 === 0 ? 0xffe063 : 0xff675f, 0.8 * (1 - progress))
        this.#effects.fillCircle(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 7)
      }
    }
  }

  #drawBaseball(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
  ): void {
    graphics.fillStyle(0x06111d, 0.46)
    graphics.fillCircle(x + 5, y + 7, radius + 3)
    graphics.fillStyle(0xfff8e8, 1)
    graphics.fillCircle(x, y, radius)
    graphics.lineStyle(Math.max(2, radius / 8), 0xd84d42, 0.9)
    graphics.arc(x - radius * 0.45, y, radius * 0.76, 5.15, 1.13, false)
    graphics.arc(x + radius * 0.45, y, radius * 0.76, 2.02, 4.27, false)
  }

  #updateText(state: BaseballState): void {
    if (state.phase === 'COUNTDOWN') {
      this.#countdown.setText(String(Math.max(1, Math.ceil(state.countdownRemainingMs / 1_000)))).setVisible(true)
      this.#phaseBanner.setVisible(false)
      this.#feedback.setVisible(false)
      this.#resultCallout.setVisible(false)
      this.#instruction.setText('看準來球，左右手都能安全空手揮棒！').setVisible(true)
      return
    }
    this.#countdown.setVisible(false)
    if (state.phase === 'FINISHED') {
      this.#phaseBanner.setText('BALLGAME COMPLETE').setColor('#ffe063').setVisible(true)
      this.#feedback.setVisible(false)
      this.#resultCallout.setVisible(false)
      this.#instruction.setText('精彩打擊！').setVisible(true)
      return
    }

    const color = Phaser.Display.Color.IntegerToColor(PHASE_COLOR[state.baseballPhase]).rgba
    this.#phaseBanner.setText(PHASE_LABEL[state.baseballPhase]).setColor(color).setVisible(true)
    const result = state.lastResult
    const age = result ? state.elapsedMs - result.resolvedAtMs : Number.POSITIVE_INFINITY
    if (result && age >= 0 && age < 1_050) {
      if (!result.hit) {
        this.#feedback.setText('MISS').setColor('#ffd0bd').setVisible(true)
        this.#resultCallout.setVisible(false)
      } else {
        this.#feedback.setText(result.hit.grade).setColor('#fff2a4').setVisible(true)
        this.#resultCallout
          .setText(this.#hitLabel(result.hit.result))
          .setColor(result.hit.result === 'HOME_RUN' ? '#ffe063' : '#ffffff')
          .setScale(result.hit.result === 'HOME_RUN' ? 1.24 : 1)
          .setVisible(true)
      }
    } else {
      this.#feedback.setVisible(false)
      this.#resultCallout.setScale(1).setVisible(false)
    }

    const pitch = state.pitches.find((candidate) => candidate.resolution === 'PENDING')
    this.#instruction.setText(pitch ? this.#pitchInstruction(pitch) : '下一球準備中！').setVisible(true)
  }

  #pitchInstruction(pitch: BaseballPitch): string {
    if (pitch.type === 'CURVEBALL') return 'CURVEBALL · 看清彎曲路徑再揮棒'
    if (pitch.type === 'CHANGEUP') return 'CHANGEUP · 等球進入打擊區'
    return 'FASTBALL · 看準打擊區揮棒'
  }

  #hitLabel(result: BaseballHitMetadata['result']): string {
    if (result === 'HOME_RUN') return 'HOME RUN!'
    if (result === 'TRIPLE') return '三壘安打！'
    if (result === 'DOUBLE') return '二壘安打！'
    return '一壘安打！'
  }
}
