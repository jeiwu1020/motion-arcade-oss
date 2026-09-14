# Batch E — Baseball / 全壘打王

Updated: 2026-09-15

## Outcome and status

Batch E delivers a bounded single-player arcade batting challenge as the first
game in the Baseball family.

Engineering status: `ENGINEERING PASS`.

Portfolio status: `PHYSICAL QA PENDING`.

This status covers deterministic software behavior and the normalized input
integration only. Physical swing recognition, compact-space comfort, Windows
Chrome and iPhone Safari behavior, fatigue, projector readability, timing, and
game feel remain unvalidated. No `PHYSICAL PASS` is claimed.

## Batting-only scope

The player stands in place, reads an automatically delivered pitch, performs a
broad empty-hand arm swing, and receives immediate timing, trajectory, hit
category, score, and streak feedback. Either anatomical hand can hit any pitch
or target zone.

The v1 boundary intentionally excludes pitching input, base runners, innings,
defense, simultaneous two-hand recognition, dominant-hand setup, realistic
biomechanics, and physical bats. Players are explicitly told not to hold or
swing an object.

## C0 Sports Motion consumption

`BaseballSession` consumes only `SportsMotionSnapshotSource`. Each strictly
newer retained left or right `SportsSwingEvent` becomes a game-local
`BaseballSwingAttempt` containing `hand`, game-local `timestampMs`, `vectorX`,
`vectorY`, `intensity`, and `sequence`. Baseball Core has no Pose, MediaPipe,
camera, landmark, or Sports Motion provider dependency.

Left and right cursors are independent. Start and replay mark the currently
retained sequences. While setup is unready or the production runtime is in a
hard-failure state, the Session marks new events but drops them and pauses Core
time. Recovery therefore continues the exact pitch schedule without replaying
a stale swing. One occurrence resolves at most one pitch.

Production reads `getSportsMotionSnapshot()` from the existing
`PoseGameplayInputRuntime`; the same Pose inference result continues to feed
C0. No detector, second inference, Hands model, camera pipeline, or shared
threshold was added.

## Round and deterministic pitch schedule

The round uses a 3-second countdown and exactly 60 seconds of batting. It never
ends early and has no lives.

| Phase | Elapsed time | Exact pitch spacing |
| --- | ---: | ---: |
| `WARM_UP` | 0–14,999 ms | 3,000 ms |
| `BATTING` | 15,000–34,999 ms | 2,600 ms |
| `POWER_INNING` | 35,000–49,999 ms | 2,300 ms |
| `HOME_RUN_RUSH` | 50,000–60,000 ms | 2,000 ms |

The first contact target is at 1,800 ms, which also defines the visual lead.
No targets are simultaneous or closer than 2,000 ms. The same seed produces
the same pitch types, target zones, contact times, and phase transitions;
replay reuses the original seed and no gameplay path calls `Math.random`.

Warm-up contains `FASTBALL` only. Later pitches rotate deterministically through
`FASTBALL`, `CURVEBALL`, and `CHANGEUP` from a seeded offset. Target zones rotate
through seeded `HIGH`, `CENTER`, and `LOW` presentation regions. Zones never
require physical movement and never gate contact.

## Timing and hit interpretation

The symmetric contact windows are:

- `PERFECT`: absolute offset `<= 120 ms`;
- `GREAT`: `> 120 ms` through `240 ms`;
- `GOOD`: `> 240 ms` through `380 ms`;
- `MISS`: unresolved after the late edge, or unresolved when the round ends.

A swing before target minus 380 ms does not resolve a pitch. The nearest
eligible pending pitch is selected deterministically. Vector and intensity do
not gate a valid timed contact.

After contact, C0 values contribute only bounded arcade presentation/results:

```text
hitPower = 0.55 + clamp01(intensity) × 0.45

fieldDirection = LEFT_FIELD   when clamp(vectorX) < -0.25
                 RIGHT_FIELD  when clamp(vectorX) > +0.25
                 CENTER_FIELD otherwise

launchArc = clamp01(0.50 + (-vectorY) × 0.25)

contactQuality = clamp01(timingFactor × 0.70 + hitPower × 0.30)
```

Timing factors are `PERFECT 1.00`, `GREAT 0.82`, and `GOOD 0.65`.

The deterministic arcade outcome is:

- `HOME_RUN`: quality `>= 0.88` and launch arc `>= 0.50`;
- `TRIPLE`: quality `>= 0.78`;
- `DOUBLE`: quality `>= 0.68`;
- `SINGLE`: otherwise.

These labels are fictional game outcomes. They are not measurements of real
bat speed, bat angle, physical power, or baseball performance. A low-intensity
valid C0 swing can still make contact and always receives at least 0.55 game
power.

## Scoring

Grade bases are `PERFECT +150`, `GREAT +120`, and `GOOD +90`. Result bonuses
are `SINGLE +50`, `DOUBLE +100`, `TRIPLE +175`, and `HOME_RUN +300`. The power
bonus is `round(clamp01(intensity) × 30)`.

Every successful hit increments the hitting streak; a `MISS` resets it. Each
completed five-hit tier adds `+10`, capped at `+50`. Score never decreases.
The Core records scheduled pitches, hits, misses, grade counts, hit-category
counts, current/best streak, left/right hand hit counts, and immutable last-hit
metadata with every formula component and score award.

## Presentation and HOME RUN RUSH

The opaque 1280 × 720 procedural Phaser stadium is a read-only projection of
Core state. It includes a large pitcher, foreground batter, catcher, strike
zone, oversized ball, readable pitch trails, target height, impact rings,
side-driven swing animation, and Core-derived batted-ball trajectories.

`FASTBALL` has a flat bright trail, `CURVEBALL` has an exaggerated lateral
curve, and `CHANGEUP` visibly hangs with a pulse. Contact shows the grade and
single/double/triple/home-run callout; misses pass to the catcher without
stopping the round. A home run adds a long launch trail, sparks, and amplified
callout.

At exactly 50 seconds, `HOME_RUN_RUSH` intensifies stadium lighting, crowd
motion, pulse, trails, and the phase banner while keeping the same contact
window and requiring a normal Core-derived home-run outcome.

## Developer and production paths

Developer Test Mode is camera-free and uses `SportsMotionTestProvider`.
`Z`/`Q` trigger a left swing, `C`/`E` trigger a right swing, and Shift raises
the test intensity from `0.72` to `1.00`. Two large buttons provide left and
right swings at the normal intensity. Buttons never set a grade or result.

Production uses the existing shared camera presentation and
`PoseGameplayInputRuntime` with explicit camera start, `UPPER_BODY` readiness,
and `{ pose: true, hands: false, audio: false }`. Setup asks for head,
shoulders, arms, wrists, torso, and hips; knees and ankles are not required.
Active play is opaque Phaser. Tracking loss restores shared recovery guidance,
pauses Core time, and resumes the same state after readiness returns.

## Engineering versus Physical status

Engineering acceptance covers registration, explicit DEV/production routes,
pure deterministic Core, C0 Session adapter, complete countdown/play/result/
replay lifecycle, bilateral Developer controls, production framing and privacy
boundaries, automated tests, static checks, build, and landscape smoke checks.

Physical QA remains separate. It must later validate real-person empty-hand
swing recognition, false positives/negatives, timing, recovery, safe movement,
fatigue, iPhone Safari landscape, and projector readability before any shared
threshold change or physical claim.
