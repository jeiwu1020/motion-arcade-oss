import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveAbilityProfile } from '../adaptive/profiles'
import type {
  MotionActionId,
  MotionInputRequest,
  PlayerId,
} from '../contracts/motion'
import { KeyboardMouseTestInputProvider } from './KeyboardMouseTestInputProvider'

class InputEventForTest extends Event {
  readonly code: string
  readonly repeat: boolean
  readonly clientX: number
  readonly clientY: number

  constructor(
    type: string,
    options: {
      code?: string
      repeat?: boolean
      clientX?: number
      clientY?: number
    } = {},
  ) {
    super(type, { cancelable: true })
    this.code = options.code ?? ''
    this.repeat = options.repeat ?? false
    this.clientX = options.clientX ?? 0
    this.clientY = options.clientY ?? 0
  }
}

class PointerSurfaceForTest extends EventTarget {
  getBoundingClientRect() {
    return {
      left: 100,
      top: 50,
      width: 400,
      height: 200,
      right: 500,
      bottom: 250,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    }
  }
}

const allActions: readonly MotionActionId[] = [
  'MOVE_LEFT',
  'MOVE_RIGHT',
  'MOVE_UP',
  'MOVE_DOWN',
  'JUMP',
  'SQUAT',
  'LEAN_LEFT',
  'LEAN_RIGHT',
  'REACH',
  'REACH_LEFT',
  'REACH_RIGHT',
  'ARM_SWING',
  'ARM_SWING_LEFT',
  'ARM_SWING_RIGHT',
  'STRIKE',
  'STRIKE_LEFT',
  'STRIKE_RIGHT',
  'THROW',
  'RUN',
  'STEP',
  'RUN_CADENCE',
  'HAND_OPEN',
  'HAND_CLOSE',
  'PINCH',
  'POINT',
  'CLAP',
  'HAND_POSITION_LEFT',
  'HAND_POSITION_RIGHT',
  'POINTER_POSITION',
  'POINTER_CLICK',
  'POINTER_DRAG',
  'POINTER_VELOCITY',
  'VOICE_LEVEL',
  'VOICE_PITCH',
  'VOICE_TRIGGER',
  'VOICE_SUSTAINED_DURATION',
]

function request(
  players: ReadonlyArray<{
    playerId: PlayerId
    profiles: Parameters<typeof resolveAbilityProfile>[0]
  }> = [{ playerId: 'player-1', profiles: ['STANDARD'] }],
): MotionInputRequest {
  return {
    players: players.map(({ playerId, profiles }) => ({
      playerId,
      abilityProfile: resolveAbilityProfile(profiles),
    })),
    actions: allActions,
    sensors: { pose: false, hands: false, audio: false },
  }
}

function state(
  provider: KeyboardMouseTestInputProvider,
  playerId: PlayerId,
  actionId: MotionActionId,
) {
  const player = provider
    .getSnapshot()
    .players.find((candidate) => candidate.playerId === playerId)
  if (!player) throw new Error(`Missing ${playerId}`)
  const action = player.actions[actionId]
  if (!action) throw new Error(`Missing ${actionId}`)
  return action
}

describe('KeyboardMouseTestInputProvider', () => {
  const providers: KeyboardMouseTestInputProvider[] = []

  afterEach(async () => {
    await Promise.all(providers.map((provider) => provider.stop()))
  })

  function setup() {
    const keyboard = new EventTarget()
    const pointer = new PointerSurfaceForTest()
    const provider = new KeyboardMouseTestInputProvider({
      keyboardTarget: keyboard,
      pointerSurface: pointer,
    })
    providers.push(provider)
    return { keyboard, pointer, provider }
  }

  it('starts without requesting camera or microphone and stops idempotently', async () => {
    const getUserMedia = vi.fn(() => {
      throw new Error('Test provider must never request media')
    })
    const originalNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator',
    )
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { mediaDevices: { getUserMedia } },
    })
    const { provider } = setup()

    try {
      await provider.start(request())
      await provider.stop()
      await provider.stop()
      expect(getUserMedia).not.toHaveBeenCalled()
      expect(provider.isRunning()).toBe(false)
    } finally {
      if (originalNavigator) {
        Object.defineProperty(globalThis, 'navigator', originalNavigator)
      } else {
        Reflect.deleteProperty(globalThis, 'navigator')
      }
    }
  })

  it('maps keyboard press, hold, and release to normalized phases', async () => {
    const { keyboard, provider } = setup()
    await provider.start(request())

    keyboard.dispatchEvent(new InputEventForTest('keydown', { code: 'KeyD' }))
    expect(state(provider, 'player-1', 'MOVE_RIGHT')).toMatchObject({
      value: 1,
      phase: 'started',
    })

    provider.update(16)
    expect(state(provider, 'player-1', 'MOVE_RIGHT').phase).toBe('active')

    keyboard.dispatchEvent(new InputEventForTest('keyup', { code: 'KeyD' }))
    expect(state(provider, 'player-1', 'MOVE_RIGHT')).toMatchObject({
      value: 0,
      phase: 'ended',
    })
  })

  it('keeps the Phase 0 test bindings available through normalized actions', async () => {
    const { keyboard, provider } = setup()
    await provider.start(request())

    keyboard.dispatchEvent(new InputEventForTest('keydown', { code: 'ArrowUp' }))
    keyboard.dispatchEvent(new InputEventForTest('keydown', { code: 'Digit4' }))

    expect(state(provider, 'player-1', 'MOVE_UP')).toMatchObject({
      value: 1,
      phase: 'started',
    })
    expect(state(provider, 'player-1', 'CLAP')).toMatchObject({
      value: 1,
      phase: 'started',
    })
  })

  it('does not retrigger held or repeated pulse inputs every frame', async () => {
    const { keyboard, provider } = setup()
    await provider.start(request())

    keyboard.dispatchEvent(new InputEventForTest('keydown', { code: 'KeyW' }))
    const sequence = state(provider, 'player-1', 'JUMP').sequence
    provider.update(16)
    provider.update(16)
    keyboard.dispatchEvent(
      new InputEventForTest('keydown', { code: 'KeyW', repeat: true }),
    )

    expect(state(provider, 'player-1', 'JUMP').sequence).toBe(sequence)
    expect(state(provider, 'player-1', 'JUMP').phase).toBe('active')
  })

  it('removes actions and old keyboard bindings when the request is reconfigured', async () => {
    const { keyboard, provider } = setup()
    const initialRequest = request()
    await provider.start({ ...initialRequest, actions: ['JUMP', 'RUN'] })

    keyboard.dispatchEvent(new InputEventForTest('keydown', { code: 'KeyW' }))
    provider.triggerAction('player-1', 'JUMP')
    expect(state(provider, 'player-1', 'JUMP').phase).toBe('started')

    await provider.start({ ...initialRequest, actions: ['STRIKE_RIGHT'] })

    const actions = provider.getSnapshot().players[0]?.actions ?? {}
    expect(actions).not.toHaveProperty('JUMP')
    expect(actions).not.toHaveProperty('RUN')
    expect(actions.STRIKE_RIGHT).toMatchObject({ value: 0, phase: 'idle' })

    keyboard.dispatchEvent(new InputEventForTest('keydown', { code: 'KeyW' }))
    expect(provider.getSnapshot().players[0]?.actions).not.toHaveProperty('JUMP')

    await provider.start({ ...initialRequest, actions: ['JUMP'] })
    provider.update(200)
    expect(state(provider, 'player-1', 'JUMP')).toMatchObject({
      value: 0,
      phase: 'idle',
    })
  })

  it('reconciles disallowed action state and bookkeeping when a profile changes', async () => {
    const { keyboard, provider } = setup()
    const initialRequest = request()
    await provider.start({
      ...initialRequest,
      actions: ['STRIKE_LEFT', 'STRIKE_RIGHT'],
    })

    keyboard.dispatchEvent(new InputEventForTest('keydown', { code: 'KeyJ' }))
    provider.triggerAction('player-1', 'STRIKE_LEFT')

    await provider.start({
      ...initialRequest,
      actions: ['STRIKE_LEFT', 'STRIKE_RIGHT'],
      players: [
        {
          ...initialRequest.players[0]!,
          abilityProfile: resolveAbilityProfile(['RIGHT_SIDE']),
        },
      ],
    })

    expect(state(provider, 'player-1', 'STRIKE_LEFT')).toMatchObject({
      value: 0,
      phase: 'idle',
    })
    provider.update(200)
    expect(state(provider, 'player-1', 'STRIKE_LEFT')).toMatchObject({
      value: 0,
      phase: 'idle',
    })

    await provider.start({
      ...initialRequest,
      actions: ['STRIKE_LEFT', 'STRIKE_RIGHT'],
    })
    keyboard.dispatchEvent(new InputEventForTest('keydown', { code: 'KeyJ' }))
    expect(state(provider, 'player-1', 'STRIKE_LEFT').phase).toBe('started')
  })

  it('resets transient input state across stop and restart', async () => {
    const { keyboard, pointer, provider } = setup()
    await provider.start(request())

    keyboard.dispatchEvent(new InputEventForTest('keydown', { code: 'ShiftLeft' }))
    provider.setContinuousValue('player-1', 'VOICE_LEVEL', 0.8)
    pointer.dispatchEvent(
      new InputEventForTest('pointerdown', { clientX: 100, clientY: 50 }),
    )
    pointer.dispatchEvent(
      new InputEventForTest('pointermove', { clientX: 300, clientY: 150 }),
    )

    await provider.stop()

    expect(state(provider, 'player-1', 'RUN')).toMatchObject({
      value: 0,
      phase: 'idle',
    })
    expect(state(provider, 'player-1', 'VOICE_LEVEL')).toMatchObject({
      value: 0,
      phase: 'idle',
    })
    expect(state(provider, 'player-1', 'VOICE_SUSTAINED_DURATION')).toMatchObject({
      value: 0,
      phase: 'idle',
    })
    expect(state(provider, 'player-1', 'POINTER_DRAG')).toMatchObject({
      value: 0,
      phase: 'idle',
    })
    expect(state(provider, 'player-1', 'POINTER_VELOCITY').value).toEqual({
      x: 0,
      y: 0,
      magnitude: 0,
    })

    await provider.start(request())
    provider.update(500)

    expect(state(provider, 'player-1', 'RUN')).toMatchObject({ value: 0, phase: 'idle' })
    expect(state(provider, 'player-1', 'VOICE_LEVEL')).toMatchObject({
      value: 0,
      phase: 'idle',
    })
    expect(state(provider, 'player-1', 'POINTER_DRAG')).toMatchObject({
      value: 0,
      phase: 'idle',
    })
  })

  it('keeps continuous voice values normalized and computes sustained time', async () => {
    const { provider } = setup()
    await provider.start(request())

    provider.setContinuousValue('player-1', 'VOICE_LEVEL', 1.8)
    provider.setContinuousValue('player-1', 'VOICE_PITCH', -0.25)
    provider.update(500)
    provider.update(500)

    expect(state(provider, 'player-1', 'VOICE_LEVEL').value).toBe(1)
    expect(state(provider, 'player-1', 'VOICE_PITCH').value).toBe(0)
    expect(
      state(provider, 'player-1', 'VOICE_SUSTAINED_DURATION').value,
    ).toBeCloseTo(1)
  })

  it('normalizes mouse position and routes it to the selected hand', async () => {
    const { pointer, provider } = setup()
    await provider.start(request())
    provider.setPointerMode('RIGHT_HAND')

    pointer.dispatchEvent(
      new InputEventForTest('pointermove', { clientX: 400, clientY: 100 }),
    )

    expect(state(provider, 'player-1', 'HAND_POSITION_RIGHT').value).toEqual({
      x: 0.75,
      y: 0.25,
    })
  })

  it('supports click, drag, and normalized pointer velocity', async () => {
    const { pointer, provider } = setup()
    await provider.start(request())

    pointer.dispatchEvent(
      new InputEventForTest('pointerdown', { clientX: 100, clientY: 50 }),
    )
    pointer.dispatchEvent(
      new InputEventForTest('pointermove', { clientX: 300, clientY: 150 }),
    )

    expect(state(provider, 'player-1', 'POINTER_CLICK').phase).toBe('started')
    expect(state(provider, 'player-1', 'POINTER_DRAG').value).toBe(1)
    expect(state(provider, 'player-1', 'POINTER_VELOCITY').value).toEqual(
      expect.objectContaining({ magnitude: expect.any(Number) }),
    )

    pointer.dispatchEvent(
      new InputEventForTest('pointerup', { clientX: 300, clientY: 150 }),
    )
    expect(state(provider, 'player-1', 'POINTER_DRAG').phase).toBe('ended')
  })

  it('keeps four logical player states and adaptations independent', async () => {
    const { keyboard, provider } = setup()
    await provider.start(
      request([
        { playerId: 'player-1', profiles: ['STANDARD'] },
        { playerId: 'player-2', profiles: ['SEATED', 'RIGHT_SIDE'] },
        { playerId: 'player-3', profiles: ['LEFT_SIDE'] },
        { playerId: 'player-4', profiles: ['SLOW_RESPONSE'] },
      ]),
    )

    provider.setActivePlayer('player-1')
    keyboard.dispatchEvent(new InputEventForTest('keydown', { code: 'KeyJ' }))
    provider.setActivePlayer('player-2')
    keyboard.dispatchEvent(new InputEventForTest('keydown', { code: 'KeyL' }))
    keyboard.dispatchEvent(new InputEventForTest('keydown', { code: 'KeyJ' }))
    provider.setContinuousValue('player-3', 'VOICE_LEVEL', 0.7)

    expect(state(provider, 'player-1', 'STRIKE_LEFT').value).toBe(1)
    expect(state(provider, 'player-1', 'STRIKE_RIGHT').value).toBe(0)
    expect(state(provider, 'player-2', 'STRIKE_RIGHT').value).toBe(1)
    expect(state(provider, 'player-2', 'STRIKE_LEFT').value).toBe(0)
    expect(state(provider, 'player-3', 'VOICE_LEVEL').value).toBe(0.7)
    expect(provider.getSnapshot().players).toHaveLength(4)
    expect(provider.getSnapshot().players[1]?.abilityProfile.profileIds).toEqual(
      ['SEATED', 'RIGHT_SIDE'],
    )
  })

  it('keeps per-player calibration request metadata out of snapshots', async () => {
    const { provider } = setup()
    const baseRequest = request([
      { playerId: 'player-1', profiles: ['STANDARD'] },
      { playerId: 'player-2', profiles: ['SEATED'] },
    ])
    const calibratedRequest: MotionInputRequest = {
      ...baseRequest,
      players: [
        {
          ...baseRequest.players[0]!,
          calibration: { leftUsableExtent: 0.9, voiceFloorHz: 110 },
        },
        {
          ...baseRequest.players[1]!,
          calibration: { rightUsableExtent: 0.45, voiceFloorHz: 180 },
        },
      ],
    }
    expect(calibratedRequest.players[0]?.calibration).toBeDefined()
    expect(calibratedRequest.players[1]?.calibration).toBeDefined()

    await provider.start(calibratedRequest)

    expect(
      Object.prototype.hasOwnProperty.call(provider.getSnapshot().players[0], 'calibration'),
    ).toBe(false)
    expect(
      Object.prototype.hasOwnProperty.call(provider.getSnapshot().players[1], 'calibration'),
    ).toBe(false)
  })
})
