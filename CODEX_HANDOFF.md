# Motion Arcade Handoff

- Phase: Portfolio Batch Build — Batch D1 Running Race.
- Status: D1 has an `ENGINEERING PASS` and is `PHYSICAL QA PENDING`. Running Race
  is a deterministic 60-second four-runner arcade race driven by D0's normalized
  cadence/intensity contract. Its Session marks retained latest-step sequences,
  consumes only newer steps, pauses Core during readiness loss, and resumes
  without replaying stale events. Production uses the existing Pose inference
  path with `FULL_BODY` + `KNEES` readiness; ankles, Hands, and microphone are
  not required. Developer Test Mode is camera-free through
  `LocomotionTestProvider`.
- Validation: final typecheck, lint, test, production build, diff check, and
  landscape browser smoke are recorded in the completion report.
- Safety boundary: D0 thresholds and semantics, Pose thresholds, JUMP/SQUAT,
  strict `FULL_BODY` defaults, camera lifecycle, and existing games remain
  unchanged. No RUN action, duplicate JUMP, second inference path, raw Pose
  dependency, microphone, or new user-facing foundation route was added.
- Known risk: physical marching/running recognition, iPhone Safari,
  compact-space variation, fatigue, and projector use remain unvalidated. No
  Physical PASS is claimed.
- Next safest task: Batch D2 — Swimming. Preserve D0 as the normalized
  locomotion foundation and keep existing JUMP separate.
