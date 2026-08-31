# Motion Arcade Agent Instructions

Keep this file short. Detailed architecture belongs in `docs/`; do not duplicate those documents here.

## Canonical context

Before architecture-level, roadmap-level, or cross-layer changes, read only the relevant canonical docs:

- `docs/MASTER_IMPLEMENTATION_PLAN.md`
- `docs/MASTER_ARCHITECTURE.md`
- `docs/MOTION_INPUT_CONTRACT.md`
- `docs/CURRENT_PHASE.md`
- the relevant `docs/PHASE_*.md` for the area being changed

Treat repository code/tests and these docs as canonical. Do not restate the whole project history in prompts or reports.

## Product invariants

- Primary device is a smartphone used in landscape orientation.
- Real body input uses the phone front camera; voice input uses the phone microphone.
- Gameplay is designed to be readable when the phone image is projected to a large screen.
- Landscape layout, safe areas, large-distance readability, camera framing, and front-camera preview are first-class requirements, not later polish.
- The product goal is stable exercise + entertainment, not a sensor technology showcase.
- Reuse proven gameplay ideas from legacy prototypes, but do not copy legacy sensor/game coupling into the new architecture.

## Token-efficient workflow

- Inspect task-relevant files first; avoid repo-wide exploration unless necessary.
- For narrow fixes, keep scope narrow and do not re-audit unrelated architecture.
- Reuse existing contracts, helpers, tests, and phase docs instead of creating parallel concepts.
- Final reports should be concise: final SHA, files changed, key decisions, validation results, and remaining physical/manual checks.

## Architecture invariants

- React/DOM owns the app shell, settings, therapist/debug UI.
- Phaser owns only the 2D playfield.
- Framework-independent Game Core owns gameplay rules.
- Games consume normalized game-facing input contracts only.
- Games must not depend on raw Pose landmarks, `MediaStream`, MediaPipe types, DOM input, Web Audio internals, or body-unit calibration measurements.

Sensor flow:

`Camera / Mic -> Sensor Layer -> Motion Analysis -> Normalized Game Input -> Game Core`

Keep render cadence separate from inference cadence.

## Pose semantics

- Anatomical LEFT/RIGHT means the participant's own body.
- MOVE_LEFT/RIGHT means canonical game/world direction.
- Mirrored camera preview is display-only.
- Do not derive semantics from the mirrored DOM preview.
- Preserve the current source-coordinate canonical transform unless a task explicitly changes it.

## Calibration and functional profiles

- Calibration stores normalized derived measurements only; never raw landmarks/images/frames.
- `MotionPlayerRequest.calibration` is provider input only.
- Calibration/body-unit measurements must not appear in `MotionInputSnapshot` / `PlayerMotionState`.
- STANDARD behavior must remain unchanged unless the task explicitly changes it.
- Ability profiles describe functional control needs, never diagnoses.
- Do not bypass established safety floors without explicit approval and tests.
- JUMP must not be implicitly weakened by LOW_MOTION, SQUAT, or calibration changes.
- Current Pose provider is single-person; do not imply multi-person support.

## Privacy boundaries

Do not add without explicit approval:

- recording or screenshots
- raw landmark persistence
- calibration persistence in localStorage/IndexedDB
- backend/cloud upload
- analytics
- patient/person names or accounts
- diagnosis-specific behavior

Do not claim zero third-party communication. MediaPipe SDK telemetry remains a documented privacy/release consideration.

## Sensor lifecycle

- Real camera/microphone acquisition must require explicit user action.
- Preserve fail-closed cleanup on sensor/inference errors.
- Hidden/pagehide lifecycle must release resources according to existing architecture.
- Do not create duplicate camera or MediaPipe pipelines for a feature.
- Test mode must remain usable without real sensors.

## Git safety

Before modifying:

```bash
git status --short
git branch --show-current
git pull --ff-only
```

- Preserve unrelated user work.
- Never hard reset or force push.
- Do not rewrite unrelated files.
- Keep changes within task scope.

## Required validation

Before completing an implementation change, run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

Do not weaken tests merely to make a change pass.

Physical camera/iPhone behavior must not be claimed PASS unless actually tested by the user.
