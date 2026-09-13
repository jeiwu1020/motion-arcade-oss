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

## Action Practice mode

The Pose screen offers `動作測試` beside normal `開始遊戲`. Practice uses the
same normalized Motion Action occurrences and FULL_BODY setup, but has no timer,
score, combo, grade, or automatic expiry. It holds each target until a distinct
matching action sequence arrives, reports the latest recognized relevant action,
and holds a large `✓ 成功！` state for 1,000 ms before advancing through:
`LEFT → RIGHT → REACH_LEFT → REACH_RIGHT → SQUAT`. Completion offers replay,
entry to the normal 60-second game, or return home. Normal-game scoring,
response windows, countdown, and FULL_BODY readiness are unchanged; the large
check/grade pulse is presentation-only feedback.

## Compact-space Pose pass

Reaction Arena remains `FULL_BODY`, but its production Pose provider opts into
the reusable `KNEES` lower-body readiness policy. Shoulders, hips, and both
knees remain required at `minimumLandmarkConfidence = 0.55`; ankles are
optional for baseline/readiness. Default `STRICT` readiness remains knees plus
ankles. The existing 350 ms baseline-gap and 1,000 ms READY-loss grace remain.

Ankle baseline values are accumulated only from real valid ankle samples and
are optional. JUMP still requires strict full-body tracking and usable ankle
baselines; Reaction Arena does not request it. Compact SQUAT remains
baseline-relative hip descent with existing smoothing/debounce/hysteresis.
Valid knee geometry corroborates a candidate; when ankles are absent, a clear
hip descent with both knees tracked can still enter SQUAT. No landmarks/actions
are fabricated.

Reaction Arena requests `LOW_MOTION` (range scale `0.6`) and `LEAN_LEFT` /
`LEAN_RIGHT` alongside its existing actions. MOVE or LEAN fulfills the matching
directional cue. LOW_MOTION reach gates are: enter `0.56`, exit `0.42`, elbow
angle `138°`, outside-body minimum `0.42` body units, extension minimum `0.70`.
STANDARD reach behavior is unchanged.

`PoseGameplayInputRuntime.getPoseTrackingSnapshot()` now exposes an immutable,
in-memory, presentation-only snapshot of 12 selected source-normalized joints.
`CameraPoseTrackingOverlay` uses the existing contain-fit mirrored Camera
Presentation mapping. Reaction Arena shows it in setup/baselining and Action
Practice (including success feedback), then hides it during normal active play.
High-confidence joints/bones are cyan, finite low-confidence observations are
amber, and missing joints are not rendered. It never enters Game Core, Phaser,
Motion Input, persistence, or networking.

Validation and real-device testing remain open. In particular, do not claim
Reaction Arena physical PASS. Record the known Windows Chrome camera-start
observation 「正在啟動相機」 without changing shared camera/runtime behavior in
this phase.
