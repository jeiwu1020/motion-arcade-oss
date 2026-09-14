# Phase Batch D4 — Long Jump Challenge

## Status

D4 is an **Engineering Prototype PASS** and **Physical QA PENDING**. The game
is `long-jump` — 飛躍挑戰 / Long Jump Challenge. It is a standing, in-place
arcade game; it does not measure real jump distance or physical effort.

## Safety-first game loop

The participant remains approximately in place. During a fixed 5,000 ms charge
phase, alternating D0 knee-lift locomotion builds a fictional charge meter.
After the charge freezes, a 2,000 ms takeoff window presents a cue. The
participant is asked to perform one small comfortable vertical jump. The
avatar, not the participant, performs the exaggerated forward long jump. The
setup/game copy says: 「原地抬膝蓄力，看到起跳提示後輕輕向上跳即可。不要往前跳。」

There are three attempts, with no elimination. A no-jump timeout or poor timing
continues to the next attempt. The active playfield is an opaque procedural
Phaser runway; camera presentation returns for setup and tracking recovery.

## Core and state machine

`LongJumpCore` is framework-independent and owns immutable state, timing,
charge, timing quality, fictional distance, attempt results, score, statistics,
and presentation events. It imports no React, Phaser, Pose, or provider type.

```text
COUNTDOWN -> ATTEMPT_READY -> CHARGE -> TAKEOFF_WINDOW
                                      |       |
                                      |       +--> FLIGHT -> RESULT
                                      |                         |
                                      +---- timeout -----------+
                                                                |
                                                ATTEMPT_TRANSITION
                                             next attempt / FINISHED
```

The exact timings are 3,000 ms countdown, 800 ms ready, 5,000 ms charge,
2,000 ms takeoff window, 1,200 ms flight, 1,000 ms result, and 700 ms attempt
transition. Core time and charge stop together when Session is unready or in a
hard failure.

## D0 + JUMP input boundary

`LongJumpSession` consumes two existing normalized sources:

- D0 `LocomotionSnapshotSource`, using only availability, normalized intensity,
  and retained latest-step metadata;
- the existing normalized `MotionInputProvider`, using only fresh `JUMP`
  sequence occurrences.

The Core receives only `LongJumpInputSnapshot`: locomotion availability and
intensity, optional new-step presentation metadata, and an optional new JUMP
sequence. It never receives `LocomotionSnapshot`, `MotionInputSnapshot`, Pose,
landmarks, camera objects, or provider internals.

Both retained-event cursors are marked on start and replay. Only strictly newer
step/JUMP sequences are forwarded. New events observed while unready or in a
non-eligible phase are marked and ignored, so recovery cannot replay stale
input. Only a JUMP during `TAKEOFF_WINDOW` can resolve an attempt; one sequence
can resolve at most one attempt. D0 intensity influences charge only while
Core time is actively advancing in `CHARGE`. Latest steps are presentation and
`偵測步數` only; cadence is never reconstructed by this game.

## Charge and takeoff timing

Charge starts at zero and uses the exact game-local formula:

```text
charge = clamp01(charge + locomotionIntensity * deltaSeconds * 0.22)
```

Unavailable locomotion contributes zero. Charge is frozen when `CHARGE` ends.

The ideal takeoff is 1,400 ms after `TAKEOFF_WINDOW` begins. For a fresh JUMP:

```text
offsetMs = takeoffElapsedMs - 1,400
timingQuality = clamp01(1 - abs(offsetMs) / 600)
```

Thus offset 0 is 1.0, ±300 ms is 0.5, and ±600 ms or more is 0. Grade
boundaries are PERFECT ≤120 ms, GREAT ≤250 ms, GOOD ≤450 ms, otherwise OK.
Any fresh JUMP in the window completes the attempt, even with low timing
quality. No JUMP by 2,000 ms produces `NO_JUMP` and zero distance/score.

## Fictional arcade distance and scoring

The launch value is explicitly not a physical measurement:

```text
launchQuality = clamp01(charge * 0.70 + timingQuality * 0.30)
arcadeDistance = round(launchQuality * 100)
attemptScore = arcadeDistance * 10
```

The UI calls it `遊戲距離` and displays no meters, centimeters, or real-world
unit. JUMP action value, magnitude, velocity, airtime, and physical height are
not read or used. A small comfortable jump with excellent timing can therefore
produce the maximum fictional value. The avatar's visual travel is
`0.40 + launchQuality * 0.60`, presentation-only.

Results track total score, best/average fictional distance, best charge, grade
counts, no-jump count, and detected game steps. Score is never negative.

## Production path

Production uses the existing explicit-start `PoseGameplayInputRuntime` once.
Its one Pose inference result feeds both `PoseMotionInputProvider` for JUMP and
the existing runtime locomotion output for D0. The request is STANDARD with
`JUMP`, `pose: true`, `hands: false`, and `audio: false`. The game uses
`FULL_BODY` with default `STRICT` lower-body readiness because JUMP requires
genuine ankle evidence; head, shoulders, hips, knees, and both ankles must be
visible. It does not use KNEES readiness, a Hands model, a microphone, or a
second inference pipeline. Camera permission is requested only by the explicit
start action. Tracking loss pauses all attempt timers and recovery resumes the
same state.

## Engineering versus physical status

Engineering gates cover the deterministic charge/timing/distance Core, three
attempt lifecycle, sequence-safe dual-source Session, replay, Developer Test
Mode, registry/navigation, explicit camera request, and browser smoke path.

This is not a Physical PASS. Comfortable jump timing, ankle framing, iPhone
Safari behavior, fatigue, compact-space use, projector readability, and
physical D0/JUMP recognition remain `PHYSICAL QA PENDING`. The participant is
never coached to jump forward or maximize physical jump magnitude.
