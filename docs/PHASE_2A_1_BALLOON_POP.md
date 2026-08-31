# Phase 2A.1 — Balloon Pop vertical slice

Status: engineering complete; physical/projector checks pending

## Product slice

`balloon-pop` / 氣球拍拍樂 is a single-player PARTY / 小遊戲 round. After a
3-2-1 countdown, one balloon appears on the left or right. A new matching
normalized `REACH_LEFT` or `REACH_RIGHT` start scores one point. Each target
expires after 2.5 seconds and counts as a miss; the next target follows after a
350 ms gap. Play ends after exactly 60 seconds and the result UI reports score,
hits, and misses with Replay and Return Home actions.

## Runtime boundary

`BalloonPopCore.ts` is the framework-independent rules module. Its public API is:

- `createBalloonPopState({ seed? })` — creates an immutable countdown state.
- `advanceBalloonPop(state, { deltaMs, actions })` — deterministically advances
  time and consumes normalized action state.
- `replayBalloonPop(state)` — resets statistics, timing, target sequence, and RNG
  to the original seed.
- `BALLOON_POP_RULES` — countdown, round, target lifetime, and inter-target timing.

State exposes phase (`COUNTDOWN`, `PLAYING`, `FINISHED`), countdown/round time,
score, hits, misses, current left/right target, next-target delay, deterministic
RNG state, and the last observed sequence for each reach side. A reach counts
only when its normalized phase is `started` and its sequence is new. The core
imports no Phaser, React, DOM, sensor, MediaPipe, landmark, calibration, or raw
keyboard/camera API.

`BalloonPopSession` is the narrow runtime adapter. It requests only
`REACH_LEFT` and `REACH_RIGHT` from a `MotionInputProvider`, passes its immutable
snapshot actions to the core, and exposes current state/subscription to views.
It owns no detector thresholds or body semantics.

React owns the full-screen shell, score/time HUD, test buttons, result dialog,
Replay, and Return Home. The dedicated `BalloonPopScene` only reads session state
and draws procedural left/right guides and a balloon. It does not advance rules
or listen to input. Its logical size is 1280 × 720 with Phaser FIT and
CENTER_BOTH.

## Phase 2A.1 input

The existing `KeyboardMouseTestInputProvider` is the only runtime provider in
this phase. Z creates normalized `REACH_LEFT`; C creates normalized
`REACH_RIGHT`. The two large DOM buttons call the same provider's test-action
entry point. The production build remains inaccessible unless the existing
`VITE_ENABLE_TEST_INPUT=true` build gate is enabled; query strings cannot enable
it.

The registry control scheme describes the eventual BODY / UPPER_BODY Pose
capability, but the 2A.1 session requests no camera, Hands, or audio sensor. This
deliberately avoids implying real-camera gameplay readiness.

## Deferred to Phase 2A.2

- Selecting and starting the real Pose provider for gameplay.
- Camera permission, readiness/lost-tracking, error recovery, and lifecycle UI.
- Real-person anatomical left/right reach validation on desktop and iPhone.
- Physical projector-distance and full-session usability checks.

No Game Core rule or Phaser input listener should be added for that integration;
the provider boundary is the intended substitution point.
