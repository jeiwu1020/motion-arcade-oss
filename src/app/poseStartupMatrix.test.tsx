import { createElement } from 'react'
import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { screenFromHash, type AppScreen } from './navigation'
import BalloonPopPoseGameScreen, {
  startBalloonRallyCamera,
} from '../games/balloon-pop/BalloonPopPoseGameScreen'
import { BALLOON_RALLY_POSE_INPUT_REQUEST } from '../games/balloon-pop/BalloonRallySession'
import BadmintonPoseGameScreen, {
  BADMINTON_POSE_INPUT_REQUEST,
  startBadmintonCamera,
} from '../games/badminton/BadmintonPoseGameScreen'
import BaseballPoseGameScreen, {
  BASEBALL_POSE_INPUT_REQUEST,
  startBaseballCamera,
} from '../games/baseball/BaseballPoseGameScreen'
import BowlingPoseGameScreen, {
  BOWLING_POSE_INPUT_REQUEST,
  startBowlingCamera,
} from '../games/bowling/BowlingPoseGameScreen'
import HighJumpPoseGameScreen, {
  HIGH_JUMP_POSE_INPUT_REQUEST,
  startHighJumpCamera,
} from '../games/high-jump/HighJumpPoseGameScreen'
import LongJumpPoseGameScreen, {
  LONG_JUMP_POSE_INPUT_REQUEST,
  startLongJumpCamera,
} from '../games/long-jump/LongJumpPoseGameScreen'
import ReactionArenaPoseGameScreen, {
  REACTION_ARENA_POSE_INPUT_REQUEST,
  startReactionArenaCamera,
} from '../games/reaction-arena/ReactionArenaPoseGameScreen'
import RhythmPoseGameScreen, {
  RHYTHM_POSE_INPUT_REQUEST,
  startRhythmCamera,
} from '../games/rhythm-motion/RhythmPoseGameScreen'
import RunnerPoseGameScreen, {
  RUNNER_POSE_INPUT_REQUEST,
  startRunnerCamera,
} from '../games/runner/RunnerPoseGameScreen'
import RunningRacePoseGameScreen, {
  RUNNING_RACE_POSE_INPUT_REQUEST,
  startRunningRaceCamera,
} from '../games/running-race/RunningRacePoseGameScreen'
import SwimmingPoseGameScreen, {
  startSwimmingCamera,
  SWIMMING_POSE_INPUT_REQUEST,
} from '../games/swimming/SwimmingPoseGameScreen'
import TennisPoseGameScreen, {
  startTennisCamera,
  TENNIS_POSE_INPUT_REQUEST,
} from '../games/tennis/TennisPoseGameScreen'
import type { PoseGameplayInputRuntime } from '../motion/runtime/PoseGameplayInputRuntime'
import type { MotionInputRequest } from '../motion/contracts/motion'

type RuntimeStart = Pick<PoseGameplayInputRuntime, 'start'>
type PoseScreen = ComponentType<{ readonly onExit: () => void }>
type StartCamera = (runtime: RuntimeStart) => Promise<void>

interface PoseStartupMatrixEntry {
  readonly game: string
  readonly route: string
  readonly screen: AppScreen
  readonly framing: 'UPPER_BODY' | 'FULL_BODY'
  readonly readiness: 'STRICT' | 'KNEES'
  readonly inputFamily: 'Spatial Hand' | 'General Motion Actions' | 'Sports Motion' | 'Locomotion'
  readonly request: MotionInputRequest
  readonly render: PoseScreen
  readonly start: StartCamera
}

const noopExit = () => undefined

const withAudio = (start: (audio: { unlock: () => Promise<void> }, runtime: RuntimeStart) => Promise<void>): StartCamera =>
  (runtime) => start({ unlock: async () => undefined }, runtime)

const MATRIX: readonly PoseStartupMatrixEntry[] = [
  {
    game: 'Balloon Rally', route: '#game/balloon-pop', screen: 'BALLOON_POP', framing: 'UPPER_BODY', readiness: 'STRICT', inputFamily: 'Spatial Hand',
    request: BALLOON_RALLY_POSE_INPUT_REQUEST, render: BalloonPopPoseGameScreen,
    start: withAudio(startBalloonRallyCamera),
  },
  {
    game: 'Reaction Arena', route: '#game/reaction-arena', screen: 'REACTION_ARENA', framing: 'FULL_BODY', readiness: 'KNEES', inputFamily: 'General Motion Actions',
    request: REACTION_ARENA_POSE_INPUT_REQUEST, render: ReactionArenaPoseGameScreen,
    start: withAudio(startReactionArenaCamera),
  },
  {
    game: 'Runner', route: '#game/runner', screen: 'RUNNER', framing: 'FULL_BODY', readiness: 'STRICT', inputFamily: 'General Motion Actions',
    request: RUNNER_POSE_INPUT_REQUEST, render: RunnerPoseGameScreen, start: startRunnerCamera,
  },
  {
    game: 'Rhythm Motion', route: '#game/rhythm-motion', screen: 'RHYTHM_MOTION', framing: 'UPPER_BODY', readiness: 'STRICT', inputFamily: 'General Motion Actions',
    request: RHYTHM_POSE_INPUT_REQUEST, render: RhythmPoseGameScreen, start: startRhythmCamera,
  },
  {
    game: 'Tennis', route: '#game/tennis', screen: 'TENNIS', framing: 'UPPER_BODY', readiness: 'STRICT', inputFamily: 'Sports Motion',
    request: TENNIS_POSE_INPUT_REQUEST, render: TennisPoseGameScreen, start: startTennisCamera,
  },
  {
    game: 'Badminton', route: '#game/badminton', screen: 'BADMINTON', framing: 'UPPER_BODY', readiness: 'STRICT', inputFamily: 'Sports Motion',
    request: BADMINTON_POSE_INPUT_REQUEST, render: BadmintonPoseGameScreen, start: startBadmintonCamera,
  },
  {
    game: 'Bowling', route: '#game/bowling', screen: 'BOWLING', framing: 'UPPER_BODY', readiness: 'STRICT', inputFamily: 'Sports Motion',
    request: BOWLING_POSE_INPUT_REQUEST, render: BowlingPoseGameScreen, start: startBowlingCamera,
  },
  {
    game: 'Running Race', route: '#game/running-race', screen: 'RUNNING_RACE', framing: 'FULL_BODY', readiness: 'KNEES', inputFamily: 'Locomotion',
    request: RUNNING_RACE_POSE_INPUT_REQUEST, render: RunningRacePoseGameScreen, start: startRunningRaceCamera,
  },
  {
    game: 'Swimming', route: '#game/swimming', screen: 'SWIMMING', framing: 'UPPER_BODY', readiness: 'STRICT', inputFamily: 'Sports Motion',
    request: SWIMMING_POSE_INPUT_REQUEST, render: SwimmingPoseGameScreen, start: startSwimmingCamera,
  },
  {
    game: 'High Jump', route: '#game/high-jump', screen: 'HIGH_JUMP', framing: 'FULL_BODY', readiness: 'STRICT', inputFamily: 'General Motion Actions',
    request: HIGH_JUMP_POSE_INPUT_REQUEST, render: HighJumpPoseGameScreen, start: startHighJumpCamera,
  },
  {
    game: 'Long Jump Challenge', route: '#game/long-jump', screen: 'LONG_JUMP', framing: 'FULL_BODY', readiness: 'STRICT', inputFamily: 'Locomotion',
    request: LONG_JUMP_POSE_INPUT_REQUEST, render: LongJumpPoseGameScreen, start: startLongJumpCamera,
  },
  {
    game: 'Baseball', route: '#game/baseball', screen: 'BASEBALL', framing: 'UPPER_BODY', readiness: 'STRICT', inputFamily: 'Sports Motion',
    request: BASEBALL_POSE_INPUT_REQUEST, render: BaseballPoseGameScreen, start: startBaseballCamera,
  },
] as const

describe('production Pose game startup matrix', () => {
  it.each(MATRIX)('$game resolves its production route', ({ route, screen }) => {
    expect(screenFromHash(route, { testInputEnabled: false, realSensorLabEnabled: false })).toBe(screen)
  })

  it.each(MATRIX)('$game renders explicit camera setup with the shared CTA', ({ game, render, framing }) => {
    const markup = renderToStaticMarkup(createElement(render, { onExit: noopExit }))
    expect(markup, game).toContain(`data-framing-requirement="${framing}"`)
    expect(markup, game).toContain('啟動相機')
    expect(markup.match(/<video/g), game).toHaveLength(1)
  })

  it.each(MATRIX)('$game requests Pose only and delegates start to the shared runtime', async ({ game, request, start }) => {
    expect(request.sensors, game).toEqual({ pose: true, hands: false, audio: false })
    const runtime = { start: vi.fn(async () => undefined) }
    await start(runtime)
    expect(runtime.start, game).toHaveBeenCalledExactlyOnceWith(request)
  })

  it('keeps the matrix limited to the 12 production Pose routes', () => {
    expect(MATRIX).toHaveLength(12)
    expect(new Set(MATRIX.map(({ route }) => route)).size).toBe(12)
  })
})
