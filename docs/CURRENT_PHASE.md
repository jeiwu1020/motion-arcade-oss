# Motion Arcade — Current Phase

Updated: 2026-08-31

This file is a short project checkpoint for agents. Detailed design lives in the phase documents and canonical architecture docs.

## Current implementation baseline

Phase 2A.1 is the current `main` implementation after merge. The previous fully
deployed sensor milestone remains:

`b455fd2d67d73d4862f302039b73413e27a67495` — Phase 1D.3b merged code baseline; GitHub Actions and Vercel validated

Use current `main` as the working baseline unless a task explicitly pins another SHA.

## Validated milestones

- Phase 1A — normalized motion contracts / adaptive profiles / test input: PASS
- Phase 1B — camera + MediaPipe Pose sensor pipeline: engineering + physical iPhone PASS
- Phase 1C — Pose Motion Analyzer: MOVE / LEAN / REACH / SQUAT / JUMP: engineering + real-person PASS
- Phase 1D.1 — guided calibration flow: engineering + real-person PASS
- Phase 1D.2 — calibration-driven adaptation: engineering + real-person PASS
- Phase 1D.3a — LOW_MOTION / SLOW_RESPONSE composition: engineering PASS; physical checks deferred
- Phase 1D.3b — SEATED / UPPER_BODY Pose: engineering PASS; physical checks deferred

## Current phase

### Phase 2A.1 — first playable Motion Arcade vertical slice

Engineering status: PASS

Automated validation:

- Typecheck: PASS
- Lint: PASS
- Tests: 191 / 191 PASS across 29 files
- Build: PASS
- `git diff --check`: PASS

Implemented behavior:

- `balloon-pop` / 氣球拍拍樂 is a registered PARTY / 小遊戲 entry.
- A pure TypeScript Game Core owns the deterministic countdown, 60-second round,
  one-target lifecycle, matching reach hits, misses, score, finish, and replay.
- The game consumes only normalized `REACH_LEFT` and `REACH_RIGHT` started actions.
- A held action sequence cannot score more than once.
- A dedicated Phaser scene renders the 1280 × 720 FIT playfield from core state;
  React owns navigation, HUD, test controls, and results.
- The existing keyboard/test provider makes the slice playable with Z / C and
  on-screen test buttons. No camera or MediaPipe gameplay path is active.
- The existing production test-input build gate remains the route/input gate.

Focused design and boundaries: [Phase 2A.1 — Balloon Pop vertical slice](./PHASE_2A_1_BALLOON_POP.md).

## Next planned architecture work

### Phase 2A.2 — real Pose gameplay input

- Connect the existing real Pose provider to the game session without changing
  Game Core or duplicating detectors.
- Add therapist-facing provider/readiness/error lifecycle for gameplay.
- Verify camera cleanup, lost tracking, anatomical left/right behavior, and real
  reach usability on supported physical devices.

## Manual / physical testing still required

- Projector-distance readability and therapist operation for the new game.
- Physical iPhone Safari landscape FIT/safe-area behavior.
- Phase 2A.2 real-person camera reach testing is intentionally not part of 2A.1.
- Previously deferred Phase 1D.3a/1D.3b physical profile checks remain open.

## Scope still deferred

- production Camera/Pose gameplay integration (Phase 2A.2)
- multiplayer and multi-person Pose
- Hand Tracking and Voice input
- STRIKE / THROW / RUN / STEP / RUN_CADENCE
- persistence, accounts, analytics, audio, and formal art polish
- LEFT_SIDE / RIGHT_SIDE full Pose behavior
