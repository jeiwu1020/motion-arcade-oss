# Phase 2B — Reaction Arena v1

Engineering implementation of 光速反應王 is complete as a normalized-action
vertical slice. The game uses the existing FULL_BODY Camera Presentation and
PoseGameplayInputRuntime, while `ReactionArenaCore` remains deterministic and
framework-independent and `ReactionArenaSession` consumes only new action
sequences. Developer Test Mode uses the existing keyboard provider.

The production route has no spatial-hand gameplay and does not alter Balloon
Rally. Temporary local MP3 copies in `public/audio/reaction-arena/` provide
success, special-event, Speed Zone, countdown, finish/cheer, and BGM feedback;
audio unlock is best effort and never gates camera startup.

## FULL_BODY readiness stability

Reaction Arena continues to require the existing strict FULL_BODY landmark
validity and `minimumLandmarkConfidence = 0.55`. To tolerate ordinary lower-body
landmark flicker without inventing landmarks, an in-progress FULL_BODY baseline
preserves its valid-sample accumulator across a core-valid gap of up to **350 ms**;
the invalid frames contribute no samples. A longer gap resets acquisition.

After genuine READY, the shared gameplay runtime retains READY for up to **1000
ms** of diagnostic readiness fluctuation while the sensor session is still
running. If readiness does not recover within that window, status becomes
`TRACKING_LOST` and setup/game progression pauses through the existing path.
Fatal lifecycle states remain immediate. This is readiness gating only: stale or
low-quality analyzer actions remain neutral and no fake coordinates or actions
are produced. Physical validation remains required.

## Deterministic pattern timing

COMBO_CHAIN (34,000–44,000 ms) and SPEED_ZONE (50,000–60,000 ms) select one
seeded pattern and advance through its actions in order before selecting the
next pattern. Fixed special-event patterns repeat from index 0 while their phase
is active. SPECIAL_EVENT_2 ends at 49,000 ms; the 49,000–50,000 ms interval is a
cue-free transition, and SPEED_ZONE begins at 50,000 ms. Pattern identity and
index are immutable Core state, so replaying a seed reproduces the same choices.

Validation and real-device testing remain open. In particular, do not claim
Reaction Arena physical PASS. Record the known Windows Chrome camera-start
observation 「正在啟動相機」 without changing shared camera/runtime behavior in
this phase.
