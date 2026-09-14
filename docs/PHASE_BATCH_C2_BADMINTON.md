# Batch C2 — Badminton

Updated: 2026-09-14

## Outcome and status

Batch C2 delivers 羽球快打 / Badminton as the second bounded game consumer of
the C0 Sports Motion Toolkit.

Engineering status: `ENGINEERING PASS`.

Portfolio status: `PHYSICAL QA PENDING`.

This is an Engineering Prototype result. Physical swing recognition, iPhone
Safari behavior, compact-space play, fatigue, projector distance, timing
tuning, and final game feel remain unvalidated. No physical swing pass is
claimed.

## Game loop

- Single player, standing, `UPPER_BODY` framing.
- Setup uses the shared mirrored camera and readiness UI.
- Active play uses an opaque procedural 1280 × 720 Phaser badminton court with
  a net, opponent, player, shuttle, landing cue, racket arc, and return trail.
- The round has a 3-second countdown, 60 seconds of play, and stable result /
  replay screens.
- Core time pauses when setup is not ready or a hard sensor failure is
  reported. Recovery resumes the same state.
- Either anatomical hand may return any visual target region; physical lateral
  walking and stroke classification are not required.

## Core and incoming shuttles

`BadmintonCore` is pure deterministic state: it owns the countdown, 60-second
clock, seeded shuttle schedule, phase transitions, immutable shuttle
resolutions, return metadata, scoring, rally state, result state, and
presentation events. Gameplay never calls `Math.random`.

The game-local families are presentation/timing types only:

- `CLEAR`: high visible parabola with generous preparation time;
- `DRIVE`: flatter, faster-looking direct flight;
- `DROP`: high approach followed by a readable sharp descent.

Target regions are visual/game context only: `HIGH_LEFT`, `HIGH_RIGHT`,
`MID_LEFT`, and `MID_RIGHT`. Warm-up teaches a deterministic `CLEAR` left,
`CLEAR` right, `DRIVE`, `DROP` sequence before seeded variety begins. Core owns
contact time; Phaser derives curves from Core elapsed time and never judges a
hit.

## Timing and contact

Phase boundaries are 0–15 seconds `WARM_UP`, 15–35 `RALLY`, 35–50
`SMASH_ZONE`, and 50–60 `SHUTTLE_RUSH`.

Exact target spacing:

| Phase | Elapsed time | Spacing |
| --- | ---: | ---: |
| WARM_UP | 0–14,999 ms | 2,000 ms |
| RALLY | 15,000–34,999 ms | 1,650 ms |
| SMASH_ZONE | 35,000–49,999 ms | 1,450 ms |
| SHUTTLE_RUSH | 50,000–59,999 ms | 1,250 ms |

The minimum spacing is 1,250 ms and there are no simultaneous shuttles. The
visual lead is 1,700 ms, with `CLEAR` using a modest 1,900 ms lead. The
provisional symmetric contact windows are:

- `PERFECT`: absolute offset `<= 130 ms`;
- `GREAT`: absolute offset `> 130 ms` through `260 ms`;
- `GOOD`: absolute offset `> 260 ms` through `420 ms`;
- `MISS`: unresolved after target plus 420 ms.

A swing before target minus 420 ms does not resolve a shuttle. One attempt
resolves at most one nearest eligible pending shuttle. `SHUTTLE_RUSH` keeps
these judgement windows unchanged; its difficulty comes from faster legal
exchange spacing and presentation pace.

## Sports Motion consumption and sequence safety

`BadmintonSwingAttempt` contains only `hand`, game-local `timestampMs`,
`vectorX`, `vectorY`, `intensity`, and `sequence`. `BadmintonCore` imports no
Pose, camera, MediaPipe, or Sports Motion provider types.

`BadmintonSession` reads only `SportsMotionSnapshotSource`. It tracks retained
left and right swing sequences independently, marks the current sequence on
start and replay, and emits only an event whose side-specific sequence is
strictly newer than the last seen value. New events are marked and discarded
while setup is unready, so tracking recovery cannot replay them. Hard failure
does not advance Core time. A retained C0 event can therefore score at most
once and one swing occurrence can resolve at most one shuttle.

Developer mode uses the camera-free `SportsMotionTestProvider`; production
wraps the existing `PoseGameplayInputRuntime.getSportsMotionSnapshot()` in a
small polling adapter. No second Pose inference path is introduced.

## Vector, intensity, and Smash

Vector direction is intentionally not a success gate because C0 vector
semantics are not physically validated. `vectorX` cosmetically selects broad
left/center/right return placement. `vectorY` selects a bounded return arc,
with negative canonical Y reading as a more upward clear-style return and
positive Y as a lower return. All output is clamped.

Intensity is clamped to `0..1` and maps to `round(intensity × 35)` power bonus.
After a successful contact, the deterministic game-local Smash presentation
triggers when intensity is at least `0.75` and canonical `vectorY <= -0.35`.
It adds `+25`, stronger impact/trail, and a `SMASH!` callout. Smash is bonus /
presentation only and is not required for a successful return.

## Scoring and rally

Base grades are `PERFECT 150`, `GREAT 120`, `GOOD 90`, and `MISS 0`.
Successful returns add the bounded power bonus, optional `SMASH +25`, and
`+10` for each completed five-success rally tier, capped at `+50`. A miss
resets current rally; score is never negative. Core records score, returns,
misses, grade counts, current/best rally, left/right return counts, Smash
count, and the latest return metadata.

## Presentation and production path

The bright indoor procedural court is designed for projector readability.
Success shows the used-hand racket/energy arc, impact flash, shuttle
squash/stretch, grade, rally feedback, and return trail. Misses show the
shuttle landing/passing and restrained `MISS` text without a punitive full
screen failure treatment.

At 50 seconds, `SHUTTLE_RUSH` adds an announcement, stronger arena lighting,
denser trail, stronger streak treatment, and the legal 1,250 ms schedule. It
does not tighten contact windows or alter C0 detection.

Production navigation explicitly starts the existing Pose runtime through the
shared `CameraPresentationStage`. The request is `UPPER_BODY`, `pose: true`,
`hands: false`, and `audio: false`; no microphone or automatic permission is
used. Setup and tracking recovery show the mirrored camera/framing UI, while
active gameplay is opaque Phaser. The camera-free developer route uses `Z` /
`Q` for left, `C` / `E` for right, large `左手揮拍` / `右手揮拍` buttons, and
`Shift + Z` / `Shift + C` for the optional strong Smash test path.

## Engineering versus Physical status

Engineering gates cover registration, navigation, deterministic schedule,
contact/scoring rules, sequence-safe Session consumption, Developer Test Mode,
production Sports Motion wiring, lifecycle pause/recovery, typecheck, lint,
tests, build, diff checks, and browser smoke at the available local landscape
viewport.

Physical QA is pending. This document does not claim real-device swing
recognition, iPhone Safari behavior, physical UPPER_BODY framing quality,
projector readability, or fatigue validation.
