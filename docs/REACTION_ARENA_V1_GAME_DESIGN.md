# 光速反應王 / Reaction Arena v1

Reaction Arena is the second production game in Motion Arcade. It proves that
the normalized Motion Action contract can drive a game without spatial-hand
collision. The player follows large LEFT, RIGHT, REACH_LEFT, REACH_RIGHT and
SQUAT prompts for a deterministic 60-second round using FULL_BODY setup.

## Rules

- 3-second setup-gated countdown, then a 60-second active round.
- WARM_UP 0–15s (1700ms windows), REACTION_RALLY 15–28s (1350ms), two seeded
  special events at 28–34s and 44–49s (1000ms), COMBO_CHAIN 34–44s (1150ms),
  and SPEED_ZONE 50–60s (950ms).
- A cue accepts only a new normalized action sequence after the cue starts.
  Unrelated actions are ignored; an expired cue resets Combo without negative
  score.
- PERFECT/GREAT/GOOD are the first 40%, 40–70%, and final 30% of a response
  window, scoring 150/125/100. Every five Combo adds up to +50.
- Special events are selected without replacement from REACH_BURST,
  SIDE_DASH, and DUCK_AND_STRIKE. Speed Zone uses deterministic 2–3 action
  chains and never generates JUMP.

## Boundaries

Core and Session consume only normalized Motion Actions. Phaser renders immutable
state and never sees Pose landmarks, camera APIs, or MediaPipe types. FULL_BODY
readiness and the shared camera lifecycle are unchanged. Temporary v1 audio is
copied into `public/audio/reaction-arena/` and is fail-silent; it is not a new
shared audio architecture.

## Known physical issue

Windows Chrome can occasionally remain at 「正在啟動相機」 in the existing
camera flow. This is recorded for a later shared Camera/Pose lifecycle
investigation and is not addressed by Phase 2B v1. Reaction Arena physical
validation is still required on Windows and iPhone Safari.
