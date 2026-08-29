# Motion Arcade — Phase 1C Pose Motion Analyzer

Status: Implemented foundation; standard standing validation only

Date: 2026-08-29

## Purpose and architecture

Phase 1C converts the single-person, MediaPipe-independent sensor DTO into the
existing normalized action contract:

```text
Camera
  → MediaPipe Pose
  → PoseSensorFrame
  → PoseFeatureExtractor
  → PoseFeatureFrame
  → PoseMotionAnalyzer
  → PoseMotionInputProvider
  → immutable MotionInputSnapshot
```

Camera acquisition, MediaPipe task ownership, inference scheduling, feature
extraction, temporal detection, and provider lifecycle remain separate. Games
receive only the existing `MotionActionState` values; they never receive raw
landmarks, MediaPipe classes, camera frames, or analyzer internals.

The gated, lazy Pose Sensor Lab now includes Motion Analyzer diagnostics. It is
developer tooling, not calibration or a formal game. The provider is not the
HOME default.

## Feature extraction

`PoseFeatureExtractor` is deterministic and stateless. All MediaPipe landmark
indexes are interpreted in that one module. Its output includes:

- anatomical left/right shoulders, elbows, wrists, hips, knees, and ankles;
- shoulder and hip midpoints, torso/body center, torso length, and shoulder
  width;
- aspect-corrected knee angles and arm extension ratios;
- per-point confidence/validity, core validity, and full-body validity.

Visibility and presence are combined conservatively by using their minimum.
The default landmark-validity floor is `0.55`. A missing/invalid wrist disables
only the detector that needs that wrist; missing lower-body landmarks disable
standing baseline, SQUAT, and JUMP. Extraction never mutates the source frame.

## Body-relative normalization

Distance calculations correct normalized horizontal coordinates by the source
aspect ratio before comparing them with vertical distance. `bodyScale` is the
larger of torso length and shoulder width. Detector distances and velocities
are expressed in multiples of that scale, so thresholds do not depend on
camera resolution, pixel height, or a fixed participant distance.

The baseline averages its observed body scale. This is a session-local
normalizer, not a persisted body measurement.

## Temporary neutral baseline

A standard-standing baseline requires stable, valid full-body frames for at
least `800 ms` and at least eight samples. Consecutive pelvis motion must remain
within `0.18` body units. The in-memory average records neutral pelvis position,
ankle height, body scale, and aspect ratio.

All normalized actions remain neutral while baselining. `reset()`, provider
start, provider stop, and tracking loss longer than `1,200 ms` clear the
baseline and transient detector states. Nothing is written to storage. This
does not replace a future therapist-guided calibration activity.

## Tracking quality and freshness

Analyzer quality is explicit:

- `LOST`: no valid core pose or the last pose is stale;
- `LIMITED`: a core pose exists but required full-body landmarks are missing;
- `BASELINING`: stable neutral samples are being collected;
- `READY`: the standing baseline and full-body tracking are valid.

No pose neutralizes actions immediately. A pose becomes stale after `250 ms`,
and `getSnapshot(nowMs)` performs that check even when MediaPipe has stopped
producing frames. Thus stale clearing does not depend on another inference.
After `1,200 ms` without a valid pose, recovery requires a new temporary
baseline.

## Smoothing, debounce, and hysteresis

The analyzer applies a deterministic EMA with alpha `0.55`. A direction
reversal restarts the signed filter at zero to prevent the old direction from
adding avoidable latency. MOVE, LEAN, REACH, and SQUAT activation use two-frame
debounce where applicable. Enter and exit thresholds differ:

| Detector | Enter | Exit | Full intensity / supporting rule |
|---|---:|---:|---|
| MOVE | `0.22` body units | `0.12` | `0.75` body units |
| LEAN | `0.18` torso units | `0.10` | `0.55` torso units |
| REACH | score `0.68` | score `0.50` | elbow ≥ `150°`, outside ≥ `0.55` body units or wrist above hips |
| SQUAT | depth `0.30` | depth `0.16` | full depth `0.65`, knee angle ≤ `155°` |

All continuous action values are clamped to `0..1`. Confidence remains
separate from intensity.

## MOVE

MOVE is lateral game-world intent, not walking or cadence. The analyzer compares
the pelvis horizontal center with neutral and applies the existing canonical
coordinate transform. The current front-camera Lab uses the `MIRRORED` source
orientation transform so a raw detector delta is flipped exactly once into
projected world direction. It emits only the existing `MOVE_LEFT` and
`MOVE_RIGHT` actions.

The preview CSS mirror never mutates a landmark and games do not compensate for
mirroring.

## LEAN

LEAN uses the horizontal shoulder-midpoint to hip-midpoint offset divided by
torso length. Translating shoulders and hips together therefore creates MOVE
without a large LEAN signal. Signed output maps to the existing `LEAN_LEFT` and
`LEAN_RIGHT` actions.

## REACH

Each anatomical arm is evaluated independently from its named shoulder, elbow,
and wrist Pose landmarks. A valid reach requires an extended elbow plus either
meaningful distance outside the shoulder envelope or a wrist above the hips.
This prevents a straight arm hanging beside the torso from counting as a reach.

The provider publishes existing `REACH_LEFT`, `REACH_RIGHT`, and generic
`REACH`. Anatomical names never swap because the preview is mirrored. No Hand
Landmarker is used.

## SQUAT

SQUAT combines neutral-relative pelvis drop and bilateral knee flexion. Its
states are `STANDING → DESCENDING → SQUAT → RISING → STANDING`. Two-frame entry
and exit debounce plus distinct thresholds prevent tracking jitter near the
boundary from repeatedly toggling the action. The existing numeric `SQUAT`
value exposes normalized depth.

## JUMP state machine

JUMP is a pulse, not a held pose:

```text
GROUNDED
  → TAKEOFF_CANDIDATE
  → AIRBORNE (emit JUMP once)
  → LANDING
  → REFRACTORY
  → GROUNDED
```

Takeoff requires all of these body-relative signals: pelvis rise of at least
`0.10`, upward pelvis velocity of at least `1.2` body units/second, and both
feet rising at least `0.08`. The candidate must reach `0.32` pelvis rise within
`180 ms`. Landing is accepted below `0.08` rise, followed by a `500 ms`
refractory period. This combination rejects a squat recovery where the pelvis
returns only to neutral and the feet do not rise. Missing ankles disables JUMP;
false negatives are preferred to frequent false positives.

## Provider integration

`PoseMotionInputProvider` obeys `MotionInputProvider`, works with
`MotionProviderCoordinator`, and supports the first requested logical player
only because Phase 1C explicitly excludes multi-person Pose and player
assignment. It filters to the request's action IDs and applies the existing
ability-profile anatomical-side gate. Every published snapshot, player array,
player state, action map, and action state is frozen.

Start and stop reset the analyzer and session baseline. Polling the provider
performs freshness neutralization without rerunning feature extraction or
MediaPipe. Unsupported requested actions remain neutral; Phase 1C implements
only MOVE, LEAN, REACH, SQUAT, and JUMP.

## Developer Lab diagnostics

The gated Pose Sensor Lab displays tracking quality, baseline progress,
freshness, MOVE and LEAN direction/intensity, anatomical left/right REACH,
SQUAT state/intensity, JUMP state/pulse, and approximate analyzer execution
time. It does not dump all 33 landmarks. The module remains behind
`VITE_ENABLE_REAL_SENSOR_LAB` and is lazy-loaded with the existing Pose Lab.

## Privacy impact

Phase 1C adds no network path, backend, upload, recording, screenshot, logging,
analytics, localStorage, IndexedDB, or persisted measurement. Features,
baseline values, and detector states exist only in memory and reset with the
sensor session. The separate MediaPipe SDK telemetry warning remains unchanged.

## Deterministic tests

Artificial coordinate builders cover neutral standing, world MOVE left/right,
LEAN left/right, anatomical left/right REACH, SQUAT, JUMP takeoff/airborne,
low confidence, missing pose, stale pose, and tracking loss. No real camera
capture or patient data is checked in.

## Manual desktop and iPhone QA

Use `run_pose_lab.bat`, frame the full body, and press **啟動相機**. Verify:

1. neutral standing reaches READY without actions;
2. lateral MOVE follows the projected left/right direction;
3. LEAN is distinct from translating the whole body;
4. left/right REACH remains anatomical;
5. SQUAT activates once without boundary chatter;
6. one physical jump produces one pulse;
7. 30–60 seconds standing still produces no false action;
8. pose loss neutralizes within roughly 250 ms and long loss re-baselines;
9. Stop/restart clears baseline and transient state;
10. HOME never requests camera permission.

For physical iPhone Safari, also assess landscape framing, latency, projector
direction, false positives, background/suspension recovery, and 30–60 second
stability. Automated or emulated results are not a substitute.

`MANUAL DEVICE TEST REQUIRED`

## Limitations and deferred actions

This is the initial standard-standing, single-person foundation. It does not
claim production calibration or support for SEATED, UPPER_BODY, LEFT_SIDE,
RIGHT_SIDE, LOW_MOTION, or SLOW_RESPONSE detector configurations. It does not
persist body measurements or handle track identity.

STRIKE, THROW, ARM_SWING, RUN, STEP, CADENCE, Hands, gestures, microphone,
voice, multi-person Pose, player assignment, formal games, scoring,
achievements, and diagnosis-specific logic remain deferred.
