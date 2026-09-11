# Motion Arcade — Master Implementation Plan

Updated: 2026-09-11

This is the canonical implementation roadmap for Motion Arcade. It defines what the product is trying to become, what must remain true across phases, and the order in which major capabilities and games should be matured. `CURRENT_PHASE.md` is the short live checkpoint; this file is the longer-term plan.

## 1. Product goal

Motion Arcade is a stable, polished body-motion entertainment platform that turns a smartphone into the primary sensor and game device.

Primary operating model:

- smartphone held or mounted in **landscape orientation**;
- **front camera** detects body movement;
- **phone microphone** detects voice/audio input for voice-enabled games;
- the phone/browser output is commonly mirrored or connected to a **projector / large display**;
- participants usually interact from a distance, so the UI must remain understandable without reading small text;
- games should create both **physical activity** and **entertainment value**, rather than feeling like calibration tests or technology demonstrations.

The platform should eventually support multiple game families while sharing one reliable sensor/runtime foundation.

## 2. Non-negotiable product constraints

### 2.1 Mobile landscape first

All production gameplay must be designed for phone landscape first, not desktop first and then shrunk later.

Required considerations:

- iPhone Safari landscape viewport behavior;
- safe-area insets / Dynamic Island / browser chrome;
- 16:9 logical playfield with graceful FIT behavior;
- large touch targets for operator actions;
- no critical control near unsafe screen edges;
- no important instruction that depends on small text;
- no document scrolling during active gameplay;
- orientation/layout must remain usable on a projected large screen.

Desktop Chrome remains an important development and validation environment, but not the primary presentation target.

### 2.2 Front camera is part of presentation, not only sensing

The camera is not merely a hidden detector. In camera-based games it should help players understand where their body is and, where appropriate, become part of the game presentation.

Rules:

- camera acquisition still requires explicit user action;
- setup/baselining should show a clear **mirrored** front-camera preview;
- mirrored preview is display-only; canonical body semantics must not change;
- framing guidance must make the required body region obvious;
- do not require head-to-foot framing when a game's actual input only requires upper-body/arm interaction;
- Camera AR gameplay should keep the player clearly visible; visual treatment may improve game-object contrast but should not make the person feel like a dark diagnostic background;
- games may use a Camera AR presentation where Phaser visuals are layered over the mirrored live preview;
- camera presentation must never introduce recording or persistence by default.

### 2.2.1 Game-specific framing requirements

Framing is a gameplay requirement, not a platform-wide full-body rule.

Initial planned requirements:

- `FULL_BODY`: use when the game needs lower-body or whole-body information such as JUMP, SQUAT, running, lane movement, leg interaction, or reliable whole-body position;
- `UPPER_BODY`: use when the game is driven by hands, arms, reach, upper-body lean, or voice and knees/ankles do not contribute to the rules.

The selected game's framing requirement should eventually control:

- which body region must be visible before gameplay is READY;
- which Pose tracking readiness is required;
- which framing guide Camera Presentation renders;
- setup/recovery instruction text;
- the minimum sensible player-to-camera distance.

Do not add more framing categories until real games demonstrate a need. Balloon Rally is a strong candidate for `UPPER_BODY` after spatial-hand interaction is validated; Runner remains a clear `FULL_BODY` case.

### 2.3 Projector readability

Every production game should be playable when viewed several meters away on a projector.

Prefer:

- large central state changes;
- strong silhouette and motion cues;
- large scores/timers;
- minimal persistent text;
- obvious success/failure feedback;
- visual feedback that can be understood without looking at the phone closely.

### 2.4 Exercise + entertainment

Games should encourage repeated, meaningful movement while remaining playful.

Design priorities:

- immediate feedback after a valid action;
- bilateral movement where the game concept supports it;
- short understandable rules;
- escalating but bounded challenge;
- enough variation to avoid becoming a repetitive reaction drill;
- adaptive profiles should eventually let the same game remain usable with different motion ranges or postures;
- avoid requiring unnecessary precision when broad movement is the actual goal.

Do not make medical or therapeutic efficacy claims as part of normal game logic.

## 3. Technical maturity principles

### 3.1 Keep sensors out of games

Production games should consume only normalized game-facing contracts.

Current action path:

`Front Camera -> Pose Sensor -> Pose Feature Extraction -> Motion Analyzer -> Normalized Motion Actions -> Game Core`

Future spatial path:

`Front Camera -> Pose Sensor -> Canonicalized spatial features -> Normalized Spatial Interaction -> Game Core / collision adapter`

Future voice path:

`Phone Microphone -> Audio analysis -> Normalized Voice channels/actions -> Game Core`

Games must not import raw MediaPipe landmarks, `MediaStream`, camera APIs, or Web Audio implementation details.

### 3.2 Lifecycle reliability before content scale

Any real-sensor game must preserve:

- explicit permission/start;
- readable startup failure;
- no duplicate camera/microphone pipeline;
- deterministic stop/dispose;
- background/pagehide cleanup;
- recovery from tracking loss without silently advancing gameplay;
- test-provider path without physical sensors.

### 3.3 Visual and sensor cadence stay separate

Phaser/rendering may run at display cadence while Pose/audio inference uses its own bounded cadence. Do not tie rendering smoothness to sensor inference rate.

### 3.4 Legacy projects are design references, not architecture sources

The previous projects contain valuable gameplay ideas, but their direct sensor/game coupling should not be transplanted into the new project.

Reuse:

- gameplay loops;
- scoring ideas;
- progression patterns;
- collision concepts;
- visual/game-feel concepts.

Rebuild through current contracts/runtime rather than copying legacy MediaPipe/MoveNet/WebAudio game logic directly.

## 4. Legacy concept migration map

### 4.1 廚房大師 AR

High-value concepts:

- live Camera AR presentation;
- hand-position interaction with screen-space objects;
- swept/interpolated hand-path collision for fast movement;
- multi-hit objects with HP;
- hit score + destruction bonus;
- special objects / warning objects / boss-style escalation;
- final-rush pacing.

Primary destination:

- Balloon Rally spatial interaction foundation;
- later Camera AR slicing/hitting games.

### 4.2 舊版 Motion Arcade / 體感遊戲大全

High-value concepts:

- reaction challenge;
- runner / lane switching;
- rhythm left/right interaction;
- ball rally / rebound physics;
- voice cannon;
- multi-target floating objects and special targets.

Primary destination:

- second/third production games and later voice/rhythm phases.

### 4.3 磚塊衝刺

High-value concepts:

- three-lane runner structure;
- increasing speed/obstacle density;
- simple readable avatar;
- action-driven animation for MOVE/JUMP/SQUAT.

Primary destination:

- future runner game;
- first Avatar presentation should be action-driven before attempting full landmark retargeting.

### 4.4 Vocal Hop

High-value concepts:

- voice as a continuous control source, not only binary commands;
- volume and pitch controlling different gameplay dimensions;
- voice-controlled jumping/flying/launching.

Primary destination:

- future Voice Input foundation;
- normalized continuous `VOICE_VOLUME` / `VOICE_PITCH` style channels in addition to discrete events where useful.

## 5. Current game strategy — mature Balloon Pop into Balloon Rally

The existing Balloon Pop vertical slice successfully proved the basic game architecture, but the one-target LEFT/RIGHT loop is intentionally temporary.

The production direction is **Camera AR + Spatial Hand Interaction + Arcade Balloon Physics**.

Target experience:

1. player enters the game;
2. player explicitly starts the front camera;
3. mirrored preview helps positioning and readiness using the body region the game actually requires;
4. the player remains clearly visible during gameplay as part of the AR presentation;
5. multiple balloons float around the player;
6. the player's hand spatially contacts balloons rather than merely triggering a left/right event;
7. each valid separated contact scores and pushes the balloon naturally;
8. repeated contacts eventually pop the balloon and award a bonus;
9. difficulty grows across the 60-second round;
10. the final seconds provide a clear party-rush climax.

Physics should feel natural but remain arcade-controlled: bounded speed, anti-corner recovery, playable spawn regions, and stable collision behavior are more important than physically accurate balloon simulation.

## 6. Ordered implementation roadmap

### Foundation — Phase 1A through 1D

Status: largely complete.

Delivered:

- normalized Motion Input contract;
- permanent Developer Test Mode;
- real camera + MediaPipe Pose pipeline;
- Motion Analyzer for MOVE / LEAN / REACH / SQUAT / JUMP;
- calibration and bounded adaptive profiles;
- LOW_MOTION / SLOW_RESPONSE engineering support;
- SEATED / UPPER_BODY engineering support;
- privacy/lifecycle boundaries.

Deferred physical validation remains for some adaptive modes.

### Phase 2A.1 — Playable Balloon Pop vertical slice

Status: PASS.

Purpose:

- prove Game Core / Phaser / registry / session / test-provider integration.

### Phase 2A.2a — Production real-Pose gameplay path

Status: Engineering PASS; physical validation exposed camera-presentation UX as the next blocker.

Purpose:

- production route;
- explicit camera start;
- readiness gating;
- tracking-loss pause;
- lifecycle cleanup.

### Phase 2A.2b — Camera Presentation Layer

**Status: Engineering PASS; Windows/iPhone functional physical checks PASS; brighter-AR retest and projector validation pending.**

Goals:

- show a large/full-screen mirrored camera view during setup/baselining;
- add clear framing/safe-body guide and READY feedback;
- keep camera visible and clearly recognizable in gameplay through a deliberate Camera AR composition;
- preserve large-projector readability;
- define reusable camera-presentation behavior instead of a one-off Balloon Pop CSS hack.

Presentation direction:

- setup: camera is dominant and close to natural live-image brightness;
- gameplay: mirrored camera remains a clearly visible background with only enough treatment to keep game objects/HUD readable;
- tracking lost: freeze game and make recovery/framing guidance dominant;
- results: camera may remain dimmed behind the result card.

Implemented boundary refinement:

- shared DOM `CameraPresentationStage` + pure presentation-state resolver;
- one runtime-bound video reused across setup, play, tracking recovery, and result;
- CSS-only display mirroring and `object-fit: contain` framing;
- transparent `1280 × 720` Phaser Camera AR presentation above the video while the development/test presentation remains opaque;
- camera dominance changes by lifecycle state without changing sensor ownership, analyzer semantics, or Game Core time;
- gameplay camera brightness/saturation increased after Windows/iPhone physical feedback so the player remains visually present in the AR scene.

### Phase 2A.3 — Normalized Spatial Hand Interaction

Goal: enable true screen-space body interaction without exposing raw landmarks to games.

Introduce a minimal game-facing spatial interaction contract for at least:

- anatomical left hand position;
- anatomical right hand position;
- canonical normalized screen/world coordinates;
- confidence/freshness/availability sufficient for safe interaction;
- previous/current sample or equivalent motion segment needed for swept collision.

Requirements:

- mirror display must not alter canonical/anatomical coordinates;
- map canonical spatial points into the actual displayed `object-fit: contain` video rectangle, including letterbox/pillarbox offsets;
- keep display mirroring separate from source-coordinate semantics while still making AR collision visually line up with the mirrored player;
- no raw landmark arrays in Game Core;
- stale/low-confidence spatial pointers become unavailable/neutral;
- tests for coordinate semantics, presentation mapping, and fast-motion swept collision;
- introduce the minimum shared game framing requirement needed for `FULL_BODY` versus `UPPER_BODY` readiness/guidance;
- preserve existing STANDARD behavior unless the game explicitly opts into a different framing requirement;
- do not expand to full Hands model unless Pose wrists are proven insufficient.

### Phase 2A.4 — Balloon Rally gameplay rewrite

Replace the temporary single-target loop with the first mature Camera AR game.

Status: Balloon Rally v3 engineering implementation complete; physical
Windows/iPhone and projector validation remain required.

Initial rules:

- 60-second round;
- WARM UP/RALLY/FEVER population of 2/3/4 standard balloons at 0/15/35 seconds;
- balloons continuously float and rebound inside a controlled playable region;
- valid hand contact: `+1` and applies an arcade impulse;
- sustained overlap cannot farm score; separation/new contact is required;
- standard balloon target: 2 valid hits before pop, with Combo rewarding
  continuous activity;
- pop grants an additional bonus;
- final 10 seconds: PARTY RUSH with five 1-hit Party balloons, fast replacement,
  and a visibly distinct cue;
- no arbitrary 2.5-second disappearance for ordinary balloons.

The v3 content expansion keeps the stable interaction foundation and adds only
positive reward variety: seeded Golden and Giant targets, one short seeded
mini-event (Golden Rush, Balloon Rain, or Score Fever), bounded FLOAT/DRIFT/
BOUNCE movement personalities, Combo milestone presentation, and a cosmetic
logical-hand glow trail. Hazards, penalties, audio architecture, and premium
art remain deferred.

### Phase 2A.5 — Balloon Rally game feel + production validation

Polish only after spatial interaction works reliably.

Add selectively:

- polished balloon art/materials;
- hit squash/stretch;
- pop particles;
- floating score;
- combo feedback if it improves behavior;
- audio/haptics where platform permits;
- countdown/result polish;
- final-rush presentation.

Validate:

- Windows Chrome real-person play;
- iPhone Safari landscape;
- front-camera mirror/anatomical correctness;
- per-game framing requirement at the intended camera distance;
- phone thermal behavior over repeated rounds;
- projector readability;
- camera cleanup and background recovery;
- false/repeat hand contacts;
- STANDARD first, then adaptive profile batch testing.

### Phase 2B — Second production game: Reaction Challenge

Use the old 光速反應王 concept through normalized actions.

Candidate actions:

- MOVE/LEAN left/right;
- REACH left/right;
- SQUAT;
- JUMP where appropriate.

Goals:

- prove that the shared Motion Action contract can power a substantially different game without new detector logic;
- include configurable timing/difficulty rather than legacy ultra-fast fixed windows;
- large projected prompts and immediate success feedback.

### Phase 2C — Third production game: Runner / Avatar Action game

Use concepts from 磚塊衝刺 / Extreme Runner.

First Avatar direction:

- action-driven character animations;
- MOVE triggers lane change;
- JUMP triggers jump animation;
- SQUAT triggers duck animation;
- do not begin with full real-time landmark-to-avatar retargeting.

This phase validates a non-camera-AR presentation family.

### Phase 2D — Rhythm game exploration

Rebuild the left/right rhythm concept only after latency behavior is understood on real devices.

Focus:

- stable note timing;
- sensor-to-feedback latency;
- LEFT/RIGHT body actions;
- avoid premature complex music/chart tooling.

### Phase 3 — Voice Input foundation and voice games

Use phone microphone through an explicit, lifecycle-safe audio runtime.

Target capabilities:

- normalized voice volume 0..1;
- normalized pitch 0..1 where reliable;
- optional discrete loud/high/low events derived above the raw audio layer;
- no raw audio persistence or transcription requirement.

Candidate games:

- Vocal Hop style movement;
- voice cannon;
- jump/high-jump variants.

### Phase 4 — Expanded accessibility and multiplayer

Only after several single-player games are stable:

- formal gameplay selection for LOW_MOTION / SLOW_RESPONSE / SEATED / UPPER_BODY;
- LEFT_SIDE / RIGHT_SIDE if real game needs justify them;
- multi-person tracking research;
- team/turn-based modes that do not require simultaneous multi-person tracking where possible.

## 7. Visual quality roadmap

The new platform should materially exceed the legacy prototypes in visual maturity.

Visual direction remains Premium Active Playground / modern sports entertainment rather than preschool, rehab software, or generic SaaS.

Priorities:

1. readable composition and responsive landscape layout;
2. strong gameplay feedback;
3. cohesive typography/material language;
4. animation/particles/audio that explain interactions;
5. polished game-specific art after interaction is stable.

Do not spend major art effort before a game's input/physics loop passes real-device validation.

## 8. Definition of done for a production game

A game is not considered mature merely because it runs in desktop dev mode.

Minimum production gates:

- Game Core deterministic and tested;
- no raw sensor dependency in game rules;
- production sensor path works through normalized contracts;
- explicit permission lifecycle;
- tracking loss / error / cleanup behavior verified;
- the game's declared body-framing requirement is appropriate and physically validated;
- iPhone Safari landscape physically tested;
- projected large-screen readability physically checked;
- no active-play document overflow;
- meaningful game feedback and complete round/result/replay flow;
- sustained play does not reveal unacceptable false positives or repeat triggers;
- performance/thermal behavior is acceptable for repeated short rounds;
- accessibility profile claims are only marked PASS after real testing.

## 9. Decision rule for future features

Before adding a new sensor capability, ask:

1. Does a planned game actually need it?
2. Can an existing normalized action/spatial/voice contract solve the gameplay need?
3. Can the capability be implemented once as shared runtime rather than inside a game?
4. Has the preceding playable phase been physically validated enough to justify expansion?

Prefer finishing useful games over accumulating unused detector capabilities.
