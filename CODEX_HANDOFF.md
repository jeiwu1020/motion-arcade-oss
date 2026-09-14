# Motion Arcade Handoff

- Phase: Portfolio Batch Build — Batch C0 Sports Motion Toolkit.
- Status: C0 has an `ENGINEERING PASS`. It provides a minimal immutable
  sports-motion contract: anatomical left/right wrist availability, canonical
  source position, body-relative velocity/vector/speed, bounded intensity, and
  independent sequence-safe broad-swing events. The same Pose inference result
  feeds the existing action/spatial/tracking consumers and the new tracker;
  there is no second inference or camera pipeline. RELEASE remains deferred.
- Validation: typecheck and lint pass; all 442 tests across 66 files pass;
  production build and `git diff --check` pass. The local homepage smoke check
  showed the existing Runner, Balloon Rally, Reaction Arena, and Rhythm Motion
  cards, with no automatic camera or microphone permission request.
- Safety boundary: no shared Pose thresholds, MotionActionId, SpatialHandSnapshot
  semantics, SpatialCollisionInputAdapter behavior, camera permission lifecycle,
  or existing-game gameplay changed.
- Known risk: physical swing recognition, compact-space behavior, fatigue,
  projector readability, and sport-specific game-feel remain intentionally
  unvalidated.
- Next safest task: Batch C1 — Tennis. Consume only the sports-motion contract;
  keep sport interpretation game-local and preserve C0's RELEASE deferral.
