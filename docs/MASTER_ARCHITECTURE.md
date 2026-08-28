# Motion Arcade — Master Architecture

Status: Phase 0 architecture freeze draft  
Date: 2026-08-28  
Target: iPhone Safari landscape first

This document freezes the boundaries needed to begin Phase 1. It does not freeze game rules, detection thresholds, visual direction, or a four-person tracking promise.

## 1. Product constraints

- The primary setting is a therapist-led psychiatric occupational-therapy group of about 12 participants, usually 18–60+ years old, in a roughly 60-minute session.
- One therapist operates a landscape phone fixed to a tripod. The phone uses its front camera and microphone and mirrors its display to a projector. Participants do not hold the phone.
- Body motion, hand motion, and live audio signal measurements are possible inputs.
- The first release must support one to four teams. Team count is a session/gameplay concern and is independent of how many bodies are tracked simultaneously.
- The product must support solo versus CPU, two-player formats, and one-to-four-team formats. A team may be represented by one current participant, alternating participants, or aggregated actions.
- The first release is not required to track four people simultaneously. Multi-pose capacity remains a performance-gated capability.
- Accessibility is expressed as capabilities and control adaptations, never as psychiatric or medical diagnoses in gameplay code.

## 2. Browser and mobile constraints

- Logical game viewport: `1280 × 720` (16:9).
- Phaser scale mode: `FIT`, centered. Letterboxing is acceptable; cropping gameplay is not.
- The document uses `viewport-fit=cover`, dynamic viewport units, and `env(safe-area-inset-*)`. Critical DOM HUD controls live inside the computed safe region.
- Safari browser chrome can change the visual viewport while a session is running. Layout must tolerate `resize`, `orientationchange`, and `visualViewport` changes without resetting game state.
- Camera and microphone requests require HTTPS (localhost is acceptable for development), an explicit therapist action, clear denied/unavailable states, and track cleanup on stop.
- The front camera is requested with `facingMode: "user"` as a preference, not an exact constraint. The camera video element uses `autoplay`, `muted`, and `playsinline`; iOS WebKit can otherwise stall on the first frame.
- Audio context creation/resume is tied to a therapist gesture. It must be suspended or closed when not required.
- Browser feature support is capability-detected. A worker path or GPU delegate is an optimization, not a universal assumption.

## 3. Privacy constraints

Hard rules:

- Camera frames remain in the browser process. No frame upload, video recording, screenshots of patients, face storage, Vercel Function processing, or identity recognition.
- Microphone input is never recorded or transcribed. Only ephemeral real-time features such as level, pitch estimate, and sustained-duration are emitted.
- No patient account or patient-name field exists by default.
- Raw sensor frames and landmarks are not persisted. Debug logging must exclude frames, audio samples, landmarks, device labels, and stable person identifiers.
- Session/player identifiers are short-lived random identifiers. Any future persistence requires a separate privacy and clinical-governance review.
- Sensor tracks are stopped immediately when leaving a game, switching to test input, or ending a session.

The initial Vercel deployment is static. It has no backend, database, upload endpoint, analytics payload containing sensor data, or AI API.

## 4. React / Phaser boundary

React/DOM owns:

- application shell, home/category browsing, game selection, therapist controls, permission onboarding, settings, accessibility, and text-heavy HUD/overlays;
- session orchestration and provider selection;
- creation and destruction of the Phaser instance.

Phaser owns:

- 2D playfield rendering, cameras, animation playback, visual effects, and scene orchestration;
- a disposable projection of simulation state.

Framework-independent game core owns rules, scoring, timers, progression, and serializable simulation state. Phaser scenes must stay thin and must not become the source of truth. A scene reads a game-state snapshot and normalized motion frame through a bridge, then emits game commands. React never mutates Phaser display objects directly.

```text
React shell / therapist UI
          │ lifecycle + session configuration
          ▼
Game Runtime Coordinator ─── Normalized Motion Frames
          │                         │
          ├── Game Core / simulation│
          │                         │
          └── Phaser adapter ◄──────┘
                    │
                    ▼
             Phaser scenes/view
```

## 5. Sensor architecture

```text
Game Registry sensor requirements
                  │
                  ▼
           Sensor Manager
       ┌──────────┼──────────┐
       ▼          ▼          ▼
    Camera     Microphone   Test/Replay
       │          │          │
       ▼          ▼          │
Pose/Hand Tasks  Web Audio   │
       └──────┬───┘          │
              ▼              │
       Motion Analysis ◄─────┘
              │
              ▼
      Normalized Action Frame
```

`SensorManager` is the sole owner of real sensor acquisition and task lifecycle. It receives the selected game's declarative `sensorRequirements` and starts only what the game needs. Pose, hands, gesture recognition, and audio must never run permanently together across all games.

Responsibilities:

- permission request and human-readable failure state;
- local `MediaStreamTrack` ownership and cleanup;
- lazy loading of MediaPipe WASM/model assets;
- coordinating the inference scheduler and quality manager;
- publishing raw observations only to motion-analysis modules, never to games;
- reporting coarse health/capability status without exposing raw media.

## 6. Motion Action architecture

Games must not import MediaPipe, `MediaStream`, Web Audio nodes, DOM keyboard/mouse events, or raw landmarks. The only gameplay input is the normalized contract in [MOTION_INPUT_CONTRACT_DRAFT.md](./MOTION_INPUT_CONTRACT_DRAFT.md).

Pipeline:

```text
physical/test device event
  → provider observation
  → calibration + feature extraction
  → analyzer / temporal state machine
  → ability-profile transform
  → normalized action frame
  → game core
```

Motion actions carry monotonic timestamps, player identity, active/value semantics, confidence/quality, and freshness. Render FPS does not change action timestamps. Edge actions such as `JUMP` or `CLAP` have explicit pulse/hold semantics so a lower inference rate cannot accidentally retrigger them every render frame.

## 7. Team architecture concept

The following concepts are separate types:

- `TeamId`: one of one to four configured teams.
- `PlayerId`: a logical participant/control channel for the current game.
- `SensorTrackId`: a currently tracked body/hand/audio source.
- `TeamMembership`: maps logical players to teams for the current round.

A game declares `supportedTeams` separately from `simultaneousPlayers`. For example, a four-team relay can support four teams while requiring only one tracked body at a time. Team modes may later include `simultaneous`, `relay`, `turnBased`, and `sharedScore`, but each game's accepted modes are registry data rather than assumptions in the global shell.

No architecture code equates `teamCount` with MediaPipe `numPoses`.

## 8. Adaptive control architecture

Named starting profiles:

- `STANDARD`
- `LOW_MOTION`
- `SEATED`
- `UPPER_BODY`
- `LEFT_SIDE`
- `RIGHT_SIDE`
- `SLOW_RESPONSE`

Profiles are presets over neutral capability settings, such as action threshold, required range, hold duration, cooldown, debounce window, reaction window, input-side remapping, and unavailable-action fallback. A therapist may adjust a preset per session without changing the game implementation.

Rules:

- Core gameplay never contains diagnosis names.
- Games declare compatible profiles and required action capabilities.
- The mapping layer may transform an observed movement into the same game action with a smaller range or longer window.
- Side-specific profiles do not silently mirror game visuals; side mapping is explicit and testable.
- Adaptive parameters are session configuration and remain local unless a later product decision adds approved persistence.

## 9. Game Registry architecture

Every game is registered declaratively. `App.tsx` must not accumulate a hard-coded game catalog.

```ts
interface GameRegistration {
  id: string
  title: string
  description: string
  category: string
  tags: readonly string[]
  inputTypes: readonly MotionInputType[]
  bodyAreas: readonly BodyArea[]
  activityLevel: ActivityLevel
  difficulty: DifficultyBand
  supportsSeated: boolean
  supportsSingleSide: boolean
  supportedTeams: readonly (1 | 2 | 3 | 4)[]
  simultaneousPlayers: { min: number; max: number }
  sensorRequirements: SensorRequirements
  supportedAbilityProfiles: readonly AbilityProfileId[]
  load: () => Promise<GameModule>
}
```

The registry provides metadata validation, unique-ID enforcement, shell discovery/filtering, compatibility checks, and lazy game module loading. `sensorRequirements` describes required and optional pose/hands/audio capabilities. It does not start them.

## 10. Input Providers & Developer Test Mode

Developer test mode is a permanent architecture capability, not a temporary keyboard hack.

All providers implement the same `MotionInputProvider` contract:

- `MediaPipeMotionInputProvider`: real camera/microphone pipelines.
- `KeyboardMouseTestInputProvider`: configurable desktop input with no permission request and no MediaPipe initialization.
- `ReplayMotionInputProvider`: future deterministic, timestamped action sequences.

Keyboard and pointer bindings belong inside the test provider. Individual games never listen to DOM keys or pointer events. The provider supports, at minimum, all movement, body, arm/sport, locomotion, hand, and voice actions in the contract. Continuous controls include run cadence, voice level, pitch, sustained voice duration, motion intensity, and optional pointer/hand position.

A future developer panel can select provider, simulated player count, ability profile, left/right side, continuous values, action triggers, reset, and a normalized-state overlay. The same overlay can inspect real provider output without revealing raw frames.

Production safety:

- `real` is the production default.
- Test input is available automatically in `import.meta.env.DEV`.
- A non-development build requires an explicit build-time `VITE_ENABLE_TEST_INPUT=true` gate before a query parameter or protected debug menu can select it.
- A normal production build ignores test-mode URL parameters and does not show test controls.
- Selecting test input must not request camera/microphone permissions or load MediaPipe code/models.

Acceptance target: a future Bowling, Runner, voice-controlled, badminton, party, or other game can run from test/replay input without changing that game's code.

## 11. Worker and performance strategy

Phaser rendering and MediaPipe inference use independent schedules.

- Phaser targets the display refresh rate and consumes the latest immutable motion frame.
- `InferenceScheduler` uses a configurable target rate and permits at most one in-flight inference per task. When inference is busy, intermediate camera frames are dropped rather than queued.
- `QualityManager` observes inference duration, render frame time, thermal symptoms, dropped frames, tracking quality, and visibility. It can reduce input resolution, inference rate, model complexity, active trackers, or optional features.
- The worker candidate uses transferable `ImageBitmap` frames and posts serializable landmark/results data back. Transferred bitmaps are closed after use.
- MediaPipe Web calls are synchronous and block their current thread. A worker is therefore preferred after a capability spike, but the architecture keeps a throttled main-thread fallback for Safari/device combinations where worker image transfer or GPU delegation is unreliable.
- Do not depend on `MediaStreamTrackProcessor`; its availability/context differs across browsers. `HTMLVideoElement → createImageBitmap()` is the conservative first worker bridge to validate.
- Models/WASM are version-pinned, same-origin where practical, lazy-loaded by sensor requirement, cached, and explicitly disposed.
- Audio level and a basic pitch estimator can begin with `AnalyserNode` time/frequency data. Move sustained low-latency processing to `AudioWorklet` only after profiling.

Phase 1 must measure one pose first. Four simultaneous poses remain a later quality tier, not a baseline promise.

## 12. Folder structure

```text
src/
  app/                         # React shell, routes, app composition
  components/                  # shared accessible DOM components
  design-system/               # tokens and primitives
  motion/
    contracts/                 # normalized action/provider types
    providers/                 # real, test, future replay providers
    sensors/
      camera/
      pose/
      hands/
      gestures/
      audio/
    calibration/
    analysis/                  # landmark/audio feature analyzers
    mapping/                   # features → normalized actions
    runtime/                   # SensorManager, scheduler, quality manager
    workers/
  game/
    core/                      # renderer-independent simulation contracts
    phaser/                    # Phaser boot, scenes, and adapters
    registry/
    teams/
    scoring/
    difficulty/
    adaptive/
  games/                       # lazy-loaded game modules; empty in Phase 0
  therapist/
    controls/
    presets/
    session/
    debug/                     # gated developer controls and overlay
  config/
  hooks/
  utils/
  types/
tests/
  unit/
  integration/
  browser/
  visual/
docs/
```

Changes from the proposed split:

- Added `motion/contracts` and `motion/providers` so normalized input and source implementations cannot collapse into sensor code.
- Grouped physical inputs beneath `motion/sensors`; `audio` is a sensor source even though it uses Web Audio instead of MediaPipe.
- Split `analysis` from `mapping`: feature extraction/temporal detection and adaptive action normalization have different tests and change rates.
- Added `motion/runtime` for lifecycle/performance policy and `therapist/debug` for the explicitly gated test panel.
- Kept game simulation in `game/core` and Phaser in `game/phaser`, following the renderer-disposable boundary.
- Tests are top-level by scope, while narrow unit tests may remain next to tiny modules when locality is clearer.

Phase 0 creates only folders needed by the scaffold. The rest are an agreed destination shape, not placeholder files.

## 13. Testing strategy

Unit:

- motion analyzers and temporal state machines;
- calibration and range normalization;
- action mapping, profile transforms, cooldowns, and freshness;
- game metadata validation and team/player distinctions;
- deterministic test/replay provider sequences.

Integration:

- sensor start/stop, permission failure, task lazy loading, and track disposal;
- game load/start/pause/stop and Phaser mount/unmount;
- provider switching without changing game code;
- registry requirements activating only required sensors.

Browser:

- iPhone Safari landscape, then iPad Safari, Android Chrome, and desktop Chrome;
- permissions, denied permission recovery, `playsinline`, resize/orientation, navigation, background/foreground, and projector-like aspect ratios;
- development mode starting with zero sensor permission prompts;
- console errors and WebGL context loss handling.

Visual:

- screenshot QA at representative landscape viewports;
- safe-area/notch simulation, overflow, letterboxing, DOM HUD obstruction, text size, and reduced motion.

Performance tests record render FPS separately from inference Hz and include long-session thermal/memory observations.

## 14. Deployment strategy

- Vite produces static assets in `dist`; Vercel detects the Vite framework and provides HTTPS, previews, and production deployment.
- No Vercel Functions are required for Phase 0 or local sensor processing.
- A future client-side router needs the documented SPA rewrite only when deep routes are introduced.
- MediaPipe WASM/model files should be pinned and served from the same deployment/CDN origin when feasible. Cache immutable versioned assets; do not use an unpinned `@latest` production URL.
- Permissions Policy should remain restrictive (`camera=(self)`, `microphone=(self)`) if headers are added. Never authorize unrelated origins.
- Preview deploys are for application QA. Real patient imagery must not be used in remote debugging artifacts or screenshots.

## 15. Technical risks

1. iPhone thermal pressure and memory can reduce sustained inference quality during a 60-minute session.
2. Worker + MediaPipe + GPU delegate behavior varies; workerizing does not guarantee that all result objects are transferable.
3. Multiple people may overlap or swap tracking identities. Team identity must not depend on unstable pose-array indices.
4. Camera framing, projector delay, room lighting, loose clothing, mobility aids, and seated posture can change detection reliability.
5. Pitch is not a direct Web Audio API output; the estimator and confidence/voicing gate require validation across voices and room noise.
6. Safari permission denial and audio-context suspension need therapist-friendly recovery without reloading a game.
7. Safe-area/browser-chrome behavior changes across iOS versions. Device testing remains mandatory.
8. Phaser and MediaPipe bundles/models can make first load slow; route and sensor lazy loading are required.
9. Clinical usability requires large text, low cognitive load, predictable recovery, and a therapist-controlled pause/reset path; technical success alone is insufficient.

## 16. Decisions intentionally deferred

- exact first game and its rules;
- exact pose/hand/gesture models and inference resolution/rates;
- Gesture Recognizer versus custom landmark analyzers per gesture;
- thresholds, calibration exercises, confidence policy, and lost-tracking UX;
- precise team turn/relay/shared-control modes;
- four-person simultaneous tracking support and minimum device tier;
- production availability and protection mechanism for test mode beyond the build gate;
- full replay file format and long-term regression corpus;
- session persistence, analytics, PWA/offline behavior, and content update strategy;
- visual design, formal art, audio assets, and game-specific scene composition;
- any backend, account, database, networking, or AI service.

Phase 1 should implement only the normalized provider boundary, developer provider, registry schema/validation, and one-device performance spike before a formal game.
