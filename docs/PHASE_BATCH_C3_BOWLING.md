# Phase Batch C3 — Bowling / 保齡球大賽

## Status

Bowling is an **Engineering Prototype PASS** and **Physical QA PENDING**.
This batch does not claim physical bowling-motion recognition, iPhone Safari,
fatigue, compact-space, or projector validation.

## Game loop

Bowling is a single-player arcade match with five compact-space frames. The
player watches a Core-owned aim marker sweep across the lane and performs one
left- or right-hand C0 swing. In Bowling, that one game-local swing attempt is
interpreted as one arcade release. The ball rolls for 1,400 ms, pins settle for
800 ms, and the next frame transition takes 700 ms. A strike ends its frame
after the first roll. Otherwise the standing pins persist for roll two, and the
next frame resets all ten pins. Frame five ends in a stable result screen.

## Aim and deterministic pin resolution

The aim marker is a Core-owned triangle wave from -1 (far left) to +1 (far
right) and back over an exact 2,500 ms cycle. The renderer only projects the
current value. At release, `vectorX` contributes a bounded `±0.18` bias and the
final effective aim is clamped to `[-1, 1]`.

The Core resolver uses fixed normalized 1/2/3/4 pin positions, a bounded
power-scaled impact radius, and one bounded neighboring-pin cascade pass. It
filters only the current standing pin set, so a roll cannot knock a nonexistent
or already-knocked pin. Center high-power throws can strike; edge and low-power
throws generally clear fewer pins. The resolver is deterministic for the same
seed, aim, power, and standing pins; it deliberately avoids nondeterministic
Phaser physics and `Math.random`.

## Sports Motion consumption and sequence safety

`BowlingSession` is the only bridge from `SportsMotionSnapshotSource` to the
game. It maps each new retained LEFT or RIGHT event into the small
`BowlingSwingAttempt` contract containing hand, timestamp, vectors, intensity,
and sequence. Core never imports `SportsMotionProvider`, Pose runtime,
`PoseSensorFrame`, landmarks, camera objects, or MediaPipe data.

The Session tracks left and right sequences independently. It marks retained
sequences at start and replay, consumes only strictly newer sequences, and
marks new events even while unready, hard-paused, or outside AIMING. Those
events are dropped rather than replayed after recovery. Core accepts a roll
only in AIMING, and one event can start at most one roll.

## Power, curve, and scoring

Intensity is clamped to `[0, 1]` and maps to `power = 0.65 + intensity × 0.35`.
`vectorX` only changes the small effective-aim/curve bias; it never gates a
valid release. `vectorY` is not required for success and is intentionally not
used as a biomechanical classification. The UI may label the bounded result as
left curve, straight, or right curve as arcade presentation only.

Arcade Score is not official bowling scoring:

- each knocked pin: `+10`;
- strike: `+50`;
- spare: `+25`;
- consecutive strike bonus: `+20` for each strike after the first, capped at
  `+60` additional bonus;
- no negative score.

The Core tracks total pins, strikes, spares, current/best strike streak, and
left/right hand roll counts. A strike streak resets on any non-strike roll.

## Production path

Production uses the existing `PoseGameplayInputRuntime` and the same Pose
inference result that feeds C0 Sports Motion. It requests `UPPER_BODY`, with
`pose: true`, `hands: false`, and `audio: false`. Camera acquisition is only
started by the explicit camera button. Setup and recovery use the shared
mirrored camera presentation; active play is an opaque Phaser lane. Tracking
loss pauses every Core timer, including aim, ball, settling, and transition;
recovery resumes the same state.

## Engineering decision on RELEASE

C0's existing broad `SportsSwingEvent` is sufficient for this engineering
game contract: one newer swing event can trigger one arcade bowling release.
This is not evidence that physical bowling release recognition is validated.
No shared `RELEASE`, `BOWLING_RELEASE`, `THROW`, or `ROLL` event was added.
Physical QA remains pending and may inform a future shared-foundation task only
if real-device evidence shows the broad swing is insufficient.
