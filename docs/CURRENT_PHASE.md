# Motion Arcade — Current Phase

Updated: 2026-08-31

This file is a short project checkpoint for agents. Detailed design lives in the phase documents and canonical architecture docs.

## Current implementation baseline

Phase 2A.2a is the current `main` implementation after merge. The previous
playable test-input milestone is:

`d9e81919bb9856296ea4b13bba6c02d51612aa99` — Phase 2A.1 Balloon Pop vertical slice

Use current `main` as the working baseline unless a task explicitly pins another SHA.

## Validated milestones

- Phase 1A — normalized motion contracts / adaptive profiles / test input: PASS
- Phase 1B — camera + MediaPipe Pose sensor pipeline: engineering + physical iPhone PASS
- Phase 1C — Pose Motion Analyzer: MOVE / LEAN / REACH / SQUAT / JUMP: engineering + real-person PASS
- Phase 1D.1 — guided calibration flow: engineering + real-person PASS
- Phase 1D.2 — calibration-driven adaptation: engineering + real-person PASS
- Phase 1D.3a — LOW_MOTION / SLOW_RESPONSE composition: engineering PASS; physical checks deferred
- Phase 1D.3b — SEATED / UPPER_BODY Pose: engineering PASS; physical checks deferred
- Phase 2A.1 — deterministic Balloon Pop through normalized test input: PASS

## Current phase

### Phase 2A.2a — production real-Pose Balloon Pop input

Engineering status: PASS

Automated validation:

- Typecheck: PASS
- Lint: PASS
- Tests: 200 / 200 PASS across 31 files
- Build: PASS
- `git diff --check`: PASS

Implemented behavior:

- `#game/balloon-pop` is available in normal production builds without either
  developer/lab build gate.
- Production lazily loads real Pose gameplay; development retains the existing
  keyboard/test-provider screen and Z/C controls.
- `PoseGameplayInputRuntime` is the focused shared acquisition boundary. It owns
  CameraController, PoseSensorSession, InferenceScheduler/backend, and
  PoseMotionInputProvider lifecycle while exposing readiness and normalized input.
- Camera permission begins only after the user presses 啟動相機.
- The STANDARD full-body analyzer must be READY before the 3-2-1 countdown moves.
- TRACKING_LOST freezes countdown, round time, and balloon expiry and displays
  請回到畫面中. Recovery resumes only after full readiness returns.
- Startup/inference errors fail closed and release provider, camera, scheduler,
  and backend resources with readable retry UI.
- Replay reuses a healthy active Pose session. Route exit, unmount, hidden/pagehide,
  and errors release real-sensor resources.
- BalloonPopCore and BalloonPopScene remain detector-, camera-, and MediaPipe-free
  and still consume only normalized REACH_LEFT / REACH_RIGHT actions.

Focused design and manual checks: [Phase 2A.2 — Real Pose gameplay](./PHASE_2A_2_REAL_POSE_GAMEPLAY.md).

## Manual / physical testing still required

- Windows Chrome: permission allow/deny, initial STANDARD baseline, left/right
  reaching, deliberate leave/re-enter recovery, inference failure recovery, Replay,
  Return Home, tab hide, and camera track release.
- Physical iPhone Safari landscape: permission flow, front-camera anatomical
  left/right, full-body framing at intended distance, safe-area/FIT layout,
  background/pagehide cleanup, thermal behavior, and projector readability.
- Confirm real-person reach can be performed without false repeat hits while an
  arm remains extended.
- Previously deferred Phase 1D.3a/1D.3b physical profile checks remain open;
  gameplay profile selection is not part of this phase.

## Scope still deferred

- calibration UI and adaptive gameplay profile selection
- SEATED / UPPER_BODY gameplay selection
- multiplayer and multi-person Pose
- Hand Tracking and Voice input
- STRIKE / THROW / RUN / STEP / RUN_CADENCE
- persistence, accounts, analytics, audio, and formal art polish
- generic multi-sensor SensorManager
