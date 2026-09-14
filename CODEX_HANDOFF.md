# Motion Arcade Handoff

- Phase: Portfolio Batch Build — Batch C1 Tennis.
- Status: Tennis has an `ENGINEERING PASS` and is `PHYSICAL QA PENDING`. The
  pure deterministic Core owns the seeded 60-second arcade course, shot phases,
  contact windows, bounded return trajectory, score/rally state, and result
  presentation events. The Session consumes only game-local swing attempts
  derived from the immutable C0 Sports Motion snapshot.
- Validation: typecheck and lint pass; all 472 tests across 71 files pass;
  production build and `git diff --check` pass. Browser smoke verified the Home
  card, Tennis launch, countdown, opaque court, HUD, and bilateral developer
  controls at the local browser viewport. The production route is covered by
  explicit-start/no-media-request tests.
- Safety boundary: C0 swing thresholds, refractory behavior, snapshot
  semantics, Pose thresholds, existing games, and the single Pose inference
  path remain unchanged. Tennis uses no RELEASE event, raw landmarks, camera
  objects, microphone, or sport-specific detector.
- Known risk: physical swing recognition, iPhone Safari, compact-space behavior,
  fatigue, projector readability, and sport-specific game-feel remain
  intentionally unvalidated.
- Next safest task: Batch C2 — Badminton. Reuse C0 through a new game-local
  Session/Core boundary; preserve C0's RELEASE deferral.
