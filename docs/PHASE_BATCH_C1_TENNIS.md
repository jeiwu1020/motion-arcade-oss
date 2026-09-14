# Batch C1 — Tennis

Updated: 2026-09-14

## Outcome and status

Batch C1 delivers 網球對決 / Tennis as the first bounded game consumer of the
C0 Sports Motion Toolkit.

Engineering status: `ENGINEERING PASS`.

Portfolio status: `PHYSICAL QA PENDING`.

This is an Engineering Prototype result. Physical swing recognition, iPhone
Safari behavior, compact-space play, fatigue, projector distance, timing
tuning, and final game feel remain unvalidated. No physical swing pass is
claimed.

## Game loop

- Single player, standing, `UPPER_BODY` framing.
- Setup uses the shared mirrored camera and readiness UI.
- Active play uses an opaque 1280 × 720 Phaser tennis court.
- The round has a 3-second countdown, 60 seconds of play, and stable result /
  replay screens.
- The Core pauses without advancing time when setup is not ready or a hard
  sensor failure is reported.
- The player returns each scheduled incoming ball with one clear left- or
  right-hand swing. Either anatomical hand may return either visual incoming
  side.

## Sports Motion consumption

`TennisSession` consumes only `SportsMotionSnapshotSource`. It creates the
game-local `TennisSwingAttempt` with `hand`, game-local `timestampMs`,
`vectorX`, `vectorY`, `intensity`, and `sequence`. Tennis Core receives only
those attempts; it does not import Pose frames, landmarks, MediaPipe, camera
objects, or Sports Motion provider internals.

Left and right retained events have independent last-seen sequence numbers.
The Session marks the current sequences on start and replay. Every newer event
is marked even while setup is not ready, but is dropped instead of sent to the
Core. Consequently a retained event can resolve at most one incoming ball and
tracking loss/recovery cannot replay a stale event.

Production wraps the existing `PoseGameplayInputRuntime` sports output in a
small `SportsMotionSnapshotSource` adapter. It reuses the same Pose inference
result and does not create a second camera or inference path. Developer mode
uses `SportsMotionTestProvider` and needs no camera.

## Incoming shot course

The pure deterministic Core owns the seeded shot schedule, current phase,
round clock, immutable shots, resolutions, result metadata, scoring, and
presentation events. No gameplay path uses `Math.random`.

Shot families are presentation/timing data only:

- `NORMAL`: standard medium arc and travel.
- `FAST`: faster, flatter presentation with the same Core-owned contact
  judgment model.
- `LOB`: higher, more visible arc.

Warm-up targets are `NORMAL` only. After warm-up, the seeded schedule includes
all three families. Each shot has a deterministic target time, visual incoming
side, and `PENDING` / grade / `MISS` resolution. Target times are strictly
increasing and remain inside the 60-second round.

Exact target spacing:

| Phase | Elapsed time | Spacing |
| --- | ---: | ---: |
| WARM-UP | 0–14,999 ms | 2,200 ms |
| RALLY | 15,000–34,999 ms | 1,900 ms |
| PRESSURE | 35,000–49,999 ms | 1,650 ms |
| MATCH RUSH | 50,000–59,999 ms | 1,450 ms |

The minimum spacing is 1,450 ms. Visual lead is approximately 1,800 ms; the
renderer derives the ball position from Core elapsed time and never decides
contact success.

## Contact and return interpretation

The provisional symmetric contact windows are:

- `PERFECT`: absolute offset `<= 140 ms`.
- `GREAT`: absolute offset `> 140 ms` through `280 ms`.
- `GOOD`: absolute offset `> 280 ms` through `450 ms`.
- `MISS`: unresolved after the late edge, or a swing outside the window.

One swing attempt resolves the nearest eligible unresolved shot only. A swing
before target minus 450 ms does not resolve a ball. Match Rush keeps these
windows unchanged; its difficulty comes from spacing and visual pace.

`vectorX` is cosmetic/game-local only: bounded negative values steer left,
bounded positive values steer right, and near-neutral values return centrally.
`vectorY` contributes a small bounded arc variation. Vector direction never
gates a valid timed contact. `intensity` is clamped to `0..1`, maps to a
`round(intensity × 40)` power bonus, and affects the return trail/presentation.

## Scoring and rally

Base grades are `PERFECT 150`, `GREAT 120`, `GOOD 90`, and `MISS 0`.

Successful returns add the bounded power bonus plus `+10` for every completed
five-success rally tier, capped at `+50`. A miss resets the current rally;
score never becomes negative. The Core records score, returns, misses, grade
counts, current/best rally, left/right hand return counts, and last return
metadata including grade, offset, hand, power, direction, and arc.

## Presentation and MATCH RUSH

The procedural/vector court keeps the opponent, player, incoming ball, ball
shadow/landing cue, contact zone, racket swing, return trail, large grade
feedback, timer, score, and rally count visible from projector distance.

Misses show the ball passing/bouncing feedback and a restrained `MISS` label;
there is no punitive full-screen red flash. Successful contacts show a racket
arc, impact flash, squash/stretch ball treatment, return trail, and large
grade feedback.

At 50 seconds, `MATCH RUSH` is announced through a distinct phase banner,
stronger court/light pulse, faster legal 1,450 ms schedule, stronger return
trail, and more emphatic streak presentation. The contact tolerance does not
tighten.

## Production route and privacy boundary

Production navigation lazy-loads `TennisPoseGameScreen`. Camera startup is
explicit through the shared `CameraPresentationStage`; there is no automatic
permission prompt and no microphone request. The request selects
`UPPER_BODY`, `pose: true`, `hands: false`, and `audio: false`. Active play is
opaque Phaser rather than Camera AR. Tracking loss returns the shared camera /
recovery presentation and freezes Core time; recovery resumes the same state.

Developer navigation lazy-loads `TennisGameScreen`. `Z` / `Q` trigger a fixed
left synthetic swing, `C` / `E` trigger a fixed right synthetic swing, and two
large on-screen buttons provide `左手揮拍` and `右手揮拍`.

## Registry and navigation

Tennis is registered as:

- id `tennis`, title `網球對決`, category `SPORTS`, subcategory `RACKET_BALL`;
- one player, `MEDIUM` reaction demand, `LOW` cognitive complexity, `MEDIUM`
  activity, `STANDING` posture;
- `UPPER_BODY`, `LEFT_HAND`, and `RIGHT_HAND` body areas;
- optional narrow `requiresSportsMotion: true` capability;
- explicit DEV and production lazy routes from the Home card.

The registry extension is optional and defaults to false when absent. It does
not introduce a `SWING` Motion Action ID and does not migrate unrelated schema.

## Engineering versus Physical status

Engineering gates are complete: registration, navigation, deterministic Core,
Session adapter, Developer Test Mode, production Sports Motion route, lifecycle
pause/recovery boundary, typecheck, lint, tests, build, and diff checks pass.

Physical QA is pending. Do not treat this document as evidence of real-device
swing recognition, camera framing quality, projector readability, or fatigue
behavior.
