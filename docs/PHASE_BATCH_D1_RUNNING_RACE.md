# Batch D1 — Running Race / 原地衝刺王

Updated: 2026-09-14

## Status

Running Race is an **Engineering Prototype PASS** and **Physical QA PENDING**.
The game loop, deterministic Core, normalized D0 Session bridge, Developer Test
Mode, production route, and regression coverage are complete. No physical
cadence, running recognition, iPhone, compact-space, fatigue, or projector
validation is claimed.

## Game loop

Running Race is a single-player, four-lane arcade race against three AI runners.
The player remains approximately in place; alternating knee lifts are converted
by D0 into normalized locomotion intensity and cadence. The Core turns that
normalized value into fictional race progress. It never reports real speed,
distance, calories, gait quality, or a clinical cadence assessment.

The round has a 3-second countdown followed by exactly 60 seconds of PLAYING.
The race does not end when a runner reaches a visual endpoint. At 60 seconds the
ranking is frozen and the result screen shows final place, arcade score, speed
levels, overtakes, and game-step counts.

Gameplay phases are deterministic:

| Elapsed time | Phase | Player scale |
|---|---|---:|
| 0–10 s | `START` | 0.95 |
| 10–30 s | `PACE` | 1.00 |
| 30–50 s | `CHASE` | 1.03 |
| 50–60 s | `FINAL_SPRINT` | 1.08 |

## D0 consumption and game-local boundary

`RunningRaceSession` consumes only `LocomotionSnapshotSource`. It maps the
normalized D0 snapshot into a small `RunningInputSnapshot` containing timestamp,
availability, bounded intensity, a 0–100 display meter, and at most one new
step side/sequence. Running Race Core has no Pose, camera, landmark, runtime,
or LocomotionProvider dependency.

`latestStep` is retained by D0, so the Session owns a sequence cursor:

- the current retained sequence is marked at start;
- the current retained sequence is marked again on replay;
- only a strictly newer sequence becomes a game presentation step;
- the cursor is global because D0 step sequences are global, while D0 itself
  guarantees anatomical alternation;
- events observed while setup is unready or a hard failure is active are marked
  and ignored, without advancing Core time;
- recovery resumes normalized availability/intensity but cannot replay a stale
  step;
- Core time advances only while setup is ready and no hard failure is present.

Steps animate the avatar and are counted as `遊戲步數`; they do not score
individual knee lifts.

## Progress and AI

When the normalized snapshot is unavailable, or intensity is at or below the
exact idle epsilon `0.001`, player speed is zero. Otherwise:

```text
playerSpeed = clamp01(0.20 + intensity * 0.80)
progress += playerSpeed * deltaSeconds * playerPhaseScale
```

The progress value is fictional game-local arcade progress. The player HUD
shows `速度 0–100`, mapped as `round(intensity * 100)`, rather than raw SPM.

Three deterministic runners are used:

- `STEADY`: base pace `0.64`;
- `BURST`: base pace `0.58`, with repeatable 4-second temporary `+0.22`
  surges in one of each three 4-second windows;
- `FINISHER`: base pace `0.55`, increasing linearly from 30 to 60 seconds by
  `+0.45` at the end.

Each race seed gives each AI a bounded deterministic variation in `0.97..1.03`.
AI progress is numeric and monotonic; no physics engine or `Math.random` is
used. AI phase scales are `0.92`, `1.00`, `1.04`, and `1.12` for the four
phases, respectively.

Ranking sorts player and AI progress descending, with a fixed participant order
as the deterministic tie-breaker. An overtake is emitted only when the player's
rank index improves; passing multiple AI in one update emits one bounded event
per newly passed runner. Losing position never counts as an overtake, and an
unchanged ordering cannot spam feedback.

## Score and result

The deterministic arcade score is:

```text
score = round(playerProgress * 100)
      + overtakes * 100
      + placementBonus
```

Placement bonuses are first `+500`, second `+300`, third `+150`, and fourth
`+0`. Placement is applied only on the stable final result. The score is clamped
to never become negative.

The result screen shows final place, arcade score, best and average speed level,
overtake count, and optional `遊戲步數`. It does not make real-world fitness or
distance claims.

## Presentation

Active play is an opaque procedural Phaser playfield at logical `1280 × 720`:
four readable lanes, player and AI avatars, perspective track motion, phase
banner, timer/HUD, rank, 0–100 speed meter, and step-driven player stride.
The camera preview is setup/recovery-only. Phaser projects Core state and does
not own progress, ranking, timing, or input semantics.

At exactly 50 seconds, `FINAL SPRINT!` starts. Track motion, speed lines, lighting,
rank emphasis, and the player's phase scale intensify; the Finisher AI also uses
its strongest late pace. D0 thresholds and step semantics do not change.

## Production path

The production route uses the existing explicit-start
`PoseGameplayInputRuntime` and its one Pose inference pipeline:

```text
explicit camera start
→ PoseGameplayInputRuntime
→ PoseFeatureExtractor / PoseLocomotionTracker (D0)
→ LocomotionSnapshot
→ RunningRaceSession
→ RunningRaceCore
```

The request uses Pose with no actions, no Hands model, and no microphone. The
route requests `FULL_BODY` framing with the existing `KNEES` lower-body
readiness policy. Head, shoulders, hips, and both knees should be visible;
ankles are not required. This is not `STRICT`, and Running Race contains no raw
Pose or landmark dependency.

Tracking loss returns to the shared camera/recovery UI and pauses Core time.
Recovery resumes the same race state and normalized D0 values without fabricating
a step. Camera permission is never requested automatically.

## Engineering boundary

D0's alternating knee-lift contract is sufficient for this engineering game
contract: a normalized cadence/intensity stream can drive an arcade race without
adding `RUN`, duplicating `JUMP`, or creating a second detector. This is not
physical running recognition validation. Future Long Jump Challenge will use
D0 locomotion plus the existing normalized `JUMP`; High Jump remains a `JUMP`
consumer only.

## Developer Test Mode

The camera-free route uses `LocomotionTestProvider`, so cadence and intensity
still emerge through D0 semantics rather than a direct game-speed shortcut.

- `A` / `←`: trigger `LEFT` knee lift;
- `D` / `→`: trigger `RIGHT` knee lift;
- the large `左腳抬膝` and `右腳抬膝` buttons provide the same controls.

Idle updates continue through the provider so cadence decays when the player
stops triggering alternating steps.
