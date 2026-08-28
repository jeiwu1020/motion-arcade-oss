import { actionAllowedForProfile } from '../adaptive/profiles'
import { clamp01 } from '../coordinates/normalizeCoordinates'
import type {
  MotionActionId,
  MotionActionPhase,
  MotionActionState,
  MotionActionValue,
  MotionInputProvider,
  MotionInputRequest,
  MotionInputSnapshot,
  MotionPlayerRequest,
  NormalizedPoint2D,
  PlayerId,
  PlayerMotionState,
  ResolvedAbilityProfile,
} from '../contracts/motion'

export type PointerSimulationMode = 'LEFT_HAND' | 'RIGHT_HAND' | 'POINTER'

type ContinuousActionId =
  | 'VOICE_LEVEL'
  | 'VOICE_PITCH'
  | 'RUN_CADENCE'
  | 'VOICE_SUSTAINED_DURATION'

interface PointerSurface extends EventTarget {
  getBoundingClientRect(): DOMRect | DOMRectReadOnly
}

export interface KeyboardMouseTestInputProviderOptions {
  readonly keyboardTarget: EventTarget
  readonly pointerSurface?: PointerSurface
  readonly now?: () => number
}

interface KeyboardLikeEvent extends Event {
  readonly code: string
  readonly repeat: boolean
}

interface PointerLikeEvent extends Event {
  readonly clientX: number
  readonly clientY: number
}

interface MutablePlayerState {
  request: MotionPlayerRequest
  actions: Partial<Record<MotionActionId, MotionActionState>>
  voiceSustainedMs: number
  previousPointer: {
    point: NormalizedPoint2D
    timestampMs: number
  } | undefined
}

const KEY_BINDINGS: Readonly<Record<string, MotionActionId>> = {
  KeyA: 'MOVE_LEFT',
  KeyD: 'MOVE_RIGHT',
  ArrowUp: 'MOVE_UP',
  ArrowDown: 'MOVE_DOWN',
  KeyW: 'JUMP',
  KeyS: 'SQUAT',
  KeyQ: 'LEAN_LEFT',
  KeyE: 'LEAN_RIGHT',
  KeyJ: 'STRIKE_LEFT',
  KeyL: 'STRIKE_RIGHT',
  KeyK: 'STRIKE',
  KeyR: 'REACH',
  KeyZ: 'REACH_LEFT',
  KeyC: 'REACH_RIGHT',
  KeyG: 'ARM_SWING',
  KeyF: 'ARM_SWING_LEFT',
  KeyH: 'ARM_SWING_RIGHT',
  Space: 'THROW',
  ShiftLeft: 'RUN',
  ShiftRight: 'RUN',
  KeyX: 'STEP',
  KeyU: 'HAND_OPEN',
  KeyO: 'HAND_CLOSE',
  KeyI: 'PINCH',
  Digit1: 'HAND_OPEN',
  Digit2: 'PINCH',
  Digit3: 'POINT',
  Digit4: 'CLAP',
  KeyV: 'VOICE_TRIGGER',
} as const

function zeroValue(actionId: MotionActionId): MotionActionValue {
  if (
    actionId === 'HAND_POSITION_LEFT' ||
    actionId === 'HAND_POSITION_RIGHT' ||
    actionId === 'POINTER_POSITION'
  ) {
    return { x: 0.5, y: 0.5 }
  }
  if (actionId === 'POINTER_VELOCITY') {
    return { x: 0, y: 0, magnitude: 0 }
  }
  return 0
}

function valuesEqual(left: MotionActionValue, right: MotionActionValue): boolean {
  if (typeof left === 'number' || typeof right === 'number') return left === right
  const leftMagnitude = 'magnitude' in left ? left.magnitude : undefined
  const rightMagnitude = 'magnitude' in right ? right.magnitude : undefined
  return (
    left.x === right.x &&
    left.y === right.y &&
    leftMagnitude === rightMagnitude
  )
}

function normalizePointer(
  event: PointerLikeEvent,
  surface: PointerSurface,
): NormalizedPoint2D {
  const bounds = surface.getBoundingClientRect()
  const width = Math.max(1, bounds.width)
  const height = Math.max(1, bounds.height)
  return {
    x: clamp01((event.clientX - bounds.left) / width),
    y: clamp01((event.clientY - bounds.top) / height),
  }
}

export class KeyboardMouseTestInputProvider implements MotionInputProvider {
  readonly id = 'TEST' as const

  readonly #keyboardTarget: EventTarget
  #pointerSurface: PointerSurface | undefined
  readonly #now: () => number
  readonly #listeners = new Set<() => void>()
  readonly #players = new Map<PlayerId, MutablePlayerState>()
  readonly #requestedActions = new Set<MotionActionId>()
  readonly #pressedKeys = new Map<
    string,
    { playerId: PlayerId; actionId: MotionActionId }
  >()
  readonly #pulseExpiryMs = new Map<string, number>()

  #running = false
  #activePlayerId: PlayerId | undefined
  #pointerMode: PointerSimulationMode = 'POINTER'
  #pointerDown = false
  #elapsedMs = 0
  #actionSequence = 0
  #snapshotSequence = 0
  #snapshot: MotionInputSnapshot

  constructor(options: KeyboardMouseTestInputProviderOptions) {
    this.#keyboardTarget = options.keyboardTarget
    this.#pointerSurface = options.pointerSurface
    this.#now = options.now ?? (() => performance.now())
    this.#snapshot = {
      providerId: this.id,
      sequence: 0,
      timestampMs: this.#now(),
      players: [],
    }
  }

  async start(request: MotionInputRequest): Promise<void> {
    this.#requestedActions.clear()
    request.actions.forEach((actionId) => this.#requestedActions.add(actionId))
    this.#reconcilePlayers(request.players)

    if (!this.#running) {
      this.#running = true
      this.#keyboardTarget.addEventListener('keydown', this.#onKeyDown)
      this.#keyboardTarget.addEventListener('keyup', this.#onKeyUp)
      this.#attachPointerListeners()
    }

    this.#emit()
  }

  async stop(): Promise<void> {
    if (!this.#running) return
    this.#running = false
    this.#keyboardTarget.removeEventListener('keydown', this.#onKeyDown)
    this.#keyboardTarget.removeEventListener('keyup', this.#onKeyUp)
    this.#detachPointerListeners()
    this.#pressedKeys.clear()
    this.#pulseExpiryMs.clear()
    this.#pointerDown = false
    this.#elapsedMs = 0
    for (const player of this.#players.values()) {
      player.voiceSustainedMs = 0
      player.previousPointer = undefined
      for (const [actionId, action] of Object.entries(player.actions) as Array<
        [MotionActionId, MotionActionState]
      >) {
        player.actions[actionId] = this.#nextActionState(
          action,
          zeroValue(actionId),
          'idle',
          true,
        )
      }
    }
    this.#emit()
  }

  isRunning(): boolean {
    return this.#running
  }

  getSnapshot(): MotionInputSnapshot {
    return this.#snapshot
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  update(deltaMs: number): void {
    if (!this.#running) return
    const safeDeltaMs = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
    this.#elapsedMs += safeDeltaMs
    let changed = false

    for (const player of this.#players.values()) {
      for (const [actionId, action] of Object.entries(player.actions) as Array<
        [MotionActionId, MotionActionState]
      >) {
        const pulseKey = this.#pulseKey(player.request.playerId, actionId)
        const pulseExpiry = this.#pulseExpiryMs.get(pulseKey)
        if (pulseExpiry !== undefined && this.#elapsedMs >= pulseExpiry) {
          this.#pulseExpiryMs.delete(pulseKey)
          player.actions[actionId] = this.#nextActionState(
            action,
            0,
            'ended',
            false,
          )
          changed = true
        } else if (action.phase === 'started') {
          player.actions[actionId] = { ...action, phase: 'active' }
          changed = true
        } else if (action.phase === 'ended') {
          player.actions[actionId] = { ...action, phase: 'idle' }
          changed = true
        }
      }

      const level = player.actions.VOICE_LEVEL?.value
      if (typeof level === 'number' && level > 0.05) {
        player.voiceSustainedMs += safeDeltaMs
      } else {
        player.voiceSustainedMs = 0
      }
      const duration = player.voiceSustainedMs / 1000
      const previousDuration = player.actions.VOICE_SUSTAINED_DURATION
      if (
        previousDuration &&
        (typeof previousDuration.value !== 'number' ||
          previousDuration.value !== duration)
      ) {
        player.actions.VOICE_SUSTAINED_DURATION = this.#nextActionState(
          previousDuration,
          duration,
          duration > 0 ? 'active' : 'idle',
          false,
        )
        changed = true
      }
    }

    if (changed) this.#emit()
  }

  setActivePlayer(playerId: PlayerId): void {
    if (!this.#players.has(playerId)) {
      throw new Error(`Unknown simulated player: ${playerId}`)
    }
    this.#activePlayerId = playerId
  }

  getActivePlayerId(): PlayerId | undefined {
    return this.#activePlayerId
  }

  setPlayerAbilityProfile(
    playerId: PlayerId,
    abilityProfile: ResolvedAbilityProfile,
  ): void {
    const player = this.#requirePlayer(playerId)
    const { calibration } = player.request
    player.request = calibration
      ? { playerId, abilityProfile, calibration }
      : { playerId, abilityProfile }

    for (const [actionId, action] of Object.entries(player.actions) as Array<
      [MotionActionId, MotionActionState]
    >) {
      if (!actionAllowedForProfile(actionId, abilityProfile)) {
        player.actions[actionId] = this.#nextActionState(
          action,
          zeroValue(actionId),
          'idle',
          true,
        )
      }
    }
    this.#pruneRuntimeBookkeeping()
    this.#emit()
  }

  setPointerMode(mode: PointerSimulationMode): void {
    this.#pointerMode = mode
  }

  getPointerMode(): PointerSimulationMode {
    return this.#pointerMode
  }

  attachPointerSurface(surface: PointerSurface | undefined): void {
    if (surface === this.#pointerSurface) return
    this.#detachPointerListeners()
    this.#pointerSurface = surface
    this.#attachPointerListeners()
  }

  setContinuousValue(
    playerId: PlayerId,
    actionId: ContinuousActionId,
    rawValue: number,
  ): void {
    const player = this.#requirePlayer(playerId)
    const value =
      actionId === 'RUN_CADENCE' || actionId === 'VOICE_SUSTAINED_DURATION'
        ? Math.max(0, Math.min(4, Number.isFinite(rawValue) ? rawValue : 0))
        : clamp01(rawValue)
    const previous = player.actions[actionId]
    if (!previous || (typeof previous.value === 'number' && previous.value === value)) {
      return
    }
    const previousValue = typeof previous.value === 'number' ? previous.value : 0
    const phase: MotionActionPhase =
      value === 0
        ? previousValue > 0
          ? 'ended'
          : 'idle'
        : previousValue === 0
          ? 'started'
          : 'active'
    player.actions[actionId] = this.#nextActionState(previous, value, phase, true)
    if (actionId === 'VOICE_SUSTAINED_DURATION') {
      player.voiceSustainedMs = value * 1000
    }
    this.#emit()
  }

  triggerAction(playerId: PlayerId, actionId: MotionActionId): void {
    const player = this.#requirePlayer(playerId)
    const action = player.actions[actionId]
    if (!action || !actionAllowedForProfile(actionId, player.request.abilityProfile)) {
      return
    }
    player.actions[actionId] = this.#nextActionState(
      action,
      1,
      'started',
      true,
    )
    this.#pulseExpiryMs.set(this.#pulseKey(playerId, actionId), this.#elapsedMs + 160)
    this.#emit()
  }

  #reconcilePlayers(requests: readonly MotionPlayerRequest[]): void {
    const requestedIds = new Set(requests.map(({ playerId }) => playerId))
    for (const playerId of this.#players.keys()) {
      if (!requestedIds.has(playerId)) this.#players.delete(playerId)
    }

    for (const request of requests) {
      const existing = this.#players.get(request.playerId)
      const actions: Partial<Record<MotionActionId, MotionActionState>> = {}
      for (const actionId of this.#requestedActions) {
        const previous = existing?.actions[actionId]
        if (previous && actionAllowedForProfile(actionId, request.abilityProfile)) {
          actions[actionId] = previous
        } else if (previous) {
          actions[actionId] = this.#nextActionState(
            previous,
            zeroValue(actionId),
            'idle',
            true,
          )
        } else {
          actions[actionId] = this.#createIdleAction(actionId)
        }
      }
      this.#players.set(request.playerId, {
        request,
        actions,
        voiceSustainedMs:
          existing &&
          this.#requestedActions.has('VOICE_LEVEL') &&
          this.#requestedActions.has('VOICE_SUSTAINED_DURATION')
            ? existing.voiceSustainedMs
            : 0,
        previousPointer:
          existing?.previousPointer && this.#hasPointerRuntimeAction()
            ? existing.previousPointer
            : undefined,
      })
    }

    if (!this.#activePlayerId || !requestedIds.has(this.#activePlayerId)) {
      this.#activePlayerId = requests[0]?.playerId
    }
    this.#pruneRuntimeBookkeeping()
  }

  #createIdleAction(actionId: MotionActionId): MotionActionState {
    return {
      id: actionId,
      value: zeroValue(actionId),
      phase: 'idle',
      confidence: 1,
      timestampMs: this.#now(),
      sequence: ++this.#actionSequence,
    }
  }

  #hasPointerRuntimeAction(): boolean {
    return (
      this.#requestedActions.has('HAND_POSITION_LEFT') ||
      this.#requestedActions.has('HAND_POSITION_RIGHT') ||
      this.#requestedActions.has('POINTER_POSITION') ||
      this.#requestedActions.has('POINTER_VELOCITY')
    )
  }

  #pruneRuntimeBookkeeping(): void {
    for (const [code, pressed] of this.#pressedKeys) {
      const player = this.#players.get(pressed.playerId)
      if (
        !player ||
        !this.#requestedActions.has(pressed.actionId) ||
        !actionAllowedForProfile(pressed.actionId, player.request.abilityProfile)
      ) {
        this.#pressedKeys.delete(code)
      }
    }

    for (const pulseKey of this.#pulseExpiryMs.keys()) {
      const separator = pulseKey.lastIndexOf(':')
      const playerId = pulseKey.slice(0, separator)
      const actionId = pulseKey.slice(separator + 1) as MotionActionId
      const player = this.#players.get(playerId)
      if (
        separator < 0 ||
        !player ||
        !this.#requestedActions.has(actionId) ||
        !actionAllowedForProfile(actionId, player.request.abilityProfile)
      ) {
        this.#pulseExpiryMs.delete(pulseKey)
      }
    }
  }

  #requirePlayer(playerId: PlayerId): MutablePlayerState {
    const player = this.#players.get(playerId)
    if (!player) throw new Error(`Unknown simulated player: ${playerId}`)
    return player
  }

  #nextActionState(
    previous: MotionActionState,
    value: MotionActionValue,
    phase: MotionActionPhase,
    incrementSequence: boolean,
  ): MotionActionState {
    if (valuesEqual(previous.value, value) && previous.phase === phase) return previous
    return {
      ...previous,
      value,
      phase,
      timestampMs: this.#now(),
      sequence: incrementSequence ? ++this.#actionSequence : previous.sequence,
    }
  }

  #setAction(
    playerId: PlayerId,
    actionId: MotionActionId,
    value: MotionActionValue,
    phase: MotionActionPhase,
  ): boolean {
    const player = this.#players.get(playerId)
    const previous = player?.actions[actionId]
    if (
      !player ||
      !previous ||
      !actionAllowedForProfile(actionId, player.request.abilityProfile)
    ) {
      return false
    }
    const next = this.#nextActionState(previous, value, phase, true)
    if (next === previous) return false
    player.actions[actionId] = next
    return true
  }

  #emit(): void {
    const players: PlayerMotionState[] = [...this.#players.values()].map(
      ({ request, actions }) => {
        const state = {
          playerId: request.playerId,
          abilityProfile: request.abilityProfile,
          actions: { ...actions },
        }
        return request.calibration
          ? { ...state, calibration: request.calibration }
          : state
      },
    )
    this.#snapshot = {
      providerId: this.id,
      sequence: ++this.#snapshotSequence,
      timestampMs: this.#now(),
      players,
    }
    this.#listeners.forEach((listener) => listener())
  }

  #pulseKey(playerId: PlayerId, actionId: MotionActionId): string {
    return `${playerId}:${actionId}`
  }

  #attachPointerListeners(): void {
    if (!this.#running) return
    this.#pointerSurface?.addEventListener('pointerdown', this.#onPointerDown)
    this.#pointerSurface?.addEventListener('pointermove', this.#onPointerMove)
    this.#pointerSurface?.addEventListener('pointerup', this.#onPointerUp)
    this.#pointerSurface?.addEventListener('pointercancel', this.#onPointerUp)
  }

  #detachPointerListeners(): void {
    this.#pointerSurface?.removeEventListener('pointerdown', this.#onPointerDown)
    this.#pointerSurface?.removeEventListener('pointermove', this.#onPointerMove)
    this.#pointerSurface?.removeEventListener('pointerup', this.#onPointerUp)
    this.#pointerSurface?.removeEventListener('pointercancel', this.#onPointerUp)
  }

  readonly #onKeyDown = (rawEvent: Event): void => {
    if (!this.#running || !this.#activePlayerId) return
    const event = rawEvent as KeyboardLikeEvent
    const actionId = KEY_BINDINGS[event.code]
    if (!actionId || event.repeat || this.#pressedKeys.has(event.code)) return
    event.preventDefault()
    if (this.#setAction(this.#activePlayerId, actionId, 1, 'started')) {
      this.#pressedKeys.set(event.code, {
        playerId: this.#activePlayerId,
        actionId,
      })
      this.#emit()
    }
  }

  readonly #onKeyUp = (rawEvent: Event): void => {
    const event = rawEvent as KeyboardLikeEvent
    const pressed = this.#pressedKeys.get(event.code)
    if (!pressed) return
    event.preventDefault()
    this.#pressedKeys.delete(event.code)
    if (this.#setAction(pressed.playerId, pressed.actionId, 0, 'ended')) {
      this.#emit()
    }
  }

  readonly #onPointerDown = (rawEvent: Event): void => {
    if (!this.#running || !this.#activePlayerId) return
    this.#pointerDown = true
    const event = rawEvent as PointerLikeEvent
    this.#updatePointer(this.#activePlayerId, event)
    this.triggerAction(this.#activePlayerId, 'POINTER_CLICK')
    if (this.#setAction(this.#activePlayerId, 'POINTER_DRAG', 1, 'started')) {
      this.#emit()
    }
  }

  readonly #onPointerMove = (rawEvent: Event): void => {
    if (!this.#running || !this.#activePlayerId) return
    const event = rawEvent as PointerLikeEvent
    const changed = this.#updatePointer(this.#activePlayerId, event)
    const dragChanged = this.#pointerDown
      ? this.#setAction(this.#activePlayerId, 'POINTER_DRAG', 1, 'active')
      : false
    if (changed || dragChanged) this.#emit()
  }

  readonly #onPointerUp = (rawEvent: Event): void => {
    if (!this.#running || !this.#activePlayerId) return
    const event = rawEvent as PointerLikeEvent
    const changed = this.#updatePointer(this.#activePlayerId, event)
    this.#pointerDown = false
    const dragChanged = this.#setAction(
      this.#activePlayerId,
      'POINTER_DRAG',
      0,
      'ended',
    )
    if (changed || dragChanged) this.#emit()
  }

  #updatePointer(playerId: PlayerId, event: PointerLikeEvent): boolean {
    const surface = this.#pointerSurface
    if (!surface) return false
    const point = normalizePointer(event, surface)
    const positionAction: MotionActionId =
      this.#pointerMode === 'LEFT_HAND'
        ? 'HAND_POSITION_LEFT'
        : this.#pointerMode === 'RIGHT_HAND'
          ? 'HAND_POSITION_RIGHT'
          : 'POINTER_POSITION'
    let changed = this.#setAction(playerId, positionAction, point, 'active')
    const player = this.#requirePlayer(playerId)
    const now = this.#now()
    const previous = player.previousPointer
    if (previous) {
      const seconds = Math.max(0.016, (now - previous.timestampMs) / 1000)
      const rawX = (point.x - previous.point.x) / seconds
      const rawY = (point.y - previous.point.y) / seconds
      const x = Math.max(-1, Math.min(1, rawX))
      const y = Math.max(-1, Math.min(1, rawY))
      const magnitude = clamp01(Math.hypot(rawX, rawY))
      changed =
        this.#setAction(
          playerId,
          'POINTER_VELOCITY',
          { x, y, magnitude },
          magnitude > 0 ? 'active' : 'idle',
        ) || changed
    }
    player.previousPointer = { point, timestampMs: now }
    return changed
  }
}
