import { resolveAbilityProfile } from '../../motion/adaptive/profiles'
import type {
  MotionInputProvider,
  MotionInputRequest,
} from '../../motion/contracts/motion'
import {
  advanceBalloonPop,
  createBalloonPopState,
  replayBalloonPop,
  type BalloonPopState,
} from './BalloonPopCore'

export const BALLOON_POP_PLAYER_ID = 'player-1'

const BALLOON_POP_INPUT_REQUEST: MotionInputRequest = {
  players: [
    {
      playerId: BALLOON_POP_PLAYER_ID,
      abilityProfile: resolveAbilityProfile(['STANDARD']),
    },
  ],
  actions: ['REACH_LEFT', 'REACH_RIGHT'],
  sensors: {
    pose: false,
    hands: false,
    audio: false,
  },
}

type Listener = () => void

export interface BalloonPopSessionOptions {
  seed?: number
}

function presentationKey(state: BalloonPopState): string {
  return [
    state.phase,
    Math.ceil(state.countdownRemainingMs / 1_000),
    Math.ceil(state.roundRemainingMs / 1_000),
    state.score,
    state.hits,
    state.misses,
    state.target?.id ?? 0,
  ].join(':')
}

/**
 * Runtime boundary between the normalized Motion Input provider and the pure
 * Balloon Pop rules. Rendering code reads this session but never owns rules.
 */
export class BalloonPopSession {
  readonly #provider: MotionInputProvider
  readonly #listeners = new Set<Listener>()
  #state: BalloonPopState
  #running = false
  #presentationKey: string

  constructor(
    provider: MotionInputProvider,
    options: BalloonPopSessionOptions = {},
  ) {
    this.#provider = provider
    this.#state = createBalloonPopState(options)
    this.#presentationKey = presentationKey(this.#state)
  }

  readonly getState = (): BalloonPopState => this.#state

  readonly subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async start(): Promise<void> {
    if (this.#running) {
      return
    }

    this.#running = true
    try {
      await this.#provider.start(BALLOON_POP_INPUT_REQUEST)
    } catch (error) {
      this.#running = false
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.#running) {
      return
    }

    this.#running = false
    await this.#provider.stop()
  }

  tick(deltaMs: number): void {
    if (!this.#running) {
      return
    }

    const player = this.#provider.getSnapshot().players[0]
    const nextState = advanceBalloonPop(this.#state, {
      deltaMs,
      actions: player?.actions ?? {},
    })

    this.#replaceState(nextState)
    this.#provider.update(deltaMs)
  }

  replay(): void {
    this.#replaceState(replayBalloonPop(this.#state), true)
  }

  #replaceState(nextState: BalloonPopState, forceNotify = false): void {
    this.#state = nextState
    const nextKey = presentationKey(nextState)

    if (!forceNotify && nextKey === this.#presentationKey) {
      return
    }

    this.#presentationKey = nextKey
    for (const listener of this.#listeners) {
      listener()
    }
  }
}
