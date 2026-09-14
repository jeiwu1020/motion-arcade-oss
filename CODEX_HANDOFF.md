# Motion Arcade Handoff

- Phase: Portfolio Batch Build — Batch D4 Long Jump Challenge.
- Status: D4 has an `ENGINEERING PASS` and is `PHYSICAL QA PENDING`. Long Jump
  is a deterministic three-attempt in-place charge/takeoff game that consumes
  D0 normalized locomotion intensity plus strictly newer normalized JUMP
  occurrences. Its Core owns charge, timing quality, fictional distance,
  attempt lifecycle, score, replay, and immutable results. JUMP magnitude is
  intentionally ignored. Production uses the one existing Pose pipeline with
  explicit `FULL_BODY` `STRICT` setup and ankle readiness; Developer Test Mode
  is camera-free with D0 step and JUMP controls.
- Validation: final typecheck, lint, test, production build, diff check, and
  landscape browser smoke are recorded in the completion report.
- Safety boundary: C0 Sports Motion thresholds/semantics, D0 Locomotion, Pose
  thresholds, JUMP/SQUAT behavior, camera lifecycle, registry schema, and all
  existing games remain unchanged. No new detector, second inference path, raw
  Pose game dependency, or microphone path was added. The participant is not
  asked to jump forward or maximize physical effort.
- Known risk: comfortable physical jump timing, ankle framing, iPhone Safari,
  compact-space variation, fatigue, recovery, and projector use remain
  unvalidated. No Physical PASS is claimed.
- Next safest task: Batch E — Baseball. Preserve the existing JUMP and D0
  contracts; do not reopen shared thresholds.
