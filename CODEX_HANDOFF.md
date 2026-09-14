# Motion Arcade Handoff

- Phase: Portfolio Batch Build — Batch D0 Locomotion Toolkit.
- Status: D0 has an `ENGINEERING PASS` and is `PHYSICAL QA PENDING`. The
  shared normalized contract provides immutable anatomical alternating knee-lift
  events, cadence, intensity, and latest-side state. `PoseLocomotionTracker`
  reuses the existing `PoseGameplayInputRuntime` inference result and needs
  valid core plus both knees, not ankles. `LocomotionTestProvider` supplies the
  same semantics without a camera.
- Validation: typecheck, lint, 538 tests across 84 files, production build, and
  `git diff --check` pass. Browser smoke confirms Home loads with every existing
  game card, no D0 route/card, and no automatic camera or microphone request.
- Safety boundary: existing Pose thresholds, C0 Sports Motion thresholds and
  semantics, Spatial Hands, JUMP/SQUAT behavior, strict `FULL_BODY` defaults,
  camera lifecycle, registry, and all shipped games remain unchanged. No RUN
  action, duplicate JUMP, second inference path, microphone, route, or Home
  card was added.
- Known risk: physical marching/running recognition, iPhone Safari,
  compact-space variation, fatigue, and projector use remain unvalidated.
- Next safest task: Batch D1 — Running Race. Consume only the normalized D0
  contract and preserve existing JUMP as a separate action.
