# Batch C0 — Sports Motion Toolkit

Updated: 2026-09-14

## Outcome and status

Batch C0 supplies the smallest reusable motion foundation for Tennis,
Badminton, Bowling, and Baseball. It recognizes a broad, deliberate wrist/arm
sweep and exposes sanitized wrist availability, body-relative velocity,
direction vector, speed, normalized intensity, and one sequence-safe event per
hand. It is a shared foundation, not a user-facing game.

Engineering status: `ENGINEERING PASS`.

This is engineering evidence only. Windows Chrome, iPhone Safari, compact-space
recognition, fatigue, projector readability, and sport/game-feel tuning remain
unvalidated. No physical swing pass is claimed.

## Public contract

[`sportsMotion.ts`](../src/motion/contracts/sportsMotion.ts) contains the
immutable game-facing contract:

- `SportsHandSide`: anatomical `LEFT` or `RIGHT`;
- `SportsMotionHandState`: available source point, confidence, body-relative
  velocity/vector, speed, intensity, timestamp, and snapshot sequence; or an
  unavailable state with no fabricated position, vector, or speed;
- `SportsSwingEvent`: per-hand occurrence sequence, timestamp, broad vector,
  speed, and bounded intensity;
- `SportsMotionSnapshot`: both hand states plus latest left/right event;
- `SportsMotionSnapshotSource`: `getSnapshot()` and `subscribe()` for future
  game Sessions.

The contract has no Pose frame, landmarks, MediaPipe result, video, stream, or
DOM type. It contains no tennis, badminton, baseball, or bowling labels.

## Coordinate and kinematic semantics

Hand identity is always the participant's anatomical side. Positions retain
canonical source-image coordinates: `x` grows source-left to source-right and
`y` grows source-top to source-bottom. The mirrored camera preview is
presentation-only and never flips a sports hand or vector.

For two valid consecutive wrist samples, the tracker calculates:

```text
dxBody = ((xCurrent - xPrevious) × aspectRatio) / bodyScale
dyBody =  (yCurrent - yPrevious) / bodyScale
speed  = hypot(dxBody, dyBody) / ((tCurrent - tPrevious) / 1000)
```

`velocityX` and `velocityY` use the same body-units-per-second convention.
`vectorX` and `vectorY` are the corresponding unit direction, clamped to
`[-1, 1]`; a motionless usable hand reports the zero vector. Thus positive X
means rightward in canonical source space and positive Y means downward. Games
may interpret broad horizontal/upward/downward intent locally, but the toolkit
never calls it a forehand, smash, serve, home run, or release.

`bodyScale` remains internal to the tracker. It is the existing
aspect-corrected Pose feature scale, so the same body-relative sweep at
reasonable apparent camera scales yields approximately equivalent speed and
intensity.

## Swing detector and thresholds

`SportsMotionProvider` owns separate `IDLE → CANDIDATE → REFRACTORY` state
machines for left and right hands. A candidate requires directionally
consistent high-speed samples; a committed swing emits exactly one event and
cannot fire again until the hand has passed its refractory interval and slowed
enough to re-arm.

The centralized provisional engineering configuration is:

| Setting | Exact value |
|---|---:|
| Enter speed | `1.00` body-units/s |
| Re-arm speed | `0.45` body-units/s or slower |
| Full-intensity speed | `2.40` body-units/s |
| Minimum cumulative displacement | `0.14` body units |
| Minimum active samples | `2` |
| Candidate direction alignment | `0.35` minimum dot product |
| Refractory interval | `300 ms` |
| Maximum continuity gap | `250 ms` |
| Minimum valid body scale | `0.04` |

The values live only in
[`sportsMotionConfig.ts`](../src/motion/sports/sportsMotionConfig.ts). They do
not modify `POSE_MOTION_CONFIG` or existing action thresholds.

## Intensity and safety

For each usable hand, intensity is bounded to `0..1`:

```text
intensity = clamp01((speed - 1.00) / (2.40 - 1.00))
```

The event uses the same mapping. The detector resets velocity continuity and
does not create a swing when timestamps do not increase, the gap exceeds
`250 ms`, a body scale is invalid, source coordinates are invalid, the core
Pose body is unavailable, or runtime lifecycle resets. A brief unavailable
hand has no usable kinematic fields; stop, dispose, suspend, error, stale loss,
and fresh start clear sports events as well.

## Runtime and test sources

`PoseSportsMotionTracker` reuses `PoseFeatureExtractor` against the exact
`PoseSensorFrame` already returned by the existing `PoseGameplayInputRuntime`
inference scheduler. The runtime now ingests that result into its existing
action provider, spatial tracker, presentation tracker, and sports tracker;
there is no second inference session, Hands model, camera controller, or video
owner. Future production games obtain only
`runtime.getSportsMotionSnapshot()`.

`SportsMotionTestProvider` is the camera-free deterministic counterpart for
future game tests and Developer routes:

```ts
provider.triggerSwing('LEFT', {
  timestampMs: 100,
  vectorX: 0.6,
  vectorY: -0.8,
  intensity: 0.7,
})
provider.reset()
```

It preserves independent left/right event sequences and never needs a fake Pose
frame or camera.

## Explicit RELEASE deferral

Batch C0 does **not** define `RELEASE`, `BOWLING_RELEASE`, or any equivalent
event. Bowling v1 may interpret an eligible forward swing in game-local logic.
Only evidence from Batch C3 can justify a separate release contract later.

## Future consumers and deferred QA

The intended consumers are C1 Tennis, C2 Badminton, C3 Bowling, and E Baseball.
They receive this normalized contract only and must own all sport-specific
interpretation. Later physical QA must test deliberate swings, false positives,
false negatives, tracking recovery, compact-space play, timing, fatigue, and
projector readability across Windows Chrome and iPhone Safari landscape before
shared threshold changes are considered.
