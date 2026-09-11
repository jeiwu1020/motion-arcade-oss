# Motion Arcade — Balloon Rally v2 Game Design

Status: engineering implementation; Windows/iPhone physical validation required

## Purpose

Balloon Rally v2 retains the established Camera AR boundary:

```text
Camera / Pose → SpatialHandSnapshot → SpatialCollisionInputAdapter
              → BalloonRallySession → BalloonRallyCore → Phaser
```

It changes the player experience from continuous posture validation to
**start strict, play relaxed**: establish a legitimate UPPER_BODY setup first,
then favour uninterrupted, forgiving hand interaction throughout the round.

## Round and scoring

- Countdown: 3 seconds; active round: 60 seconds.
- 0–15 seconds, WARM UP: two 2-HP standard balloons.
- 15–35 seconds, RALLY: three 2-HP standard balloons.
- 35–50 seconds, FEVER: four 2-HP standard balloons and stronger Combo focus.
- 50–60 seconds, PARTY RUSH: five 1-HP Party balloons.

A separated standard-balloon hit grants one score and one hit. The second hit
pops it, adds one pop and a two-point bonus, for four base points. Balloons do
not expire and there is no miss counter. A Party balloon pops on one hit and
grants one hit point plus a one-point Party pop bonus, for two base points.
Popped balloons are immediately replaced to maintain the current population.

At PARTY RUSH, existing standard balloons convert deterministically to 1-HP
Party balloons, so the playfield never presents mixed durability rules.

## Combo

`BalloonRallyCore` owns Combo state. Each accepted hit starts or refreshes a
1,500 ms window. A hit inside that window increments Combo; after it expires,
Combo resets. Combo 1–4 adds no score. Combo 5 and above adds one score to
every accepted hit. `bestCombo` remains for the result screen. The timer freezes
only when the round itself freezes in soft or hard recovery.

## Forgiving spatial interaction

The visible balloon radius remains 68 logical pixels. Collision is separate:

```text
effective hit radius = visual balloon radius + 42 virtual-hand radius + 10 tolerance
```

The session retains swept segment collision and per-hand/per-target contact
state: outside → contact scores once; held overlap does not farm score; leave
then re-enter may score again. Anatomical left and right contacts stay
independent. No fake hand coordinate is created while a wrist is unavailable.

The optional <=120 ms wrist-dropout bridge is deliberately not enabled in v2.
An unavailable sample still breaks continuity. The increased bounded hit volume
is the simpler, safer response to short wrist dropouts.

## Active-game tracking

Setup remains strict: a real UPPER_BODY baseline, core/torso quality, and
framing are required before countdown advances. Knees and ankles are not
required for Balloon Rally; other FULL_BODY games retain their existing
requirements.

Once the Core is PLAYING, `BalloonRallySession` applies these centralized
thresholds:

| State | Missing useful tracking | Behavior |
|---|---:|---|
| NORMAL | none | round, physics, and contacts proceed |
| DEGRADED | 0–1,500 ms | round continues; no blocking UI; an available hand still works |
| SOFT_RECOVERY | 1,500–3,000 ms | freeze Core time/physics, clear continuity, show `雙手回到畫面即可繼續` |
| HARD_PAUSE | >=3,000 ms or sensor/runtime failure | remain frozen, clear continuity, show established dominant recovery |

Loss of one wrist alone never pauses play. Pose/runtime hard failure is kept
separate from ordinary quality degradation. Geometry loss/change clears
continuity rather than creating a recovery sweep.

## Physics and presentation

Initial standard drift is 70–120 px/s, capped at 360 px/s. Party balloons spawn
at 95–155 px/s and cap at 420 px/s. Segment direction drives a bounded impulse;
relative hand-to-balloon direction is the safe fallback. Boundary reflection is
retained. A small, capped acceleration is applied only inside an 88 px outer
band to return edge/corner-trapped balloons to the playable region; it is not a
constant centre magnet.

PARTY RUSH adds five one-hit targets, Party visuals, stronger pop rings, and a
short playfield-edge pulse with a large cue. Production HUD shows score and
time; Combo appears only from two onward. Results show score, valid hits,
balloons popped, and best Combo. Engineering markers, collision circles, and
probe UI remain unavailable in normal production presentation.

## Deferred

Special balloons, audio, Hands Landmarker, multiplayer, persistence,
analytics, and diagnosis-specific behavior are outside v2.

## Required physical validation

Validate Windows Chrome and iPhone Safari landscape for perceptual contact
reliability, fast swipes, no held-contact farming, one-hand continuity, the
1.5/3 second recovery policy, PARTY RUSH readability/playability, browser
resize/orientation, 60-second stability, replay, and projector readability.
No physical PASS is claimed by this document.
