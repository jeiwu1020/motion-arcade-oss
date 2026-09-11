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

export const BALLOON_RALLY_COLLISION_PADDING = 24
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
      const magnitude = Math.min(
        BALLOON_RALLY_RULES.maximumImpulse,
        95 + distance * 1.25,
      )
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

/**
 * Session boundary joining normalized logical wrist samples with pure Balloon
 * Rally rules. It owns transient contact state only; Phaser only renders the
 * immutable resulting Core state.
 */
export class BalloonRallySession {
  readonly #spatialInput: SpatialCollisionInputAdapter
  readonly #contacts = new SpatialCircleContactTracker()
  readonly #listeners = new Set<Listener>()
  #state: BalloonRallyState
  #running = false

  constructor(
    spatialInput: SpatialCollisionInputAdapter,
    options: BalloonRallySessionOptions = {},
  ) {
    this.#spatialInput = spatialInput
    this.#state = createBalloonRallyState(options)
  }

  readonly getState = (): BalloonRallyState => this.#state

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
    this.#contacts.reset()
    this.#spatialInput.reset()
  }

  tick(deltaMs: number, gameplayReady: boolean): void {
    if (!this.#running) return
    const spatial = this.#spatialInput.getSnapshot()
    if (!gameplayReady || !spatial.cameraVisibleWorldRect) {
      this.#breakSpatialContinuity()
      return
    }

    const contacts = this.#collectContacts()
    this.#replaceState(
      advanceBalloonRally(this.#state, {
        deltaMs,
        interactionRegion: spatial.cameraVisibleWorldRect,
        contacts,
      }),
    )
  }

  replay(): void {
    this.#state = replayBalloonRally(this.#state)
    this.#breakSpatialContinuity()
    this.#notify()
  }

  #collectContacts(): readonly BalloonRallyContact[] {
    const snapshot = this.#spatialInput.getSnapshot()
    const contacts: BalloonRallyContact[] = []
    for (const balloon of this.#state.balloons) {
      const target = {
        id: String(balloon.id),
        x: balloon.x,
        y: balloon.y,
        radius: balloon.radius + BALLOON_RALLY_COLLISION_PADDING,
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
        if (didContact) {
          contacts.push({
            balloonId: balloon.id,
            side,
            impulse: fallbackImpulse(hand, balloon),
          })
        }
      }
    }
    return contacts
  }

  #breakSpatialContinuity(): void {
    this.#contacts.reset()
    this.#spatialInput.reset()
  }

  #replaceState(nextState: BalloonRallyState): void {
    if (nextState === this.#state) return
    this.#state = nextState
    this.#notify()
  }

  #notify(): void {
    for (const listener of this.#listeners) listener()
  }
}
