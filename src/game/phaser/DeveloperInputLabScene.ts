import Phaser from 'phaser'

import type {
  MotionActionId,
  MotionActionState,
  NormalizedPoint2D,
  PlayerMotionState,
} from '../../motion/contracts/motion'
import type { TestLabMotionBridge } from './TestLabMotionBridge'

const WORLD_WIDTH = 1280
const WORLD_HEIGHT = 720

function action(player: PlayerMotionState | undefined, id: MotionActionId) {
  return player?.actions[id]
}

function numericValue(state: MotionActionState | undefined): number {
  return typeof state?.value === 'number' ? state.value : 0
}

function pointValue(
  state: MotionActionState | undefined,
): NormalizedPoint2D | undefined {
  return typeof state?.value === 'object' ? state.value : undefined
}

export class DeveloperInputLabScene extends Phaser.Scene {
  readonly #bridge: TestLabMotionBridge
  #avatar!: Phaser.GameObjects.Container
  #leftHand!: Phaser.GameObjects.Arc
  #rightHand!: Phaser.GameObjects.Arc
  #pointer!: Phaser.GameObjects.Arc
  #leftStrike!: Phaser.GameObjects.Rectangle
  #rightStrike!: Phaser.GameObjects.Rectangle
  #voiceLevelFill!: Phaser.GameObjects.Rectangle
  #voicePitchFill!: Phaser.GameObjects.Rectangle
  #activePlayerText!: Phaser.GameObjects.Text
  #lastJumpSequence = -1
  #lastLeftStrikeSequence = -1
  #lastRightStrikeSequence = -1

  constructor(bridge: TestLabMotionBridge) {
    super('developer-input-lab')
    this.#bridge = bridge
  }

  create(): void {
    this.add.rectangle(
      WORLD_WIDTH / 2,
      WORLD_HEIGHT / 2,
      WORLD_WIDTH,
      WORLD_HEIGHT,
      0x07131f,
    )

    const grid = this.add.graphics()
    grid.lineStyle(2, 0x17334a, 0.65)
    for (let x = 0; x <= WORLD_WIDTH; x += 128) {
      grid.lineBetween(x, 0, x, WORLD_HEIGHT)
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += 120) {
      grid.lineBetween(0, y, WORLD_WIDTH, y)
    }

    this.add
      .text(44, 36, 'NORMALIZED ACTION FIELD', {
        color: '#6fe3c4',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        letterSpacing: 2,
      })
      .setAlpha(0.9)

    this.#activePlayerText = this.add.text(44, 72, 'Player 1', {
      color: '#f7fbff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '34px',
      fontStyle: 'bold',
    })

    this.add.rectangle(WORLD_WIDTH / 2, 614, 1120, 10, 0x21465a)
    this.add.rectangle(WORLD_WIDTH / 2, 620, 1120, 2, 0x6fe3c4, 0.5)

    const body = this.add.rectangle(0, 0, 82, 116, 0x56a9ff).setStrokeStyle(5, 0xc8e6ff)
    const head = this.add.circle(0, -92, 34, 0xf8be62).setStrokeStyle(5, 0xffe2a6)
    this.#avatar = this.add.container(WORLD_WIDTH / 2, 548, [body, head])

    this.#leftStrike = this.add.rectangle(92, 330, 20, 176, 0xff6d88, 0.18)
    this.#rightStrike = this.add.rectangle(1188, 330, 20, 176, 0xff6d88, 0.18)
    this.add.text(42, 432, 'L STRIKE', {
      color: '#ff9aad',
      fontFamily: 'system-ui',
      fontSize: '17px',
    })
    this.add.text(1120, 432, 'R STRIKE', {
      color: '#ff9aad',
      fontFamily: 'system-ui',
      fontSize: '17px',
    })

    this.#leftHand = this.add.circle(350, 250, 22, 0xffd166, 0.9).setStrokeStyle(5, 0xffffff)
    this.#rightHand = this.add.circle(930, 250, 22, 0x9b8cff, 0.9).setStrokeStyle(5, 0xffffff)
    this.#pointer = this.add.circle(640, 360, 12, 0xffffff, 0.75).setStrokeStyle(3, 0x6fe3c4)

    this.#createMeter(860, 58, 'VOICE LEVEL', 0x6fe3c4, (fill) => {
      this.#voiceLevelFill = fill
    })
    this.#createMeter(860, 112, 'VOICE PITCH', 0x9b8cff, (fill) => {
      this.#voicePitchFill = fill
    })
  }

  update(_time: number, delta: number): void {
    const snapshot = this.#bridge.getSnapshot()
    const activePlayerId = this.#bridge.getActivePlayerId()
    const player = snapshot.players.find(
      (candidate) => candidate.playerId === activePlayerId,
    )
    if (!player) return

    this.#activePlayerText.setText(
      `${player.playerId.replace('player-', 'Player ')} · ${player.abilityProfile.profileIds.join(' + ')}`,
    )

    const left = numericValue(action(player, 'MOVE_LEFT'))
    const right = numericValue(action(player, 'MOVE_RIGHT'))
    const movementScale = player.abilityProfile.movementScale
    this.#avatar.x = Phaser.Math.Clamp(
      this.#avatar.x + (right - left) * 520 * movementScale * (delta / 1000),
      120,
      WORLD_WIDTH - 120,
    )

    const jump = action(player, 'JUMP')
    if (jump?.phase === 'started' && jump.sequence !== this.#lastJumpSequence) {
      this.#lastJumpSequence = jump.sequence
      this.tweens.killTweensOf(this.#avatar)
      this.tweens.add({
        targets: this.#avatar,
        y: 405,
        duration: 210 * player.abilityProfile.responseTimeScale,
        yoyo: true,
        ease: 'Sine.Out',
      })
    }

    this.#flashStrike(
      action(player, 'STRIKE_LEFT'),
      this.#leftStrike,
      'left',
    )
    this.#flashStrike(
      action(player, 'STRIKE_RIGHT'),
      this.#rightStrike,
      'right',
    )

    this.#positionMarker(this.#leftHand, action(player, 'HAND_POSITION_LEFT'))
    this.#positionMarker(this.#rightHand, action(player, 'HAND_POSITION_RIGHT'))
    this.#positionMarker(this.#pointer, action(player, 'POINTER_POSITION'))
    this.#setMeter(this.#voiceLevelFill, numericValue(action(player, 'VOICE_LEVEL')))
    this.#setMeter(this.#voicePitchFill, numericValue(action(player, 'VOICE_PITCH')))
  }

  #createMeter(
    x: number,
    y: number,
    label: string,
    color: number,
    receiveFill: (fill: Phaser.GameObjects.Rectangle) => void,
  ): void {
    this.add.text(x, y, label, {
      color: '#b7c9d8',
      fontFamily: 'system-ui',
      fontSize: '16px',
      fontStyle: 'bold',
    })
    this.add.rectangle(x + 300, y + 10, 250, 18, 0x102b3c).setOrigin(0, 0.5)
    const fill = this.add.rectangle(x + 300, y + 10, 1, 18, color).setOrigin(0, 0.5)
    receiveFill(fill)
  }

  #setMeter(fill: Phaser.GameObjects.Rectangle, value: number): void {
    fill.width = Math.max(1, clamp01(value) * 250)
  }

  #positionMarker(
    marker: Phaser.GameObjects.Arc,
    state: MotionActionState | undefined,
  ): void {
    const point = pointValue(state)
    if (!point) return
    marker.setPosition(point.x * WORLD_WIDTH, point.y * WORLD_HEIGHT)
  }

  #flashStrike(
    state: MotionActionState | undefined,
    marker: Phaser.GameObjects.Rectangle,
    side: 'left' | 'right',
  ): void {
    if (!state || state.phase !== 'started') return
    const previousSequence =
      side === 'left' ? this.#lastLeftStrikeSequence : this.#lastRightStrikeSequence
    if (previousSequence === state.sequence) return
    if (side === 'left') this.#lastLeftStrikeSequence = state.sequence
    else this.#lastRightStrikeSequence = state.sequence
    marker.setAlpha(1)
    this.tweens.add({ targets: marker, alpha: 0.18, duration: 260 })
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
