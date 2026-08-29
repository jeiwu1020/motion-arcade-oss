# Motion Input Contract

Status: Phase 1C implemented boundary

Contract version: `1.0-phase-1a`

Implementation: [`src/motion/contracts/motion.ts`](../src/motion/contracts/motion.ts)

## 1. Purpose and invariants

Games consume normalized logical-player actions. They never consume MediaPipe landmarks, camera frames, microphone samples, browser pixels, keyboard events, mouse events, or UI slider values.

The same game-facing boundary is used by:

- `KeyboardMouseTestInputProvider` in Phase 1A;
- `PoseMotionInputProvider` for Phase 1C single-person standing Pose analysis;
- a future production sensor manager and microphone provider;
- a future deterministic replay provider.

Provider switching must not require game-specific input code. Phaser is a consumer of the latest immutable snapshot and does not drive provider inference frequency.

## 2. Action identifiers

The implemented `MotionActionId` union is grouped as follows.

| Family | Actions |
|---|---|
| World movement | `MOVE_LEFT`, `MOVE_RIGHT`, `MOVE_UP`, `MOVE_DOWN` |
| Body | `JUMP`, `SQUAT`, `LEAN_LEFT`, `LEAN_RIGHT`, `REACH`, `REACH_LEFT`, `REACH_RIGHT` |
| Arm / sport | `STRIKE`, `STRIKE_LEFT`, `STRIKE_RIGHT`, `THROW`, `ARM_SWING`, `ARM_SWING_LEFT`, `ARM_SWING_RIGHT` |
| Locomotion | `STEP`, `RUN`, `RUN_CADENCE` |
| Hand | `HAND_OPEN`, `HAND_CLOSE`, `PINCH`, `POINT`, `CLAP`, `HAND_POSITION_LEFT`, `HAND_POSITION_RIGHT` |
| Generic pointer test input | `POINTER_POSITION`, `POINTER_CLICK`, `POINTER_DRAG`, `POINTER_VELOCITY` |
| Voice signal | `VOICE_LEVEL`, `VOICE_PITCH`, `VOICE_TRIGGER`, `VOICE_SUSTAINED_DURATION` |

Generic and side-specific actions coexist intentionally. A game declares the semantic it actually consumes; it must not reconstruct a side-specific action from a generic one or vice versa.

## 3. Value and phase semantics

```ts
interface NormalizedPoint2D {
  x: number // 0..1, logical playfield left to right
  y: number // 0..1, logical playfield top to bottom
}

interface NormalizedVector2D extends NormalizedPoint2D {
  magnitude: number // 0..1
}

type MotionActionValue = number | NormalizedPoint2D | NormalizedVector2D
type MotionActionPhase = 'idle' | 'started' | 'active' | 'ended'

interface MotionActionState {
  id: MotionActionId
  value: MotionActionValue
  phase: MotionActionPhase
  confidence: number
  timestampMs: number
  sequence: number
}
```

Rules:

- Binary actions use numeric `0` or `1`; phase preserves press/start and release/end edges.
- Normalized intensity, level, and pitch values are finite and clamped to `0..1`.
- `RUN_CADENCE` is non-negative steps per second. The Phase 1A simulator exposes `0..4` steps/s.
- `VOICE_SUSTAINED_DURATION` is seconds above the voice gate.
- Points use logical playfield coordinates, never DOM or canvas pixels.
- Pointer velocity components are normalized to `-1..1`; magnitude is `0..1`.
- `confidence` is detection confidence, not movement intensity. Test input uses confidence `1`.
- `sequence` changes when a provider emits a new action event. Rendering the same state does not retrigger a pulse.

## 4. Voice semantics

`VOICE_LEVEL` and `VOICE_PITCH` are calibrated gameplay values:

```text
0.0 = participant's calibrated low/floor range
1.0 = participant's calibrated high/ceiling range
```

Games must not understand Hertz or typical vocal ranges. A real provider may estimate physical frequency internally, then apply voicing, confidence, stability, and per-player calibration before emitting normalized pitch.

Developer-only diagnostic telemetry may contain:

```ts
interface MotionDiagnosticTelemetry {
  playerId: PlayerId
  rawPitchHz?: number
  pitchStable?: boolean
  voiced?: boolean
}
```

This diagnostic type is not required by game logic and must not contain recordings or speech transcription.

## 5. Per-player request and calibration

Ability and calibration belong to a logical player, not globally to the provider:

```ts
interface MotionPlayerRequest {
  playerId: PlayerId
  abilityProfile: ResolvedAbilityProfile
  calibration?: PlayerCalibration
}

interface MotionInputRequest {
  players: readonly MotionPlayerRequest[]
  actions: readonly MotionActionId[]
  sensors: SensorRequirements
}
```

Consequently, Player 1 may be `STANDARD` while Player 2 is `SEATED + RIGHT_SIDE`, and their actions remain independent in the same snapshot.

`ResolvedAbilityProfile` expresses intended adaptation. `PlayerCalibration` stores measured usable range for that participant. The two concepts are deliberately separate.

Reserved calibration fields include neutral position, reachable range, left/right usable extent, voice floor/ceiling, and movement baseline. Phase 1A defines this type boundary but does not perform real calibration.

## 6. Ability profile semantics

Available capability presets:

- `STANDARD`
- `LOW_MOTION`
- `SEATED`
- `UPPER_BODY`
- `LEFT_SIDE`
- `RIGHT_SIDE`
- `SLOW_RESPONSE`

Profiles can compose. `SEATED + RIGHT_SIDE` is valid. `LEFT_SIDE` and `RIGHT_SIDE` gate anatomical limb actions such as sided strike, reach, arm swing, and hand position. They do not reverse projected world movement. No diagnosis name is a valid profile or gameplay filter.

Resolved profile metadata is descriptive at the normalized-action boundary:

- `requiredMotionRangeScale` describes the physical range a future sensor adapter may need before emitting the same game-facing normalized value. `LOW_MOTION` therefore does not slow a character or reduce a normalized action value.
- `reactionWindowScale` reserves a future timing-window adjustment for forgiving interactions. `SLOW_RESPONSE` does not automatically slow Phaser animation playback.

The Developer Input Lab consumes normalized action values consistently across profiles; it displays the selected profile for diagnostics only.

## 7. Canonical coordinates and sides

### Anatomical semantics

Sided limb actions always name the participant's own body:

- `STRIKE_LEFT` means the participant's left arm;
- `REACH_RIGHT` means the participant reaches with the right side;
- `HAND_POSITION_LEFT` means the participant's left hand.

Those names never swap merely because a front-camera preview is mirrored.

`LEAN_LEFT` and `LEAN_RIGHT` describe participant-relative lateral posture. They are not treated as exclusive limb-use actions by the single-side profile gate.

### Screen/world semantics

`MOVE_LEFT`, `MOVE_RIGHT`, and normalized `x` coordinates use projected game-world direction:

- `x = 0` is the left edge of the projected playfield;
- `x = 1` is the right edge;
- `MOVE_LEFT` moves toward the projected screen's left side.

### Mirroring boundary

Preview mirroring is display-only. Detector/source coordinates pass through one canonical transform before action mapping:

```text
camera/detector coordinates
  → source-orientation transform (flip x once when mirrored)
  → canonical logical coordinates
  → normalized actions
  → game
```

Games must never inspect the preview mirroring setting or compensate for it. Unit tests cover mirrored/non-mirrored points, horizontal deltas, world direction, and invariant anatomical labels.

## 8. Snapshot and provider contract

```ts
interface PlayerMotionState {
  playerId: PlayerId
  abilityProfile: ResolvedAbilityProfile
  calibration?: PlayerCalibration
  actions: Readonly<Partial<Record<MotionActionId, MotionActionState>>>
}

interface MotionInputSnapshot {
  providerId: ProviderId
  sequence: number
  timestampMs: number
  players: readonly PlayerMotionState[]
}

interface MotionInputProvider {
  readonly id: ProviderId
  start(request: MotionInputRequest): Promise<void>
  stop(): Promise<void>
  update(deltaMs: number): void
  getSnapshot(): MotionInputSnapshot
  subscribe(listener: () => void): () => void
  isRunning(): boolean
}
```

Lifecycle rules:

- `start()` may initialize or reconfigure the provider request without duplicating listeners.
- `stop()` is idempotent and releases every provider-owned listener, track, worker, task, and timer.
- Provider time is separate from Phaser render time.
- A coordinator stops the previous provider before starting a replacement.
- The test provider cannot request camera/microphone permissions or import MediaPipe.

## 9. Sensor requirements

Phase 1A uses an explicit loading request:

```ts
interface SensorRequirements {
  pose: boolean
  hands: boolean
  audio: boolean
}
```

All values are `false` for the Developer Input Lab. A future capability-negotiation result may add optional/required tiers and preferred tracked-body counts without changing game action semantics.

## 10. Test provider behavior

`KeyboardMouseTestInputProvider` owns all DOM bindings and simulated values. It supports one to four independent players, profile changes, hold/release phases, non-retriggering pulses, continuous values, pointer position/click/drag/velocity, and left-hand/right-hand/generic-pointer routing.

The React control panel writes provider values. The Phaser test scene only reads `MotionInputSnapshot`; it contains no key, mouse, or slider knowledge.

`start(request)` reconciles the action set exactly: removed actions and players disappear from the snapshot, and their pressed-key and pulse bookkeeping is discarded. A profile change immediately neutralizes actions that the new profile disallows. `stop()` is idempotent and resets transient actions, pointer history/drag state, pulse timers, pressed keys, and voice-sustained runtime state; a subsequent start is neutral until new input arrives.

## 11. Teams are outside this contract

`PlayerId`, `TeamId`, and real `SensorTrackId` are separate identities. Registry `supportedTeams` is independent from `simultaneousPlayers`. A four-team relay can use one logical player/input channel at a time.

## 12. Replay and freshness

The immutable snapshot, timestamp, sequence, and explicit phases preserve a future deterministic replay path. Phase 1C's Pose provider neutralizes actions after `250 ms` without a valid Pose and requires a fresh temporary baseline after `1,200 ms` of loss. The freshness check occurs while querying/updating the provider and does not depend on receiving another MediaPipe frame.

The temporary standing baseline is in-memory session state, is reset on provider start/stop, and is not `PlayerCalibration`. Replay serialization, general capability negotiation, multi-person tracking continuity, and production calibration remain deferred. These additions must extend the provider boundary without exposing raw sensors to games.
