# Motion Arcade — Full Game Portfolio Plan v1

Updated: 2026-09-14

This is the canonical portfolio build plan for Motion Arcade. It defines the
formal game set, shared-foundation batches, implementation order, model policy,
Engineering Prototype acceptance contract, and the later physical QA sweep.
[Master Implementation Plan](./MASTER_IMPLEMENTATION_PLAN.md) remains the
canonical product and architecture roadmap; [Current Phase](./CURRENT_PHASE.md)
is the short live checkpoint.

## 1. Batch Build Mode

Motion Arcade is now in **BATCH BUILD MODE**.

The portfolio will first be built game by game to an Engineering Prototype
standard. Physical camera, microphone, device, compact-space, and projector
validation will then be performed as a separate systematic sweep.

Operating rules:

- do not block a later game because an earlier game's real-device detector
  tuning is incomplete;
- freeze Balloon Rally and Reaction Arena during the portfolio build unless a
  shared regression requires a focused correction;
- do not casually tune shared Pose, spatial, locomotion, voice, or audio
  thresholds for one physically unvalidated game;
- any shared sensor or threshold change must be planned as an explicit
  shared-foundation batch with cross-consumer regression coverage;
- games consume normalized contracts only; raw landmarks, media streams,
  microphone samples, and browser sensor APIs stay outside Game Core;
- `ENGINEERING PASS` establishes software completeness, not physical recognition
  quality;
- premium art and production tuning wait until the interaction loop is stable.

## 2. Status terminology

Use only these portfolio states, in this order:

1. `PLANNED`
2. `ENGINEERING IN PROGRESS`
3. `ENGINEERING PASS`
4. `PHYSICAL QA PENDING`
5. `PHYSICAL PASS`
6. `PRODUCTION POLISH PENDING`
7. `PRODUCTION READY`

`ENGINEERING PASS` means that the Engineering Prototype PASS contract in
Section 8 is satisfied. It does not imply camera, microphone, compact-space,
iPhone, projector, recognition, fatigue, timing, or game-feel validation. Once
engineering acceptance is recorded and physical testing remains outstanding,
the live portfolio state is `PHYSICAL QA PENDING`.

No game may be marked `PHYSICAL PASS` without recorded real-device evidence.

## 3. Current frozen games

| Game | Portfolio state | Frozen engineering baseline | Remaining gate |
|---|---|---|---|
| Balloon Rally | `PHYSICAL QA PENDING` | Engineering implementation is mature enough to freeze. | Windows/iPhone gameplay, camera/audio/framing retest, and projector production validation. |
| Reaction Arena / 光速反應王 | `PHYSICAL QA PENDING` | Practice mode; compact `FULL_BODY` `KNEES` readiness; `LOW_MOTION`; MOVE or LEAN directional input; relaxed `LOW_MOTION` reach; hip-led squat fallback; Pose skeleton diagnostic overlay. | Windows/iPhone compact-space recognition and production/projector tuning. |

Do not reopen either game during portfolio batch construction unless a shared
foundation change creates a regression that must be corrected across its
consumers.

## 4. Formal portfolio

The formal v1 portfolio contains **15 games**: the two frozen current games and
the following thirteen planned games. Shared foundation batches are not counted
as games.

### Batch A — Runner / Avatar Action

**Game:** 跑酷衝刺 / Runner

**Engineering gate:** `ENGINEERING PASS`

**Portfolio state:** `PHYSICAL QA PENDING`

**Primary model:** Sol High for the first implementation

- Presentation: non-camera-AR primary gameplay with a large readable avatar;
  camera remains the sensor/setup layer.
- Framing: `FULL_BODY`, with `STRICT` lower-body readiness because JUMP needs
  reliable ankle data.
- Inputs: `MOVE_LEFT`, `MOVE_RIGHT`, `JUMP`, `SQUAT`.
- Goals: three lanes, lane changes, jump obstacles, duck obstacles, increasing
  speed/density, and action-driven avatar animation.
- Boundary: do not implement full landmark retargeting.
- Delivered: deterministic 3-second countdown and 60-second course; warm-up,
  flow, challenge, and Final Rush pacing; three obstacle families; score,
  streak, collision, result, and same-seed replay; procedural action-driven
  avatar; Developer Test Mode; and an explicit-permission production Pose route.
- Physical status: Windows Chrome, iPhone Safari landscape, compact-space, and
  projector validation remain pending. No physical pass is claimed.
- Detailed record: [Batch A — Runner / Avatar Action](./PHASE_BATCH_A_RUNNER.md).

### Batch B — Rhythm

**Game:** 節奏動一動 / Rhythm Motion

**Engineering gate:** `ENGINEERING PASS`

**Portfolio state:** `PHYSICAL QA PENDING`

**Primary model:** Luna Max

- Framing: `UPPER_BODY`.
- Inputs: LEFT, RIGHT, `REACH_LEFT`, `REACH_RIGHT`; map LEFT/RIGHT through the
  established normalized directional-action boundary.
- Goals: a readable beat lane, forgiving timing, left/right/reach patterns, and
  latency instrumentation suitable for later physical tuning.
- Boundary: the initial version does not require a new CLAP detector.
- Delivered: deterministic four-lane chart, 3-second/60-second lifecycle,
  exact symmetric judgement windows, combo scoring, timing aggregates,
  Developer Test Mode, and explicit-permission `UPPER_BODY` production Pose
  route. No physical pass is claimed.
- Detailed record: [Batch B — Rhythm Motion](./PHASE_BATCH_B_RHYTHM.md).

### Batch C0 — Sports Motion Toolkit

**Type:** shared foundation; not a game

**State:** `ENGINEERING PASS`

**Primary model:** Terra High; escalate to Astra only if the shared abstraction
becomes genuinely difficult

Investigate the minimum reusable normalized contract needed for racket, bat,
and bowling motion:

- wrist trajectory;
- swing occurrence;
- swing direction, only if useful;
- release occurrence, only where required;
- speed/intensity, only if safe and reliable.

Reuse the existing spatial-wrist pipeline wherever possible. Do not create a
complex detector contract when the existing Spatial Interaction boundary is
sufficient. Games must not consume raw landmarks.

Delivered: immutable anatomical hand/swing snapshots; body-relative speed,
vector, and bounded intensity; per-hand single-event re-arm semantics; runtime
reuse of the existing Pose inference result; and a camera-free synthetic test
provider. `RELEASE` remains intentionally deferred. No physical validation is
claimed. Detailed record: [Batch C0 — Sports Motion Toolkit](./PHASE_BATCH_C0_SPORTS_MOTION_TOOLKIT.md).

### Batch C1 — Tennis

**Game:** Tennis

**State:** `ENGINEERING PASS`; `PHYSICAL QA PENDING`

**Primary model:** Luna Max after Batch C0

- Framing: `UPPER_BODY`.
- Input: Sports Motion Toolkit / normalized spatial wrist motion.
- Goals: readable incoming ball, forehand/backhand-style contact, arcade timing,
  return trajectory, and rally count/score.
- Boundary: no realistic tennis simulation is required.
- Delivered: deterministic 3-second/60-second seeded arcade course with
  NORMAL/FAST/LOB shots, forgiving symmetric contact grades, bilateral
  sequence-safe Sports Motion Session consumption, bounded return trajectory,
  rally scoring, Developer Test Mode, and explicit-permission `UPPER_BODY`
  production Pose route. Physical validation remains pending. Detailed record:
  [Batch C1 — Tennis](./PHASE_BATCH_C1_TENNIS.md).

### Batch C2 — Badminton

**Game:** Badminton

**State:** `ENGINEERING PASS`; `PHYSICAL QA PENDING`

**Primary model:** Luna Max

- Framing: `UPPER_BODY`.
- Reuse Batch C0.
- Differentiate it from Tennis through a shuttle arc, faster exchange rhythm,
  overhead/lateral target regions, and arcade rally pacing.
- Delivered: deterministic 3-second/60-second seeded CLEAR/DRIVE/DROP shuttle
  course with four visual target regions, forgiving symmetric contact grades,
  bilateral sequence-safe Sports Motion Session consumption, bounded
  vector/intensity return presentation, optional Smash bonus, rally scoring,
  Developer Test Mode, and explicit-permission `UPPER_BODY` production Pose
  route. Physical validation remains pending. Detailed record:
  [Batch C2 — Badminton](./PHASE_BATCH_C2_BADMINTON.md).

### Batch C3 — Bowling

**Game:** Bowling

**State:** `ENGINEERING PASS`; `PHYSICAL QA PENDING`

**Primary model:** Luna Max

- Framing: `UPPER_BODY`; lower-body tracking is not required.
- Input: the existing C0 Sports Motion Toolkit. One newer game-local swing
  attempt is one arcade release; no shared RELEASE event was added.
- Delivered: deterministic five-frame arcade match, 2,500 ms aim sweep,
  deterministic ten-pin resolver, exact ball/settling/transition timing,
  bilateral sequence-safe Session, explicit-permission production route,
  Developer Test Mode, and projector-readable procedural Phaser lane.
- Engineering conclusion: C0 `SportsSwingEvent` is sufficient to power this
  engineering release contract. Physical release recognition remains pending;
  no physical PASS is claimed. Detailed record:
  [Batch C3 — Bowling](./PHASE_BATCH_C3_BOWLING.md).

### Batch D0 — Locomotion Toolkit

**Type:** shared foundation; not a game

**State:** `ENGINEERING PASS`; `PHYSICAL QA PENDING`

**Primary model:** Terra High

Investigate reusable normalized data for:

- running-in-place cadence;
- alternating knee/leg rhythm;
- speed/intensity;
- the existing `JUMP` action, kept separate from locomotion.

The contract must be compact-space friendly and must not expose raw landmarks
to games. Delivered: immutable anatomical alternating-step events, bounded
cadence/intensity, knees-only readiness, stale/lifecycle safety, a camera-free
test provider, and one existing Pose inference path. Physical cadence/running
validation remains pending. Detailed record:
[Batch D0 — Locomotion Toolkit](./PHASE_BATCH_D0_LOCOMOTION_TOOLKIT.md).

### Batch D1 — Running Race

**Game:** Running Race

**State:** `ENGINEERING PASS`; `PHYSICAL QA PENDING`

**Primary model:** Luna Max

- Framing: `FULL_BODY` + `KNEES` where possible.
- Input: normalized running cadence/intensity from Batch D0.
- Player movement: running in place; no physical travel across the room.
- Goals: race against characters/opponents, speed meter, short sprint and
  endurance variants, and strong finish feedback.
- Delivered: deterministic 3-second/60-second four-runner arcade race with
  START/PACE/CHASE/FINAL_SPRINT phases, bounded intensity-to-progress mapping,
  deterministic STEADY/BURST/FINISHER AI, stable rank/overtake events, score and
  result screen, sequence-safe D0 Session consumption, Developer Test Mode, and
  explicit-permission `FULL_BODY` + `KNEES` production Pose route. Physical
  cadence/running recognition remains pending. Detailed record: [Batch D1 —
  Running Race](./PHASE_BATCH_D1_RUNNING_RACE.md).

### Batch D2 — Swimming

**Game:** Swimming

**State:** `ENGINEERING PASS`; `PHYSICAL QA PENDING`

**First-game design model:** Sol High

**Subsequent implementation/tuning:** Luna Max

- Framing: `UPPER_BODY`.
- Input: normalized alternating left/right arm-stroke pattern.
- Player movement: standing simulation, never real swimming.
- Goals: alternating strokes propel the swimmer, bilateral movement, lane race,
  short rounds, and optional stroke-inspired patterns later.
- Engineering result: existing C0 LEFT/RIGHT `SportsSwingEvent` output was
  sufficient. A game-local Session/cycle adapter enforces alternation, derives
  bounded rhythm/intensity propulsion, and preserves retained-event safety; no
  new shared arm-cycle detector was required. Production reuses the single Pose
  pipeline with explicit `UPPER_BODY` camera setup. Physical standing arm-cycle
  recognition remains pending. Detailed record: [Batch D2 — Swimming](./PHASE_BATCH_D2_SWIMMING.md).

### Batch D3 — High Jump

**Game:** High Jump

**State:** `ENGINEERING PASS`; `PHYSICAL QA PENDING`

**Primary model:** Luna Max

- Framing: `FULL_BODY STRICT`.
- Input: existing `JUMP`.
- Goals: Core-owned takeoff timing, five fictional bar levels, exaggerated
  flight presentation, deterministic grading, and safe small-space play.
- Engineering result: valid JUMP is a binary timing occurrence; physical JUMP
  magnitude is ignored. Existing JUMP detection and Pose thresholds are
  unchanged. Production uses explicit `FULL_BODY` `STRICT` readiness because
  JUMP still requires ankles. Physical jump-timing recognition remains
  pending. Detailed record: [Batch D3 — High Jump](./PHASE_BATCH_D3_HIGH_JUMP.md).
- Safety: the game encourages a small comfortable jump and never rewards
  maximum effort or jump height.

### Batch D4 — Long Jump Challenge

**Game:** Long Jump Challenge

**State:** `ENGINEERING PASS`; `PHYSICAL QA PENDING`

**Primary model:** Luna Max

- Framing: `FULL_BODY STRICT`.
- Inputs: running-in-place/charge from Batch D0 plus vertical `JUMP`.
- Goals: charge meter, takeoff timing, exaggerated avatar long-jump animation,
  and fictional arcade distance.
- Safety: never ask the player to leap forward toward the phone. The fictional
  game distance is not a real biomechanical distance claim.
- Delivered: deterministic three-attempt in-place charge and takeoff game,
  exact D0-intensity charge formula, fictional timing-weighted distance,
  sequence-safe dual-source Session, explicit `FULL_BODY` `STRICT` production
  route, camera-free Developer Test Mode, and projector-readable procedural
  runway. JUMP magnitude is ignored; physical jump timing and D0 locomotion
  recognition remain pending. Detailed record: [Batch D4 — Long Jump
  Challenge](./PHASE_BATCH_D4_LONG_JUMP.md).

### Batch E — Baseball

**Game:** Baseball — Batting

**State:** `ENGINEERING PASS`; `PHYSICAL QA PENDING`

**Primary model:** Sol High

- Framing: `UPPER_BODY`.
- Input: Sports Motion Toolkit swing from Batch C0.
- Goals: readable pitch trajectory, timing window, contact quality, hit
  direction/distance, home-run presentation, and multiple pitch patterns.
- Boundary: batting comes first. Do not implement pitching first unless a
  clearly reusable need is established.
- Delivered: deterministic 3-second countdown and 60-second batting round;
  seeded FASTBALL/CURVEBALL/CHANGEUP schedule; HIGH/CENTER/LOW visual targets;
  exact timing grades; bounded game-local power, field, launch, and arcade hit
  results; full scoring/statistics; retained-event-safe C0 Session; camera-free
  Developer Test Mode; explicit `UPPER_BODY` production route; procedural
  stadium and HOME RUN RUSH presentation; result and same-seed replay.
- Safety/status: no physical bat is required or encouraged, no real bat-speed
  or power claim is made, and no new detector or threshold was added. Physical
  swing timing, iPhone Safari, compact-space, fatigue, and projector QA remain
  pending. Detailed record: [Batch E — Baseball](./PHASE_BATCH_E_BASEBALL.md).

### Batch F0 — Voice Input Foundation

**Type:** shared foundation; not a game

**State:** `PLANNED`

**Primary model:** Terra High; use Astra only if architecture, browser
compatibility, or signal-processing difficulty justifies escalation

Build a shared microphone architecture with explicit permission and no
recording, persistence, or transcription. Normalized outputs should consider:

- `VOICE_VOLUME` in `0..1`;
- `VOICE_PITCH` in `0..1` only if technically reliable enough;
- optional discrete derived events above the raw audio layer.

Lifecycle requirements are explicit start, deterministic stop/dispose,
page/background cleanup, and no microphone activity in games that do not
request it. Reconcile the final public name with the existing normalized
`VOICE_LEVEL` contract rather than creating duplicate volume semantics.

### Batch F1 — Vocal Hop

**Game:** Vocal Hop

**State:** `PLANNED`

**Primary model:** Luna Max

- Input: normalized voice volume; normalized pitch is optional.
- Goals: volume controls jump/lift, pitch affects direction or bonus only if it
  proves reliable, and live feedback remains highly visible.
- Boundary: no speech recognition.

### Batch F2 — Sound Cannon / 音波砲

**Game:** Sound Cannon / 音波砲

**State:** `PLANNED`

**Primary model:** Luna Max

- Input: normalized voice volume.
- Goals: loudness-driven charge/fire, clear volume meter, targets/waves, party
  presentation, and safe gain normalization.

### Batch G0 — Multiplayer Foundation

**Type:** shared foundation; not a game

**State:** `PLANNED`

**Primary model:** Astra

Begin only after multiple single-player games are stable. Research and
implement multi-person Pose identity, normalized player routing, camera
framing, performance, overlap/crossing behavior, and fallback turn-based/team
modes. This is explicitly one of the few tasks worthy of Astra.

### Batch G1 — Two-Player Dodge Duel

**Game:** Two-Player Dodge Duel

**State:** `PLANNED`

**Primary model:** Luna Max after Batch G0 is stable

- Inputs: normalized MOVE / LEAN / SQUAT routed per player.
- Goal: a simple, visually readable dodge battle.

## 5. Implementation batch order

The canonical implementation order is:

1. Freeze Balloon Rally and Reaction Arena at `PHYSICAL QA PENDING`.
2. Batch A — Runner / Avatar Action.
3. Batch B — Rhythm Motion.
4. Batch C0 — Sports Motion Toolkit.
5. Batch C1 — Tennis.
6. Batch C2 — Badminton.
7. Batch C3 — Bowling.
8. Batch D0 — Locomotion Toolkit.
9. Batch D1 — Running Race.
10. Batch D2 — Swimming.
11. Batch D3 — High Jump.
12. Batch D4 — Long Jump Challenge.
13. Batch E — Baseball batting.
14. Batch F0 — Voice Input Foundation.
15. Batch F1 — Vocal Hop.
16. Batch F2 — Sound Cannon.
17. Batch G0 — Multiplayer Foundation, only after multiple stable
    single-player games exist.
18. Batch G1 — Two-Player Dodge Duel.
19. Portfolio-wide physical QA sweep.
20. Production polish and production-readiness promotion game by game.

This order does not require physical tuning of each earlier game before the
next engineering batch begins. It does require each game's software boundary
and tests to be stable enough to avoid knowingly carrying regressions forward.

## 6. Shared foundation dependency map

| Shared foundation | Required consumers | Notes |
|---|---|---|
| Existing normalized Motion Actions + Pose runtime | Runner, Rhythm Motion, High Jump | No new shared detector is planned for their initial versions. |
| C0 Sports Motion Toolkit | Tennis, Badminton, Bowling, Swimming, Baseball | Reuses canonical spatial-wrist concepts and supplies broad body-relative swing, vector, and bounded-intensity output. Bowling demonstrates that one swing event is sufficient for the engineering release contract, and Swimming demonstrates that game-local bilateral alternation is sufficient for the engineering arm-cycle contract. `RELEASE` and a shared arm-cycle detector remain deferred because physical validation is pending. |
| D0 Locomotion Toolkit | Running Race, Long Jump Challenge | Running-in-place cadence/intensity is shared; Long Jump also uses existing JUMP. |
| Game-local alternating arm cycle | Swimming | Existing C0 LEFT/RIGHT swing events proved sufficient for the engineering contract; alternation and propulsion remain game-local outside Core, with no new shared detector. |
| F0 Voice Input Foundation | Vocal Hop, Sound Cannon | Microphone is opt-in and active only for requesting games. |
| G0 Multiplayer Foundation | Two-Player Dodge Duel | Multi-person identity/routing must be stable before simultaneous play. |

## 7. Model allocation policy

### Luna Max

Use for bounded game implementations, UI/presentation, content, tests, SFX
wiring, and second/third games built from an established template.

### Terra High

Use for shared runtime, normalized sensor contracts, cross-game architecture,
and medium/high-complexity technical foundations.

### Sol High

Use for the first game of a new family, complex gameplay/system design,
difficult game feel, portfolio architecture, and Art Direction / cross-game
visual-system planning.

### Astra

Use sparingly, only for genuinely difficult cross-layer architecture,
multiplayer tracking/identity, severe shared-runtime bugs, large technical
migration, or an architecture audit when other models are insufficient.

Do not use Astra for ordinary UI, tests, game registration, CSS, copy changes,
or simple Game Core work.

## 8. Engineering Prototype PASS contract

Every game built during Batch Build Mode must satisfy all of the following
before receiving `ENGINEERING PASS`:

- registered and launchable from Home;
- mobile-landscape-first layout;
- projector-readable presentation;
- pure deterministic Game Core where appropriate;
- Session/input adapter between normalized input and Core;
- Developer Test Mode that requires no real sensors;
- production sensor route when its required shared foundation exists;
- complete countdown/start/play/result/replay lifecycle;
- clear success feedback;
- no raw sensor data in Game Core;
- no automatic permission prompt;
- no microphone unless the game requests it;
- deterministic tests;
- typecheck PASS;
- lint PASS;
- tests PASS;
- build PASS;
- `git diff --check` PASS.

Physical recognition quality is not required for `ENGINEERING PASS`. After the
contract is met, a game awaiting device testing is recorded as
`PHYSICAL QA PENDING`.

## 9. Art policy

- Sol High is the Art Director and plans game-family/cross-game visual systems.
- The image-generation model creates actual game assets.
- Astra is reserved for a large cross-game art/asset architecture problem.
- Do not generate premium final art before the interaction loop is stable.
- Placeholder, procedural, or simple vector presentation is acceptable for
  `ENGINEERING PASS` when it remains readable and communicates the interaction.

## 10. Physical QA sweep

After the portfolio Engineering Prototype phase, execute a systematic matrix
for every game:

| Game | Action/input | Windows Chrome | iPhone Safari landscape | Compact space | Projector |
|---|---|---|---|---|---|
| Every formal portfolio game | Every required and optional production input | Pending | Pending | Pending | Pending |

Expand the matrix into individual game × action/input rows when the physical QA
sweep begins. For each row evaluate:

- setup/readiness;
- recognition;
- false positives;
- false negatives;
- timing;
- fatigue;
- readability;
- game feel;
- audio;
- recovery;
- lifecycle cleanup.

Tune shared thresholds only after cross-game evidence is available. A threshold
change that affects multiple games belongs to a named shared-foundation tuning
batch and must be regression-tested against every known consumer.

## 11. Production promotion rule

After physical evidence is recorded, promote a game from `PHYSICAL QA PENDING`
to `PHYSICAL PASS`. Then record `PRODUCTION POLISH PENDING` while final art,
audio, content, and presentation work remains. Use `PRODUCTION READY` only when
engineering, physical QA, production polish, lifecycle, and release-facing
checks are all complete.
