# Batch D3 — High Jump Engineering Prototype

Status: `ENGINEERING PASS`; `PHYSICAL QA PENDING`

Game: `high-jump` — 跳高挑戰 / High Jump

## Timing-first design

High Jump is a compact-space, standing arcade timing game. The participant
performs a small comfortable vertical jump and tries to trigger the existing
normalized `JUMP` action while the Core-owned takeoff marker is near its peak.
Every valid JUMP occurrence is physically equivalent in v1. The game does not
measure jump height, air time, velocity, power, centimeters, meters, or any
other physical-performance value, and it never asks the participant to jump
harder or higher.

There are five fictional escalating bar levels. Each level has exactly one
attempt, and a miss or a no-jump timeout continues to the next level. There are
no lives or elimination rules.

## Core state machine

`HighJumpCore` is framework-independent and imports no React, Phaser, Pose, or
Motion provider. It owns the phase, stage, countdown, takeoff meter, attempt
resolution, score, statistics, immutable presentation events, and stable final
result:

```text
COUNTDOWN -> READY_FOR_ATTEMPT -> APPROACH -> TAKEOFF -> FLIGHT
                                      |                         |
                                      +------ RESULT <-----------+
                                                 |
                                      STAGE_TRANSITION
                                                 |
                              READY_FOR_ATTEMPT or FINISHED
```

The initial countdown is 3,000 ms. Each stage uses 700 ms of ready copy,
6,000 ms of approach time, 300 ms of takeoff presentation, 900 ms of flight,
1,000 ms of result feedback, and 700 ms of stage transition. A missing JUMP at
the end of APPROACH resolves as `NO_JUMP` with zero points. The five-stage
result is stable after the final transition.

## Takeoff meter and thresholds

The Core owns a deterministic 2,400 ms triangle wave:

- 0 → 1 over 1,200 ms;
- 1 → 0 over 1,200 ms;
- value and direction are bounded and repeat without `Math.random`.

The meter freezes whenever Session does not advance Core time. A JUMP
occurrence is evaluated against the current meter value at delivery time.

The grade thresholds are symmetric for the rising and falling portions:

| Takeoff value | Grade |
|---:|---|
| `>= 0.90` | PERFECT |
| `>= 0.78` and `< 0.90` | GREAT |
| `>= 0.64` and `< 0.78` | GOOD |
| `< 0.64` | OK |

Clearance uses the fictional stage thresholds `[0.50, 0.58, 0.66, 0.74,
0.82]`. Equality clears; a value just below the threshold misses. The
physical JUMP action value is not read by Core and cannot change clearance.

## Scoring

Grade points are PERFECT 300, GREAT 220, GOOD 150, and OK 80. A clear adds
200 plus the stage bonus `[0, 50, 100, 150, 250]`. A missed bar retains its
grade points but receives no clear or stage bonus. A no-jump timeout is worth
zero. Score is never negative.

The result tracks bars cleared, best cleared level, grade counts, and no-jump
count. No combo or physical-effort bonus is used.

## Existing JUMP consumption and sequence safety

`HighJumpSession` bridges the existing `MotionInputProvider` into a small Core
input containing only a fresh JUMP sequence. It does not pass a
`MotionInputSnapshot` or action value to Core.

- the retained JUMP sequence is marked on Session start;
- replay marks the currently retained sequence before the new countdown;
- only a strictly newer JUMP sequence is considered;
- JUMP occurrences during COUNTDOWN, READY, TAKEOFF, FLIGHT, RESULT, or stage
  transition are consumed and ignored;
- occurrences while setup is unready or a hard failure is active are consumed
  and ignored without advancing Core time;
- recovery cannot replay a retained occurrence;
- one sequence can resolve at most one attempt.

This is the same normalized occurrence-safety boundary used by Runner. Phaser
does not judge timing.

## Production path and framing

Production uses the existing explicit-start `PoseGameplayInputRuntime` and its
single `PoseMotionInputProvider` pipeline. The request is `JUMP` only, with
`pose: true`, `hands: false`, and `audio: false`; no microphone, Hands model,
second inference session, or raw Pose dependency reaches High Jump Core.

High Jump intentionally uses `FULL_BODY` with the default `STRICT` lower-body
readiness because the existing JUMP action depends on genuine lower-body and
ankle evidence. Setup asks the participant to keep the head, shoulders, hips,
knees, and both ankles visible. Tracking loss returns the shared recovery UI
and pauses Core time; recovery resumes the same meter and stage state.

Active play is an opaque procedural Phaser stadium, not Camera AR. The
Developer route is camera-free and uses the same Session/Core path.

## Presentation

The 1280 × 720 procedural playfield shows a stadium, runway, landing mat,
oversized bar, avatar, and large takeoff meter. The avatar's flight apex is a
fictional visual value derived from the timing grade/value only; it is not a
measurement of physical jump height. A clear produces a bar glow, upward trail,
grade, and score feedback. A miss produces restrained bar feedback and the
next level continues immediately. Level 5 receives stronger lighting and
final-bar emphasis without changing input thresholds or asking for more effort.

The safety instruction is: 「輕輕向上跳即可，重點是抓準起跳時機。」

## Engineering versus physical status

Automated engineering gates cover the meter boundaries, grade/clearance
boundaries, five-stage lifecycle, timeout behavior, scoring, replay and
retained-sequence safety, explicit production request, and Developer controls.
The existing JUMP detector, its thresholds, Pose thresholds, and camera
lifecycle are unchanged.

This is not a Physical PASS. Comfortable jump timing, iPhone Safari behavior,
tracking recovery, compact-space framing, fatigue, and projector validation
remain `PHYSICAL QA PENDING`.
