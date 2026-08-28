# Motion Input Contract — Draft

Status: Phase 0 interface draft; algorithms are intentionally absent.  
Version: `0.1-draft`

## Purpose

Games consume normalized player action state. They do not consume MediaPipe landmarks, camera frames, microphone samples, keyboard events, mouse events, or a specific provider implementation.

The same game must run unchanged with:

- real camera/microphone analysis;
- desktop keyboard/mouse simulation;
- a future deterministic replay sequence.

## Action identifiers

```ts
export type MotionActionId =
  // Directional movement (continuous intensity 0..1)
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'MOVE_UP'
  | 'MOVE_DOWN'

  // Body actions
  | 'JUMP'
  | 'SQUAT'
  | 'LEAN_LEFT'
  | 'LEAN_RIGHT'
  | 'REACH'
  | 'REACH_LEFT'
  | 'REACH_RIGHT'

  // Arm and sport actions
  | 'STRIKE'
  | 'STRIKE_LEFT'
  | 'STRIKE_RIGHT'
  | 'THROW'
  | 'ARM_SWING'
  | 'ARM_SWING_LEFT'
  | 'ARM_SWING_RIGHT'

  // Locomotion
  | 'STEP'
  | 'RUN'
  | 'RUN_CADENCE'

  // Hand actions
  | 'HAND_OPEN'
  | 'HAND_CLOSE'
  | 'PINCH'
  | 'POINT'
  | 'CLAP'

  // Voice signal actions — never recorded or transcribed
  | 'VOICE_LEVEL'
  | 'VOICE_PITCH'
  | 'VOICE_TRIGGER'
  | 'VOICE_SUSTAINED_DURATION'

  // Optional normalized spatial input for target-based games
  | 'POINTER_POSITION'
```

Generic `REACH`, `STRIKE`, and `ARM_SWING` let games ignore side. A provider may emit a generic action derived from a side-specific action, but a game should register either the generic semantic or the sided semantic it truly needs. Games must not infer one from the other themselves.

## Value semantics

```ts
export type ActionValue = boolean | number | NormalizedPoint

export interface NormalizedPoint {
  /** Left/top = 0; right/bottom = 1 in logical playfield space. */
  x: number
  y: number
}

export type ActionPhase = 'idle' | 'started' | 'active' | 'ended'

export interface MotionActionSample<T extends ActionValue = ActionValue> {
  id: MotionActionId
  value: T
  phase: ActionPhase
  /** Detection certainty, not physical intensity. */
  confidence: number
  /** Monotonic provider timestamp. */
  timestampMs: number
  /** Monotonically increasing per player/provider. */
  sequence: number
  /** Consumer should treat the sample as idle after this time. */
  expiresAtMs: number
}
```

Rules:

- Boolean actions use `false/true`; their `phase` preserves edges across differing inference and render rates.
- Directional movement, lean, reach, strike, swing, throw, and voice level use normalized intensity `0..1` where useful.
- `RUN_CADENCE` is steps per second (Hz), not a boolean.
- `VOICE_LEVEL` is a normalized `0..1` level after calibration/noise gating.
- `VOICE_PITCH` is Hertz. `confidence` must fall when no stable voiced pitch is present.
- `VOICE_SUSTAINED_DURATION` is seconds above the configured voice gate.
- `POINTER_POSITION` uses logical normalized coordinates and never exposes browser pixel coordinates to a game.
- All normalized values are finite and clamped to their declared range. Missing/stale data is not silently reused forever.

## Player and frame state

```ts
export type TrackingStatus =
  | 'unavailable'
  | 'starting'
  | 'calibrating'
  | 'ready'
  | 'limited'
  | 'lost'

export interface MotionPlayerState {
  playerId: string
  trackingStatus: TrackingStatus
  actions: Partial<Record<MotionActionId, MotionActionSample>>
  quality: {
    confidence: number
    stale: boolean
  }
}

export interface MotionInputFrame {
  providerId: string
  providerKind: 'real' | 'test' | 'replay'
  timestampMs: number
  players: ReadonlyMap<string, MotionPlayerState>
}
```

The contract contains logical players, not teams. A separate team/session mapping assigns each `playerId` to a `TeamId`.

## Provider contract

```ts
export interface MotionInputProvider {
  readonly id: string
  readonly kind: 'real' | 'test' | 'replay'

  start(request: MotionInputRequest): Promise<void>
  stop(): Promise<void>

  /** Advance provider-owned timers; must not drive Phaser FPS. */
  update(deltaMs: number): void

  getFrame(): MotionInputFrame
  getPlayerState(playerId: string): MotionPlayerState | undefined
}

export interface MotionInputRequest {
  playerIds: readonly string[]
  actions: readonly MotionActionId[]
  sensors: SensorRequirements
  abilityProfile: ResolvedAbilityProfile
}
```

`start()` is idempotent for an equivalent request or explicitly stops/reconfigures the old request. `stop()` releases camera/audio tracks, MediaPipe tasks, workers, DOM listeners, and timers owned by the provider. A test provider's `start()` must not request real permissions or load MediaPipe.

## Sensor requirements

```ts
export interface SensorRequirements {
  pose?: 'required' | 'optional'
  hands?: 'required' | 'optional'
  gestureRecognizer?: 'required' | 'optional'
  audio?: 'required' | 'optional'
  preferredMaxTrackedBodies?: 1 | 2 | 3 | 4
}
```

This is a loading/lifecycle request, not a promise that all devices meet the preferred maximum. Provider capability negotiation returns a separate result before gameplay begins.

## Ability profile inputs

```ts
export type AbilityProfileId =
  | 'STANDARD'
  | 'LOW_MOTION'
  | 'SEATED'
  | 'UPPER_BODY'
  | 'LEFT_SIDE'
  | 'RIGHT_SIDE'
  | 'SLOW_RESPONSE'

export interface ActionAdaptation {
  activationThreshold?: number
  releaseThreshold?: number
  minimumHoldMs?: number
  cooldownMs?: number
  reactionWindowScale?: number
  intensityScale?: number
  acceptedSides?: readonly ('left' | 'right')[]
}

export interface ResolvedAbilityProfile {
  id: AbilityProfileId
  actions: Partial<Record<MotionActionId, ActionAdaptation>>
}
```

Profiles configure mapping semantics. Disease names are invalid profile identifiers and must not appear in core gameplay.

## Test provider requirements

The keyboard/mouse provider owns remappable bindings. Suggested defaults may include `A/D` movement, `W` jump, `S` squat, `Q/E` lean, `J/L` strikes, Space throw, Shift run, and number keys for hand actions, but no game may hard-code them.

The provider must also accept continuous developer-panel values for:

- movement/intensity;
- `RUN_CADENCE`;
- `VOICE_LEVEL`;
- `VOICE_PITCH`;
- `VOICE_SUSTAINED_DURATION`;
- normalized pointer/hand position;
- simulated player count and side.

Pointer motion may map position, click, drag, swipe, and velocity into normalized actions. Those mapping decisions remain test-provider configuration.

## Replay compatibility

The provider contract permits a future sequence such as:

```ts
export interface ReplayActionEntry {
  atMs: number
  playerId: string
  action: MotionActionId
  value: ActionValue
  phase?: ActionPhase
  confidence?: number
}
```

Replay time is provider-owned and monotonic. Given the same game seed, configuration, and replay sequence, renderer-independent game core behavior should be deterministic. Phase 0 does not implement serialization or a replay runner.

## Debug snapshot

A debug overlay reads the same `MotionInputFrame` as a game. It may show provider kind, player, values, phase, confidence, cadence, pitch, and freshness. It must not display/store camera frames, microphone samples, raw landmarks, faces, or patient names.

## Error and lifecycle policy

- Permission denied, unsupported capability, initialization failure, and tracking loss are typed provider states rather than thrown into a Phaser update loop.
- Games receive `unavailable/limited/lost` and choose a registry-declared fallback or pause request.
- Provider switching occurs through the runtime coordinator. Games keep the same contract instance/bridge and are not reconstructed solely because input hardware changed.
- Page hide, route change, game stop, and session end release real sensor resources.

## Deferred questions

- Final generic-versus-sided action emission policy.
- Exact pulse duration and stale timeout defaults per action family.
- Whether `MOVE_*` remains four scalar actions or gains a canonical two-axis vector in a later contract version.
- Capability negotiation result shape and fallback ranking.
- Multi-player identity continuity across temporary occlusion.
- Replay serialization/version migration.
