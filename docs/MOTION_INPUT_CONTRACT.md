# Motion Input Contract

Status: Phase 2A.3a action + normalized spatial-hand gameplay boundary

Contract version: `1.0-phase-1a`

Implementation: [`src/motion/contracts/motion.ts`](../src/motion/contracts/motion.ts)

## 1. Purpose and invariants

Games consume normalized logical-player actions. They never consume MediaPipe landmarks, camera frames, microphone samples, browser pixels, keyboard events, mouse events, UI slider values, or player calibration/body-unit measurements.

The same game-facing boundary is used by:

- `KeyboardMouseTestInputProvider` in Phase 1A;
- `PoseMotionInputProvider` for Phase 1C single-person standing Pose analysis;
- the focused production `PoseGameplayInputRuntime` that owns camera/Pose acquisition for current gameplay, plus any future generic sensor manager;
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

`VOICE_LEVEL` is a calibrated gameplay loudness value. `VOICE_PITCH` remains a
reserved calibrated gameplay value, but production F0 deliberately defers it
pending real-device evidence:

```text
0.0 = game-control floor range
1.0 = game-control full range
```

Games must not understand dBFS, Hertz, microphone internals, or typical vocal
ranges. F0 derives `VOICE_LEVEL` from transient RMS/dBFS analysis and never
emits production pitch. A future pitch provider must establish voicing,
confidence, stability, and real-device validation before emitting normalized
pitch.

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

Consequently, Player 1 may be `STANDARD` while Player 2 is `SEATED + RIGHT_SIDE`, and their actions remain independent in the same provider request.

`ResolvedAbilityProfile` expresses intended adaptation. `PlayerCalibration` stores measured usable range for that participant. The two concepts are deliberately separate.

Phase 1D.1 defines canonical `PlayerCalibration` version 1. It stores only body-relative MOVE/LEAN/SQUAT ranges, dimensionless anatomical left/right REACH capability, step completeness, and aggregate quality metadata. Skipped/unavailable measurements are `null`; raw landmarks, frames, pixels, images, and streams are prohibited. The original Phase 1A reserved fields remain accepted as a deprecated compatibility branch for existing provider behavior and must not be emitted by new calibration code.

The single-person `PoseMotionInputProvider` validates only canonical v1 calibration from its first requested player and resolves a session-specific detector config once during `start()`. Valid measurements adapt MOVE, LEAN, anatomical REACH, and SQUAT independently through safety clamps; missing or invalid fields retain STANDARD behavior unless the explicit LOW_MOTION profile requests the same bounded scaling from STANDARD defaults. The deprecated compatibility shape never activates calibration adaptation. JUMP is not calibration- or functional-profile-driven. Ability profiles and calibration remain separate concepts.

Calibration is an input-only provider concern. `MotionPlayerRequest.calibration` may be consumed by a sensor provider, but it must not be copied into `PlayerMotionState` or `MotionInputSnapshot`. Games receive the resulting normalized actions, not body-unit calibration measurements.

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

Resolved profile metadata drives provider-local adaptation but remains descriptive at the normalized-action boundary:

- `requiredMotionRangeScale` is `0.6` for LOW_MOTION and `1` otherwise. The Pose provider applies it to MOVE, LEAN, REACH normalization, and SQUAT through the established safety clamps. It does not slow a character or reduce a normalized action value.
- `reactionWindowScale` is `1.75` for SLOW_RESPONSE and `1` otherwise. The Pose provider converts it to a timestamp-based 240 ms activation-candidate grace without lowering physical gates. It does not slow Phaser animation playback.

LOW_MOTION and SLOW_RESPONSE compose independently. STANDARD retains exact Phase
1D.2 behavior and full-body readiness requirements. SEATED and UPPER_BODY select
an upper-body analyzer baseline that requires shoulders and hips, not knees or
ankles. Both support MOVE_LEFT/RIGHT from pelvis translation, LEAN_LEFT/RIGHT,
REACH, and anatomical REACH_LEFT/RIGHT. SQUAT and JUMP remain neutral and
unavailable in those modes even when lower-body landmarks are visible. Existing
standing calibration is ignored for these modes because its measurements are not
valid for the profile; bounded STANDARD torso fallback and explicit
LOW_MOTION/SLOW_RESPONSE modifiers remain available. LEFT_SIDE/RIGHT_SIDE Pose
expansion remains deferred.

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

### Spatial hand boundary

Phase 2A.3a adds a separate immutable `SpatialHandSnapshot` at
`src/motion/contracts/spatial.ts`, exposed by the production
`PoseGameplayInputRuntime.getSpatialSnapshot()`. It is intentionally separate
from `MotionInputSnapshot`: existing games continue consuming actions only, and
spatial positions do not repurpose the reserved `HAND_POSITION_*` action IDs.

`leftHand` and `rightHand` retain the participant's anatomical sides. An
`AVAILABLE` hand contains source-image-normalized `x` and `y` (`0..1`),
confidence, timestamp, and sample sequence. An `UNAVAILABLE` hand contains no
fallback coordinate. Missing, low-confidence, non-finite, out-of-source, stale,
or reset-lifecycle wrist samples are unavailable.

Spatial `x = 0..1` runs from source-image left to right and `y = 0..1` from
source-image top to bottom. These are not logical playfield coordinates. The
mirrored DOM preview does not alter them or swap anatomy.

Phase 2A.3b maps an `AVAILABLE` source point into the current DOM
`CameraPresentationStage` through the pure
`mapCanonicalSourcePointToMirroredStage` helper. It first resolves the actual
`object-fit: contain` source-video rectangle from real video and stage
dimensions, including letterbox/pillarbox offsets, then applies a horizontal
display mirror only at that presentation boundary. The resulting point is
stage-local CSS pixels for the engineering diagnostic; it does not mutate a
`SpatialHandSnapshot` and is not a Phaser/game-world coordinate. Unavailable
hands produce no display point. Phaser/playfield mapping and collision remain
deferred from this public contract.

Phase 2A.3c adds a separate, session-local presentation/game adapter:
`SpatialCollisionInputAdapter`. It composes that display map with Phaser's
centered `1280 × 720` `Scale.FIT` rectangle and produces logical hand points
or `null`, never a clamped fallback. It may retain previous/current logical
points for a swept collision segment only while availability, sequence,
timestamp, and presentation geometry are continuous. This adapter, its
collision state, and temporary Phaser probe are not fields of
`SpatialHandSnapshot`, `MotionInputSnapshot`, or `PlayerMotionState`; Game
Core still receives no Pose, DOM, camera, or body-coordinate data.

Phase 2A.4's `BalloonRallySession` is the first production consumer of this
logical boundary. It translates a logical wrist contact into pure Core contact
events; the public spatial/action snapshots remain unchanged. A registry
control scheme may declare `requiresSpatialHands: true` when it consumes this
normalized spatial boundary rather than a `MotionActionId`.

Balloon Rally v2 keeps strict UPPER_BODY setup, then applies a session-local
active-game tracking policy after play starts. Useful tracking loss up to 1,500
ms is DEGRADED and continues Core time; 1,500–3,000 ms is SOFT_RECOVERY and
freezes time/physics without a blocking framing overlay; >=3,000 ms or a
sensor/runtime failure is HARD_PAUSE. This is controller policy, not a change
to `SpatialHandSnapshot`, `MotionInputSnapshot`, analyzer readiness, or any
FULL_BODY game's readiness rule. A wrist remains independently AVAILABLE or
UNAVAILABLE throughout; no fake coordinate is emitted for a missing hand.

## 8. Snapshot and provider contract

```ts
interface PlayerMotionState {
  playerId: PlayerId
  abilityProfile: ResolvedAbilityProfile
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
- Providers must strip request-only calibration metadata from game-facing snapshots.

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

The React control panel writes provider values. The Phaser test scene only reads `MotionInputSnapshot`; it contains no key, mouse, slider, or calibration/body-unit knowledge.

`start(request)` reconciles the action set exactly: removed actions and players disappear from the snapshot, and their pressed-key and pulse bookkeeping is discarded. A profile change immediately neutralizes actions that the new profile disallows. `stop()` is idempotent and resets transient actions, pointer history/drag state, pulse timers, pressed keys, and voice-sustained runtime state; a subsequent start is neutral until new input arrives.

## 11. Teams are outside this contract

`PlayerId`, `TeamId`, and real `SensorTrackId` are separate identities. Registry `supportedTeams` is independent from `simultaneousPlayers`. A four-team relay can use one logical player/input channel at a time.

## 12. Replay and freshness

The immutable snapshot, timestamp, sequence, and explicit phases preserve a future deterministic replay path. Phase 1C's Pose provider neutralizes actions after `250 ms` without a valid Pose and requires a fresh temporary baseline after `1,200 ms` of loss. The freshness check occurs while querying/updating the provider and does not depend on receiving another MediaPipe frame. Analyzer diagnostics distinguish `upperBodyReady` from `fullBodyReady`; these readiness fields stay outside the game-facing snapshot. Phase 2A.2a's gameplay runtime uses `quality === 'READY'`, `baselineReady`, and `fullBodyReady` to pause or resume the Balloon Pop clock, but neither analyzer diagnostics nor Pose landmarks cross into the Game Core or Phaser scene.

The Balloon Rally runtime explicitly requests `UPPER_BODY`, so the same READY
quality and baseline use `upperBodyReady` rather than requiring knees/ankles.
FULL_BODY remains the default for existing games.

The temporary Phase 1C analyzer baseline is in-memory provider state, is reset on provider start/stop, and is not `PlayerCalibration`. Phase 1D calibration remains caller-provided and in memory. Provider stop releases its calibration request; there is no persistence or upload. Replay serialization, calibration persistence, general capability negotiation, multi-person tracking continuity, production onboarding, and JUMP adaptation remain deferred. These additions must extend the provider boundary without exposing raw sensors or body-unit values to games.

The Phase 2A.3a spatial tracker is likewise in-memory only. It consumes the
same inference frame as the action provider, shares the existing `250 ms` Pose
freshness interval, and resets to coordinate-free unavailability on stop,
suspend, dispose, or sensor error. Its wrist availability does not require
full-body readiness, knees, or ankles; the current Balloon Pop game readiness
rule remains unchanged.

### Pose tracking presentation snapshot

`PoseGameplayInputRuntime.getPoseTrackingSnapshot()` is a separate,
presentation-only read boundary. It contains exactly selected shoulders,
elbows, wrists, hips, knees, and ankles as immutable source-image-normalized
`x`/`y`, confidence, and validity data plus timestamp/sequence/pose-present
metadata. It never exposes a raw `PoseSensorFrame`, full landmark array,
MediaPipe result, stream, or game-facing input field. Missing, stale, and reset
points are coordinate-free and invalid. Camera Presentation maps it using the
same contain-fit rectangle and display-only mirror as the video.

### FULL_BODY lower-body readiness policy

Default `STRICT` FULL_BODY readiness requires core landmarks, both knees, and
both ankles. An explicitly configured `KNEES` policy requires core landmarks
and both knees while making ankles optional for compact-space setup. This
changes readiness/baseline eligibility only; confidence, freshness, temporal
grace, and action safety remain unchanged. Optional ankle baseline values are
never fabricated, and JUMP continues requiring strict full-body/real-ankle
data.
