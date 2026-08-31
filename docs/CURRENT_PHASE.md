# Motion Arcade — Current Phase

Updated: 2026-08-31

This file is a short project checkpoint for agents. Detailed design lives in the phase documents and canonical architecture docs.

## Current implementation baseline

Latest feature implementation:

`36509c72414fe3a6eaab4e94eea0a61f11970c41` — `feat: add seated and upper-body pose support`

Subsequent repository work may contain narrow fixes/docs checkpoints; use current `main` as the implementation baseline unless a task explicitly pins another SHA.

## Validated milestones

- Phase 1A — normalized motion contracts / adaptive profiles / test input: PASS
- Phase 1B — camera + MediaPipe Pose sensor pipeline: engineering + physical iPhone PASS
- Phase 1C — Pose Motion Analyzer: MOVE / LEAN / REACH / SQUAT / JUMP: engineering + real-person PASS
- Phase 1D.1 — guided calibration flow: engineering + real-person PASS
- Phase 1D.2 — calibration-driven adaptation: engineering + real-person PASS
- Calibration UX fixes, including REACH preparation/outward gating and explicit calibration-test flow: real-person PASS

## Current phase

### Phase 1D.3b — SEATED + UPPER_BODY Pose

Engineering status: PASS

Automated validation on the implementation worktree:

- Typecheck: PASS
- Lint: PASS
- Tests: 177 / 177 PASS across 26 files
- Build: PASS

Implemented behavior:

- STANDARD keeps its exact full-body standing baseline and all existing actions.
- SEATED and UPPER_BODY establish an upper-body baseline from shoulders and hips
  without requiring knees or ankles.
- Both modes support MOVE_LEFT/RIGHT, LEAN_LEFT/RIGHT, REACH, and anatomical
  REACH_LEFT/RIGHT.
- SQUAT and JUMP are explicitly unavailable and stay neutral.
- Upper-body and full-body readiness are reported separately.
- LOW_MOTION and SLOW_RESPONSE still compose with supported upper-body actions.
- Standing calibration is not applied to SEATED/UPPER_BODY.
- Pose Lab exposes 標準動作, 坐姿模式, 上半身模式, readiness, and exact action
  availability.

Physical/manual status: DEFERRED by project decision

Before formal gameplay depends on Phase 1D.3a/1D.3b, complete:

- STANDARD regression
- LOW_MOTION MOVE / LEAN / REACH / deliberate shallow SQUAT
- LOW_MOTION idle/sway/tiny-knee-bend false positives
- SLOW_RESPONSE slow deliberate actions
- combined LOW_MOTION + SLOW_RESPONSE
- squat-to-stand must not trigger JUMP
- Windows real camera
- physical iPhone Safari / 2–4 m usability where relevant
- seated and upper-body-only framing with knees/ankles unavailable
- seated MOVE versus LEAN separation and anatomical REACH
- 30–60 second seated idle/chair-adjustment false-positive checks
- confirmation that SQUAT/JUMP remain neutral in both new modes

Focused design and manual checks: [Phase 1D.3b — SEATED + UPPER_BODY Pose](./PHASE_1D_3B_UPPER_BODY_POSE.md).

## Next planned architecture work

LEFT_SIDE / RIGHT_SIDE full Pose behavior can follow separately unless the task explicitly groups them.

## Recent engineering fix

The injected-analyzer test path now reuses an injected analyzer only when the resolved effective config is the exact canonical STANDARD config. Profile-only LOW_MOTION/SLOW_RESPONSE configs therefore cannot accidentally run through an injected STANDARD analyzer. A focused regression test covers this boundary.

## Scope still deferred

- formal games / gameplay content
- multi-person Pose
- Hand Tracking
- Voice input
- STRIKE / THROW / RUN / STEP / RUN_CADENCE
- persistent calibration/accounts
- diagnosis-specific profiles
