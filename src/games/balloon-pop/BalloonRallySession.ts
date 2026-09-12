import type { LogicalSpatialHand, SpatialCollisionInputAdapter } from '../../spatial/SpatialCollisionInputAdapter'
import { SpatialCircleContactTracker } from '../../spatial/spatialCollision'
import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import type { MotionInputRequest } from '../../motion/contracts/motion'
import {
  advanceBalloonRally,
  createBalloonRallyState,
  replayBalloonRally,
  BALLOON_RALLY_RULES,
  type BalloonRallyContact,
  type BalloonRallyState,
} from './BalloonRallyCore'
import type { BalloonRallyHandVisualSnapshot } from './BalloonRallyPresentation'

export const BALLOON_RALLY_VIRTUAL_HAND_RADIUS = 42
export const BALLOON_RALLY_CONTACT_TOLERANCE = 10
export const BALLOON_RALLY_TRACKING_POLICY = Object.freeze({
  degradedGraceMs: 3_000,
  hardPauseMs: 6_000,
})

export const BALLOON_RALLY_POSE_INPUT_REQUEST: MotionInputRequest = Object.freeze({
  players: Object.freeze([
    Object.freeze({
      playerId: 'player-1',
      abilityProfile: resolveAbilityProfile(['UPPER_BODY']),
    }),
  ]),
  actions: Object.freeze([]),
  sensors: Object.freeze({ pose: true, hands: false, audio: false }),
})

export type BalloonRallyTrackingState =
  | 'NORMAL'
  | 'DEGRADED'
  | 'SOFT_RECOVERY'
  | 'HARD_PAUSE'

export interface BalloonRallyTrackingInput {
  /** Strict UPPER_BODY readiness used only before the round is active. */
  readonly setupReady: boolean
  /** Useful torso/core tracking; individual wrists remain independently optional. */
  readonly usefulTracking: boolean
  /** A camera, Pose backend, or lifecycle failure rather than ordinary quality loss. */
  readonly hardFailure: boolean
}

export interface BalloonRallySessionSnapshot {
  readonly state: BalloonRallyState
  readonly trackingState: BalloonRallyTrackingState
}

type Listener = () => void

export interface BalloonRallySessionOptions {
  readonly seed?: number
}

function fallbackImpulse(
  hand: LogicalSpatialHand,
  balloon: Readonly<{ x: number; y: number }>,
): Readonly<{ x: number; y: number }> {
  if (hand.availability !== 'AVAILABLE') return Object.freeze({ x: 0, y: -120 })

  const segment = hand.segment
  if (segment) {
    const dx = segment.to.x - segment.from.x
    const dy = segment.to.y - segment.from.y
    const distance = Math.hypot(dx, dy)
    if (distance >= 8) {
      const magnitude = Math.min(BALLOON_RALLY_RULES.maximumImpulse, 95 + distance * 1.25)
      return Object.freeze({ x: (dx / distance) * magnitude, y: (dy / distance) * magnitude })
    }
  }

  const dx = balloon.x - hand.current.x
  const dy = balloon.y - hand.current.y
  const distance = Math.hypot(dx, dy)
  if (distance >= 1) {
    return Object.freeze({ x: (dx / distance) * 130, y: (dy / distance) * 130 })
  }
  return Object.freeze({ x: 0, y: -130 })
}

function normalizeTrackingInput(
  input: boolean | BalloonRallyTrackingInput,
): BalloonRallyTrackingInput {
  if (typeof input !== 'boolean') return input
  return {
    setupReady: input,
    usefulTracking: input,
    hardFailure: false,
  }
}

/**
 * Session boundary joining normalized logical wrist samples with pure Balloon
 * Rally rules. It owns transient contact and active-game tracking policy only;
 * Phaser only renders the immutable resulting Core state.
 */
export class BalloonRallySession {
  readonly #spatialInput: SpatialCollisionInputAdapter
  readonly #contacts = new SpatialCircleContactTracker()
  readonly #listeners = new Set<Listener>()
  #state: BalloonRallyState
  #trackingState: BalloonRallyTrackingState = 'NORMAL'
  #trackingLossMs = 0
  #presentationSnapshot: BalloonRallySessionSnapshot
  #running = false
  #suppressFirstContactAfterReset = false

  constructor(
    spatialInput: SpatialCollisionInputAdapter,
    options: BalloonRallySessionOptions = {},
  ) {
    this.#spatialInput = spatialInput
    this.#state = createBalloonRallyState(options)
    this.#presentationSnapshot = Object.freeze({
      state: this.#state,
      trackingState: this.#trackingState,
    })
  }

  readonly getState = (): BalloonRallyState => this.#state

  readonly getPresentationSnapshot = (): BalloonRallySessionSnapshot =>
    this.#presentationSnapshot

  /** Game-local logical hand positions for cosmetic presentation only. */
  readonly getHandVisualSnapshot = (): readonly BalloonRallyHandVisualSnapshot[] => {
    const spatial = this.#spatialInput.getSnapshot()
    const available = this.#trackingState === 'NORMAL' || this.#trackingState === 'DEGRADED'
    const visual = (side: 'LEFT' | 'RIGHT', hand: LogicalSpatialHand): BalloonRallyHandVisualSnapshot => {
      if (available && hand.availability === 'AVAILABLE') {
        return { side, availability: 'AVAILABLE', x: hand.current.x, y: hand.current.y }
      }
      return { side, availability: 'UNAVAILABLE' }
    }
    return Object.freeze([
      visual('LEFT', spatial.leftHand),
      visual('RIGHT', spatial.rightHand),
    ])
  }

  readonly subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async start(): Promise<void> {
    this.#running = true
  }

  async stop(): Promise<void> {
    if (!this.#running) return
    this.#running = false
    this.#trackingLossMs = 0
    this.#setTrackingState('NORMAL')
    this.#contacts.reset()
    this.#spatialInput.reset()
    this.#suppressFirstContactAfterReset = true
  }

  tick(deltaMs: number, input: boolean | BalloonRallyTrackingInput): void {
    if (!this.#running) return
    const tracking = normalizeTrackingInput(input)
    const safeDeltaMs = Math.max(0, Number.isFinite(deltaMs) ? deltaMs : 0)
    const spatial = this.#spatialInput.getSnapshot()

    if (this.#state.phase === 'COUNTDOWN') {
      if (!tracking.setupReady || tracking.hardFailure || !spatial.cameraVisibleWorldRect) {
        this.#breakSpatialContinuity()
        return
      }
      this.#trackingLossMs = 0
      this.#setTrackingState('NORMAL')
      this.#advance(safeDeltaMs)
      return
    }

    if (this.#state.phase === 'FINISHED') return
    if (tracking.hardFailure || !spatial.cameraVisibleWorldRect) {
      this.#trackingLossMs = BALLOON_RALLY_TRACKING_POLICY.hardPauseMs
      this.#enterRecovery('HARD_PAUSE')
      return
    }
    if (tracking.usefulTracking) {
      this.#trackingLossMs = 0
      this.#setTrackingState('NORMAL')
      this.#advance(safeDeltaMs)
      return
    }

    const priorLossMs = this.#trackingLossMs
    const nextLossMs = priorLossMs + safeDeltaMs
    this.#trackingLossMs = nextLossMs
    const continuingMs = Math.min(
      safeDeltaMs,
      Math.max(0, BALLOON_RALLY_TRACKING_POLICY.hardPauseMs - priorLossMs),
    )
    if (continuingMs > 0) this.#advance(continuingMs)
    if (nextLossMs < BALLOON_RALLY_TRACKING_POLICY.degradedGraceMs) {
      this.#setTrackingState('DEGRADED')
      return
    }
    this.#enterRecovery(
      nextLossMs >= BALLOON_RALLY_TRACKING_POLICY.hardPauseMs
        ? 'HARD_PAUSE'
        : 'SOFT_RECOVERY',
    )
  }

  replay(): void {
    this.#state = replayBalloonRally(this.#state)
    this.#trackingLossMs = 0
    this.#trackingState = 'NORMAL'
    this.#refreshPresentationSnapshot()
    this.#breakSpatialContinuity()
    this.#notify()
  }

  #advance(deltaMs: number): void {
    const spatial = this.#spatialInput.getSnapshot()
    if (!spatial.cameraVisibleWorldRect) return
    this.#replaceState(
      advanceBalloonRally(this.#state, {
        deltaMs,
        interactionRegion: spatial.cameraVisibleWorldRect,
        contacts: this.#collectContacts(),
      }),
    )
  }

  #collectContacts(): readonly BalloonRallyContact[] {
    const snapshot = this.#spatialInput.getSnapshot()
    const contacts: BalloonRallyContact[] = []
    const suppressContacts = this.#suppressFirstContactAfterReset
    for (const balloon of this.#state.balloons) {
      const target = {
        id: String(balloon.id),
        x: balloon.x,
        y: balloon.y,
        radius:
          balloon.radius +
          BALLOON_RALLY_VIRTUAL_HAND_RADIUS +
          BALLOON_RALLY_CONTACT_TOLERANCE,
      }
      for (const side of ['LEFT', 'RIGHT'] as const) {
        const hand = side === 'LEFT' ? snapshot.leftHand : snapshot.rightHand
        const didContact = this.#contacts.update(
          {
            side,
            sequence: hand.sequence,
            current: hand.availability === 'AVAILABLE' ? hand.current : null,
            segment: hand.availability === 'AVAILABLE' ? hand.segment : null,
          },
          target,
        )
        if (didContact && !suppressContacts) {
          contacts.push({
            balloonId: balloon.id,
            side,
            impulse: fallbackImpulse(hand, balloon),
          })
        }
      }
    }
    this.#suppressFirstContactAfterReset = false
    return contacts
  }

  #enterRecovery(nextState: 'SOFT_RECOVERY' | 'HARD_PAUSE'): void {
    if (this.#trackingState !== nextState) this.#breakSpatialContinuity()
    this.#setTrackingState(nextState)
  }

  #breakSpatialContinuity(): void {
    this.#contacts.reset()
    this.#spatialInput.resetContinuity()
    this.#suppressFirstContactAfterReset = true
  }

  #replaceState(nextState: BalloonRallyState): void {
    if (nextState === this.#state) return
    this.#state = nextState
    this.#refreshPresentationSnapshot()
    this.#notify()
  }

  #setTrackingState(nextState: BalloonRallyTrackingState): void {
    if (nextState === this.#trackingState) return
    this.#trackingState = nextState
    this.#refreshPresentationSnapshot()
    this.#notify()
  }

  #refreshPresentationSnapshot(): void {
    this.#presentationSnapshot = Object.freeze({
      state: this.#state,
      trackingState: this.#trackingState,
    })
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }
}
