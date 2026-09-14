# Batch D2 — Swimming Engineering Prototype

Status: `ENGINEERING PASS`; `PHYSICAL QA PENDING`

Game: `swimming` — 泳池衝刺 / Swimming

## Purpose and safety boundary

Swimming is a 60-second standing arcade simulation. The participant remains in
place and alternates broad left/right arm swings while racing three deterministic
AI swimmers. Arcade progress, speed level, detected strokes, and ranking are game
values only: they are not swimming distance, real speed, calories, technique, or
clinical cadence measurements. The game never asks the participant to lie down
or move toward the camera.

C0 Sports Motion was sufficient for this engineering contract. D2 adds no shared
arm-stroke detector and changes no C0 or Pose thresholds. Alternation, rhythm,
recent power, and propulsion are deliberately game-local under
`src/games/swimming/`.

## Runtime architecture

```text
one front-camera Pose inference result
  -> existing PoseSportsMotionTracker
  -> retained SportsMotionSnapshot LEFT/RIGHT swing events
  -> SwimmingSession retained-sequence cursors
  -> game-local SwimmingStrokeCycle
  -> small normalized SwimmingInputSnapshot
  -> pure SwimmingCore
  -> read-only Phaser pool projection
```

`SwimmingCore` imports no React, Phaser, Pose, camera, or Sports Motion provider.
It owns countdown/round time, race phase, player arcade progress, deterministic AI
progress, stable ranking, overtake events, stroke presentation statistics, score,
and final result. Phaser derives all visuals from Core state.

## Retained-event and alternation rules

- Session marks current LEFT and RIGHT swing sequences on start and replay.
- Each anatomical side has an independent sequence cursor; only a strictly newer
  event is inspected.
- New events are marked even while setup is unready or the runtime has a hard
  failure, but they are not sent to the cycle or Core.
- Recovery cannot replay an event retained by C0. One event contributes at most
  one stroke attempt.
- The first accepted stroke may be LEFT or RIGHT. Thereafter the next propulsion
  stroke must be the opposite anatomical side.
- Same-side repetition is consumed but not accepted; presentation may briefly
  show `換另一手` without treating it as a failure.
- A valid opposite stroke is accepted at an interval of at least `260 ms`.
- An interval above `1800 ms` accepts the new stroke as a fresh rhythm start,
  resetting cadence history and current alternating streak to one.
- Cadence uses the mean intervals from at most six recent accepted strokes:
  `60000 / meanIntervalMs`, clamped to `0..200` game-rhythm units.

LEFT and RIGHT are always participant anatomy. Mirrored preview is presentation
only and never swaps the sides.

## Propulsion

Recent average intensity uses at most four accepted strokes, with every C0
intensity clamped to `0..1`.

```text
cadenceFactor = clamp01(strokeCadence / 150)
powerFactor = recentAverageIntensity
basePropulsion = clamp01(cadenceFactor * 0.65 + powerFactor * 0.35)
```

After an accepted stroke, base propulsion is held through `500 ms`. It then
decays linearly and is exactly zero at `1500 ms`. Same-side spam does not refresh
the hold clock. Vector never gates acceptance; clamped `vectorY` only alters the
visual splash/arm arc.

Core maps current propulsion to fictional speed:

```text
playerSpeed = propulsion <= 0.001 ? 0 : 0.18 + propulsion * 0.82
progress += playerSpeed * deltaSeconds * phaseScale
```

Phase scales are `WARM_UP 0.95`, `CRUISE 1.00`, `CHASE 1.04`, and
`FINAL_SPLASH 1.09`. Normal UI shows only the friendly `速度 0..100` meter.

## Race, AI, ranking, and score

After a repeated-small-frame 3-second countdown, the race always runs exactly 60
seconds:

| Core time | Phase |
|---|---|
| 0–15 s | WARM_UP |
| 15–35 s | CRUISE |
| 35–50 s | CHASE |
| 50–60 s | FINAL_SPLASH |

The three AI personalities use seeded `0.97..1.03` variation and no
`Math.random`:

- STEADY holds pace `0.62`.
- SURGER uses base `0.56` and adds `0.24` during deterministic 18–24, 31–37,
  and 44–50 second windows.
- FINISHER starts at `0.53` and linearly adds up to `0.47` from 35–60 seconds.

AI phase scales are `0.94 / 1.00 / 1.04 / 1.12`. Ranking uses progress with a
fixed PLAYER, STEADY, SURGER, FINISHER tie order and a `1e-9` comparison epsilon.
Each newly passed AI produces one overtake event; losing a place does not count.

Final score is:

```text
round(playerArcadeProgress * 100)
+ overtakes * 100
+ placement bonus (1st 500, 2nd 300, 3rd 150, 4th 0)
```

No alternation score bonus is included in v1, and score cannot be negative.

## Developer and production paths

Developer Test Mode uses the camera-free `SportsMotionTestProvider`:

- `Z` / `Q`: LEFT stroke at intensity `0.70`.
- `C` / `E`: RIGHT stroke at intensity `0.70`.
- Shift plus either shortcut: intensity `1.00`.
- Large `左手划水` and `右手划水` buttons provide the same inputs.

The controls only trigger C0 swing events; they never set game speed directly.

Production uses explicit camera start, the existing mirrored setup/recovery UI,
`UPPER_BODY` framing and ability profile, Pose `true`, Hands `false`, and audio
`false`. Head, shoulders, arms, wrists, torso, and hips should remain visible;
knees and ankles are unnecessary. The same Pose inference result feeds C0 Sports
Motion. Playing uses an opaque 1280 x 720 Phaser pool; tracking loss pauses Core
time and returns to shared recovery UI.

## Presentation and status

The procedural playfield provides four large lanes, oversized stylized swimmers,
water bands, side-readable stroke splashes, large speed/rank/time HUD, overtake
feedback, and a stronger pink/aqua FINAL SPLASH light-and-trail treatment from
exactly 50 seconds. Result UI reports only game score, place, speed levels,
overtakes, detected game strokes, and left/right counts.

Automated engineering coverage verifies arm-cycle boundaries, exact propulsion
math/decay, countdown and 60-second lifecycle, phase boundaries, deterministic AI,
stable ranking/overtakes, scoring, retained-event safety, camera-free controls,
and explicit UPPER_BODY production setup. Physical arm-swing recognition,
iPhone Safari, standing comfort, fatigue, projector readability, and real camera
recovery remain `PHYSICAL QA PENDING`; no Physical PASS is claimed.
