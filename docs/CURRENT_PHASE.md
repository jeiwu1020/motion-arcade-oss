# Motion Arcade — Current Phase

Updated: 2026-08-31

This file is a short project checkpoint for agents. Detailed design lives in the phase documents and canonical architecture docs.

## Current implementation baseline

Latest feature implementation:

`f5297c0a94d4b55e606711ba7c795d9c8e769c4d` — `feat: add low-motion and slow-response profiles`

Subsequent repository work may contain narrow fixes/docs checkpoints; use current `main` as the implementation baseline unless a task explicitly pins another SHA.

## Validated milestones

- Phase 1A — normalized motion contracts / adaptive profiles / test input: PASS
- Phase 1B — camera + MediaPipe Pose sensor pipeline: engineering + physical iPhone PASS
- Phase 1C — Pose Motion Analyzer: MOVE / LEAN / REACH / SQUAT / JUMP: engineering + real-person PASS
- Phase 1D.1 — guided calibration flow: engineering + real-person PASS
- Phase 1D.2 — calibration-driven adaptation: engineering + real-person PASS
- Calibration UX fixes, including REACH preparation/outward gating and explicit calibration-test flow: real-person PASS

## Current phase

### Phase 1D.3a — LOW_MOTION + SLOW_RESPONSE

Engineering status: PASS

Exact feature implementation SHA:

`f5297c0a94d4b55e606711ba7c795d9c8e769c4d`

Automated validation at that SHA:

- Typecheck: PASS
- Lint: PASS
- Tests: 163 / 163 PASS across 25 files
- Build: PASS
- GitHub Actions: PASS
- Vercel: PASS

Implemented behavior:

- STANDARD: range scale `1.0`, reaction scale `1.0`
- LOW_MOTION: range scale `0.6`, reaction scale `1.0`
- SLOW_RESPONSE: range scale `1.0`, reaction scale `1.75`, currently resolving to `240 ms` candidate grace
- LOW_MOTION + SLOW_RESPONSE compose independently
- JUMP remains outside profile adaptation

Physical/manual status: DEFERRED by project decision

The project may continue to Phase 1D.3b before these physical checks are completed. Before formal gameplay depends on LOW_MOTION/SLOW_RESPONSE, return and complete:

- STANDARD regression
- LOW_MOTION MOVE / LEAN / REACH / deliberate shallow SQUAT
- LOW_MOTION idle/sway/tiny-knee-bend false positives
- SLOW_RESPONSE slow deliberate actions
- combined LOW_MOTION + SLOW_RESPONSE
- squat-to-stand must not trigger JUMP
- Windows real camera
- physical iPhone Safari / 2–4 m usability where relevant

## Next planned architecture work

### Phase 1D.3b

Implement the body-availability profiles that require deeper tracking changes:

- SEATED
- UPPER_BODY

Do not assume ankles/full-body standing baseline for these modes. Lower-body-inappropriate actions must remain safely neutral.

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
