# Batch A — Runner / Avatar Action

Updated: 2026-09-14

## Outcome

`runner` / 跑酷衝刺 is the first non-camera-AR avatar-action game in Motion
Arcade. It is a single-player, 60-second, three-lane endless runner presented
on a logical `1280 × 720` playfield. The camera is limited to explicit setup,
framing, Pose readiness, and tracking-loss recovery; the opaque arcade course
dominates while tracking is ready.

Engineering gate: `ENGINEERING PASS`.

Portfolio state: `PHYSICAL QA PENDING`.

This result does not claim physical detector validation. Shared Pose
confidence, readiness grace, MOVE, JUMP, and SQUAT thresholds were not changed.

## Round and gameplay rules

- `COUNTDOWN`: 3 seconds.
- `PLAYING`: 60 seconds, with no early game-over or health system.
- `FINISHED`: stable score/result summary with same-seed replay and home exit.
- The player begins in `CENTER` and may occupy `LEFT`, `CENTER`, or `RIGHT`.
- Each new `MOVE_LEFT` or `MOVE_RIGHT` occurrence moves exactly one lane and
  clamps at the outer lanes.
- Each new `JUMP` or `SQUAT` occurrence starts one logical action. Active jumps
  and ducks do not stack or extend uncontrollably, and opposing actions cannot
  begin until the current action ends.
- Collisions produce a brief stumble, reset the current streak, and let the
  round continue.

Difficulty is time-based:

| Round time | Segment | Presentation and schedule intent |
|---|---|---|
| 0–15 s | `WARM_UP` | Fixed, readable introduction to all three obstacle families. |
| 15–40 s | `FLOW` | Gradually denser seeded course. |
| 40–50 s | `CHALLENGE` | Faster encounters with the same recovery floor. |
| 50–60 s | `FINAL_RUSH` | Fastest fair spacing, stronger road motion, color shift, speed streaks, and a large Final Rush callout. |

## Normalized input contract

Runner Core consumes only these game-local normalized occurrences:

| Action | Core meaning |
|---|---|
| `MOVE_LEFT` | Move one logical lane left. |
| `MOVE_RIGHT` | Move one logical lane right. |
| `JUMP` | Start the bounded jump action when no jump/duck is active. |
| `SQUAT` | Start the bounded duck/slide action when no duck/jump is active. |

`RunnerSession` is the only bridge from `MotionInputProvider` snapshots to
Runner Core. It consumes sequence increases, marks all current sequences at
start/replay, and also consumes new occurrences while readiness is absent so a
held or stale action cannot fire after recovery. Core time advances only while
setup is ready and there is no hard failure.

Developer Test Mode and production Pose use the same Session/Core path. The
developer controls are:

- `ArrowLeft` or `A`: `MOVE_LEFT`;
- `ArrowRight` or `D`: `MOVE_RIGHT`;
- `ArrowUp`, `Space`, or `W`: `JUMP`;
- `ArrowDown` or `S`: `SQUAT`;
- large on-screen buttons expose the same four actions.

## Obstacle taxonomy

1. `LANE_GATE` blocks two lanes and shows one safe lane. It clears only when
   the logical player lane matches that safe lane at encounter time.
2. `LOW_HURDLE` spans the course and clears only during the effective middle
   portion of the logical jump. Lane changing cannot bypass it.
3. `OVERHEAD_GATE` spans the course and clears only during the effective duck
   interval. Lane changing cannot bypass it.

The warm-up introduces `LANE_GATE` at 5.0 seconds, `LOW_HURDLE` at 9.5
seconds, and `OVERHEAD_GATE` at 14.0 seconds. All later obstacles are generated
from the round seed by the framework-independent Core. A local linear
congruential generator determines intervals, obstacle types, and safe lanes;
gameplay never calls `Math.random`.

Fairness invariants:

- the same seed produces the same obstacle types, safe lanes, encounter times,
  phase transitions, and replay course;
- encounter spacing never falls below 1,050 ms, which exceeds the 850 ms jump
  and duck recovery time;
- mixed jump/duck sequences therefore always have a recovery opportunity;
- the generator excludes any third consecutive copy of the same obstacle
  requirement;
- Final Rush spacing remains within the same safety floor.

## Action timing and scoring

Provisional game-owned engineering timing:

- lane visual transition: 220 ms;
- jump duration: 850 ms;
- effective jump-clear interval: 180–680 ms after jump start;
- duck duration: 850 ms;
- effective duck-clear interval: 80–760 ms after duck start;
- stumble feedback: 520 ms;
- minimum encounter spacing: 1,050 ms.

Every clear awards 100 points plus 10 points for each prior consecutive clear,
capped at a 50-point streak bonus. Collisions never subtract score. Results
report score, obstacles cleared, collisions, and best streak. Distance is not
presented as a real-world or biomechanical measurement.

## Core, session, and presentation boundaries

`RunnerCore` owns the phase, countdown, round clock, pacing segment, logical
lane, lane transition, action clocks, deterministic course, encounter
resolution, score/streak statistics, and stable result state. It imports no
React, Phaser, MediaPipe, camera, Pose runtime, or raw landmark types.

`RunnerSession` owns occurrence consumption and readiness-paused time. Phaser
renders immutable Core state and does not invent collision or action timing.

The Engineering Prototype avatar and course are procedural Phaser graphics:

- a strong three-lane perspective road and large foreground avatar;
- run bob and limb motion;
- lane-change lean;
- Core-timed jump arc and squash/stretch;
- duck silhouette;
- stumble tilt;
- finish celebration;
- clear/hit flashes, obstacle silhouettes, phase color changes, and enhanced
  Final Rush road motion.

There is no landmark retargeting and no sprite-production dependency.

## Production Pose and camera behavior

The production route requests `MOVE_LEFT`, `MOVE_RIGHT`, `JUMP`, and `SQUAT`
through the existing Pose stack using the `STANDARD` ability profile. It uses
`FULL_BODY` framing and the default `STRICT` lower-body readiness path, so the
setup guide explicitly asks for head, shoulders, hips, knees, and both ankles.

Camera permission remains behind the existing explicit start-camera action;
opening the home page or Runner route does not request media. The front camera
is mirrored by the shared presentation layer during setup. While `READY`, the
opaque Runner playfield is visually dominant. Tracking loss pauses countdown
or round time and returns the shared camera/recovery guidance to dominance;
time resumes from the same state when `READY` returns. Unmount uses the existing
deterministic runtime disposal path. Runner requests no microphone.

## Engineering acceptance and deferred physical QA

Engineering acceptance covers registry/home launch, production and developer
routes, mobile-landscape/projector-readable presentation, deterministic Core,
Session semantics, all four meaningful hazards, the full lifecycle,
result/replay, explicit camera permission, and automated regression coverage.

Acceptance evidence:

- `npm run typecheck`: PASS;
- `npm run lint`: PASS;
- `npm test`: 390 / 390 PASS across 58 files;
- `npm run build`: PASS;
- Developer browser smoke: home launch, four keyboard/on-screen actions,
  countdown/play/result/replay, and Final Rush PASS;
- production browser smoke at `852 × 393`: home and Runner setup load with no
  console warning/error, no overflow, one explicit camera button, one dormant
  video surface, and no audio/microphone surface PASS;
- `git diff --check`: required final commit gate.

The following remain for the later portfolio physical QA sweep:

- Windows Chrome and iPhone Safari landscape setup/readiness;
- compact-space MOVE/JUMP/SQUAT recognition, false positives, and false
  negatives;
- action timing, recovery, fatigue, and game feel;
- projector obstacle/HUD/avatar readability;
- audio decisions and production art polish;
- shared-threshold tuning only after cross-game evidence is collected.
