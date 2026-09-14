# Phase Batch D0 — Locomotion Toolkit

## Status

D0 is an **Engineering Prototype PASS** and **Physical QA PENDING** shared
foundation. It recognizes bounded alternating knee-lift rhythm for future
compact-space games. It does not claim gait, cadence, running-speed, distance,
or real-device physical validation.

## Public contract and architecture

`LocomotionSnapshot` is the only game-facing output. It contains immutable
timestamp and snapshot sequence values, availability, `cadenceSpm`, normalized
`intensity`, and the retained `latestStep`. A `LocomotionStepEvent` contains a
global event sequence, anatomical `LEFT` or `RIGHT` side, timestamp, and
bounded lift intensity. It exposes no Pose frame, landmark, body scale, camera,
or inference object.

The existing single `PoseGameplayInputRuntime` inference result flows through
`PoseFeatureExtractor` into `PoseLocomotionTracker`, then `LocomotionProvider`.
The runtime exposes only `getLocomotionSnapshot()`. There is no second camera
owner or Pose inference session.

## Knee signal, neutrality, and readiness

For canonical source coordinates where Y grows downward, the tracker calculates:

`rawDifference = (rightKnee.y - leftKnee.y) / bodyScale`

A positive result means the participant's anatomical LEFT knee is relatively
higher; a negative result means RIGHT is higher. Mirroring never swaps these
semantics. Common vertical bob is rejected because it moves both knees together.

The first valid sample establishes `neutralDifference`. While the smoothed
signal is within the 0.07 exit band, neutral adapts by 8% of the current raw
difference error per sample. Adaptation stops outside that neutral band, so it
does not chase an active lift or emit a step itself.

A usable sample requires valid core, both knees, and `bodyScale >= 0.04`.
Ankles are deliberately not required. Invalid knees/core/scale, a non-increasing
timestamp, a frame gap greater than 250 ms, or runtime reset clears continuity,
cadence, and retained events without fabricating a return step.

## Detector and cadence

The bounded EMA uses alpha `0.55`. The detector enters at `0.16` body units,
exits at `0.07`, reaches full lift intensity at `0.40`, and requires two
candidate samples. The first accepted step may be either anatomical side;
thereafter only the opposite side may re-arm the detector. Repeated same-side
lifts cannot manufacture cadence. A clear raw opposite-side dominance may begin
its candidate while the EMA crosses neutral, preserving rapid real alternation.

Accepted steps must be at least 220 ms apart. Cadence uses the mean of recent
accepted intervals (up to six step timestamps): `60000 / meanIntervalMs`.
Only intervals at or below 1,400 ms remain in cadence history, and cadence is
clamped to 240 SPM. Lift intensity is:

`clamp01((abs(smoothedSignal) - 0.16) / (0.40 - 0.16))`

Cadence holds for 450 ms after the newest step, then linearly decays to zero at
1,200 ms. Intensity is `clamp01(cadenceSpm / 180)`, so it follows the same
decay and never represents real-world velocity.

## JUMP separation and intended consumers

D0 does not add a RUN action and does not duplicate JUMP. Existing normalized
JUMP remains authoritative. Future Running Race consumes `LocomotionSnapshot`
only; Long Jump Challenge combines it with the existing normalized JUMP action;
High Jump continues to use JUMP only.

## Camera-free developer source

`LocomotionTestProvider` mirrors the normalized provider without fake Pose
frames or a camera. Its API is `triggerStep(side, { timestampMs,
liftIntensity? })`, `setIdle(timestampMs)`, and `reset(timestampMs?)`.
Triggered timing derives cadence through the same alternating semantics, while
idle updates cadence decay and reset clears retained events.

## Engineering boundary

This is a reusable engineering foundation for Batch D1 Running Race and Batch
D4 Long Jump Challenge. Physical running/marching recognition, iPhone Safari,
compact-space fatigue, and projector use remain pending. Existing Pose and C0
Sports Motion thresholds, Spatial Hands, JUMP/SQUAT behavior, strict
full-body defaults, camera lifecycle, registry, and shipped games are unchanged.
