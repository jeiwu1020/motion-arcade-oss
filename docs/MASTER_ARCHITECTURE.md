# Motion Arcade — Master Architecture

Status: Phase 2A.1 implementation boundary (first playable formal game via test input)

Date: 2026-08-31

Primary target: iPhone Safari, landscape

Phase 1A implements the normalized input, adaptive profile, game-registry, developer simulation, React/Phaser lifecycle, and responsive shell boundaries. Phase 1B adds the gated camera/Pose sensor path through `PoseSensorFrame`. Phase 1C adds pure Pose feature extraction, a session-local analyzer baseline, temporal MOVE/LEAN/REACH/SQUAT/JUMP analysis, and a provider for the existing normalized contract. Phase 1D.1 adds canonical normalized `PlayerCalibration` v1 collection. Phase 1D.2 adds bounded, per-session MOVE/LEAN/REACH/SQUAT adaptation while preserving exact STANDARD fallback and leaving JUMP unchanged. Phase 1D.3a adds LOW_MOTION/SLOW_RESPONSE composition. Phase 1D.3b adds SEATED/UPPER_BODY torso baselines and safely disables SQUAT/JUMP in those modes. Phase 2A.1 registers the first formal game and proves a pure deterministic Game Core → dedicated Phaser projection using the existing normalized test provider. Camera gameplay, microphone, Hands, Voice, and multi-person assignment remain deferred.

## 1. Product constraints

- Motion Arcade is a therapist-operated browser platform for psychiatric occupational-therapy groups of roughly 12 participants, ages about 18–60+, with varied physical and cognitive capabilities.
- A therapist operates a landscape phone on a tripod. Participants do not hold it. The phone display is projected.
- Future inputs include body movement, hand movement, and live audio signal measurements.
- The first release must support one to four teams. Team count is independent from simultaneous human tracking count.
- Supported session patterns include solo versus CPU, two-player activities, and one-to-four-team formats.
- Four-person real tracking is a future performance tier, not a first-release promise.
- Adaptation is expressed by capability and control requirements, never diagnosis labels.
- A typical session lasts about 60 minutes, so lifecycle cleanup, thermal behavior, recoverability, and therapist control matter as much as peak-frame demos.

## 2. Browser and mobile constraints

- Logical playfield: `1280 × 720`.
- Phaser scaling: `FIT` with `CENTER_BOTH`; letterboxing is acceptable and cropping is forbidden.
- `viewport-fit=cover`, `100dvh`, and all four `env(safe-area-inset-*)` values define the safe DOM boundary.
- The full-screen play/test shell is separate from the homepage shell. Persistent home navigation does not shrink formal gameplay.
- The playfield parent has explicit grid dimensions and no padding, allowing Phaser ScaleManager to measure it correctly.
- Safari browser chrome, orientation changes, Dynamic Island/notches, and visual viewport changes must not reset provider or game state.
- Any future camera/microphone request requires HTTPS, an explicit therapist gesture, readable denied/unavailable recovery, and immediate track cleanup.
- Future camera video uses `autoplay`, `muted`, and `playsinline`; `facingMode: "user"` remains a preference rather than a guarantee.
- A future `AudioContext` is created/resumed from a therapist gesture and closed when unused.

Phase 1A browser evidence at `852 × 393`:

- document: `852 × 393`, no horizontal or vertical document overflow;
- playfield region: approximately `561.8 × 342.6`;
- displayed canvas: approximately `559.8 × 314.9`, exactly preserving 16:9;
- therapist panel: approximately `272.6 × 383.4`, scrolling internally rather than cropping the playfield.

## 3. Privacy constraints

Hard application rules:

- Camera frames remain local to the browser. No uploads, recordings, patient screenshots, face storage, Vercel Function processing, or identity recognition.
- Microphone data is never recorded or transcribed. Only ephemeral level, pitch, confidence/voicing, and duration features may be derived.
- No patient accounts or patient names exist by default.
- Raw frames, audio samples, landmarks, device labels, and stable patient identifiers are excluded from persistence and debug logs.
- Application-owned analytics remain disabled.
- Real sensor tracks must stop on provider switch, route exit, game stop, page hide where appropriate, and session end.

MediaPipe requires a more precise statement than “everything stays local.” Google's current terms state raw task input is processed on-device, while also documenting Google-bound SDK performance/utilization metrics. See [MediaPipe Web Privacy and Telemetry Audit](./MEDIAPIPE_PRIVACY_TELEMETRY.md). Production must distinguish:

1. raw patient media;
2. model/WASM downloads;
3. SDK telemetry/metrics;
4. Motion Arcade analytics, which remain disabled.

No production claim of “no third-party network communication” is allowed without version-specific verification.

## 4. React / Phaser boundary

React/DOM owns:

- application routing/shell, homepage, category discovery, therapist controls, settings, accessibility, permissions onboarding, and debug tooling;
- input-provider selection and configuration;
- Phaser creation/destruction and loading/error UI.

Framework-independent runtime owns:

- normalized input contracts, player state, adaptation, calibration boundaries, provider lifecycle, teams, registry validation, and game simulation.

Phaser owns:

- the 2D playfield view, cameras, animation/tweens, effects, and scene presentation;
- a disposable projection of normalized state.

Phaser scenes must not become the source of truth and must not listen for keyboard, mouse, sliders, camera, microphone, or MediaPipe events.

```text
React shell / therapist controls
          │ configures
          ▼
MotionInputProvider ──► immutable MotionInputSnapshot
                                  │
                       ┌──────────┴──────────┐
                       ▼                     ▼
                    game core         Phaser view adapter
```

### Lazy-loading boundary

- `App.tsx` lazy-loads the Developer Input Lab only when entered.
- `App.tsx` lazy-loads the gated Pose Sensor Lab only when entered.
- `App.tsx` lazy-loads each formal game shell only when entered.
- `PhaserCanvas` then dynamically imports the Phaser game factory.
- The home shell has no Phaser import or canvas.
- Async loading is cancellable. An unmount before module resolution creates no game.
- Cleanup is idempotent and calls `game.destroy(true)` once.
- React StrictMode cannot leave duplicate Phaser instances.

The production build currently emits the home shell, separate Developer Input Lab and Pose Sensor Lab chunks, and lazy Balloon Pop shell/Phaser chunks. HOME does not initialize Phaser, MediaPipe, a Worker, or camera access.

## 5. Sensor architecture

Real sensor selection remains deferred to a future `SensorManager`, but Phase 1C proves the camera/Pose-to-normalized-action boundary and Phase 1D adds derived-feature calibration plus a bounded adaptation policy:

```text
Game control scheme sensor requirements
                   │
                   ▼
              Sensor Manager
        ┌──────────┼──────────┐
        ▼          ▼          ▼
      Camera     Microphone   Test/Replay
        │          │          │
        ▼          ▼          │
   Pose / Hands  Web Audio    │
        └──────┬────┘         │
               ▼              │
        Motion Analysis ◄─────┘
               │
               ▼
       Normalized Action Snapshot
```

`SensorManager` will be the sole owner of real acquisition. It starts only the sensors declared by the selected control scheme; Pose, Hands, Gesture Recognizer, and Audio must never run permanently for all games.

Phase 1B's `CameraController` → `PoseSensorSession` → `InferenceScheduler` → `PoseInferenceBackend` path remains the acquisition boundary and ends at a MediaPipe-independent `PoseSensorFrame`. Phase 1C continues through `PoseFeatureExtractor` → `PoseMotionAnalyzer` → `PoseMotionInputProvider`. Phase 1D.1 reuses the extractor and feeds `PoseFeatureFrame` to `PoseCalibrationSession`. Phase 1D.2 resolves validated v1 calibration into a session-specific `PoseMotionConfig` before analyzer construction. Phase 1D.3a composes bounded LOW_MOTION range scaling and timestamp-based SLOW_RESPONSE candidate timing into that same effective config. Phase 1D.3b resolves full-body versus upper-body baseline requirements in the same config and reports both readiness levels without changing the game-facing snapshot. These layers do not duplicate camera/MediaPipe ownership or expose calibration/profile thresholds to games. Neither branch replaces the future `SensorManager`.

Future responsibilities:

- permission and readable failure state;
- stream/task/worker lifecycle and disposal;
- same-origin version-pinned model/WASM loading where approved;
- inference scheduling and quality management;
- coarse health/capability reporting without raw media exposure.

Phase 1A's `KeyboardMouseTestInputProvider` requests no sensors, imports no MediaPipe code, and presents the same provider interface.

Phase 1C analyzer details, thresholds, state machines, limitations, and manual QA are documented in [Phase 1C Motion Analyzer](./PHASE_1C_MOTION_ANALYZER.md).

Phase 1D.1 calibration architecture, normalized measurements, privacy, and manual QA are documented in [Phase 1D.1 Pose Calibration](./PHASE_1D_CALIBRATION.md).

Phase 1D.2 validation, fallback, safety clamps, action policy, and manual QA are documented in [Phase 1D.2 Calibration-Driven Motion Adaptation](./PHASE_1D_2_CALIBRATION_ADAPTATION.md).

## 6. Motion Action architecture

The normative contract is [Motion Input Contract](./MOTION_INPUT_CONTRACT.md).

```text
physical or simulated observation
  → source coordinate canonicalization
  → calibration / feature extraction
  → analyzer temporal state machine
  → per-player ability transform
  → normalized action snapshot
  → game
```

Implemented guarantees:

- configuration and calibration belong to each logical player;
- one-to-four simulated player states are independent;
- action phases preserve started/active/ended edges across differing update/render rates;
- repeated browser keydown events do not retrigger held actions;
- continuous values remain continuous;
- normalized points contain no browser pixels;
- `VOICE_PITCH` is calibrated `0..1`, not Hertz;
- raw Hz, voicing, and pitch stability are optional diagnostic telemetry, never required gameplay input.
- raw Pose landmarks are centralized in a pure feature extractor and never reach game consumers;
- stale Pose actions neutralize during snapshot polling without requiring another inference frame;
- the Pose analyzer publishes only existing action IDs through the existing provider contract.

### Coordinate freeze

- Sided limb actions refer to the participant's anatomical side.
- World movement and playfield coordinates refer to the projected game's visual direction.
- A mirrored front-camera preview never changes action names.
- Mirrored source coordinates are flipped exactly once before normalized actions.
- Games never compensate for camera mirroring.

### Developer test provider

The provider owns all keyboard and pointer bindings, simulated voice/cadence, pulse timing, player selection, and profile gating. The dedicated [Developer Test Mode](./DEVELOPER_TEST_MODE.md) documents operation and production safety.

## 7. Team architecture concept

These are separate identities:

- `TeamId`: one of one to four configured teams;
- `PlayerId`: a logical control channel for the current activity;
- `SensorTrackId`: a future currently tracked physical source;
- `TeamMembership`: session mapping between players and teams.

`supportedTeams` and `simultaneousPlayers` are separate registry fields. A four-team relay can use one player channel/body at a time. No code equates team count with MediaPipe `numPoses`.

Possible future modes include simultaneous, relay, turn-based, and shared-score; games declare support rather than relying on global assumptions.

## 8. Adaptive control architecture

Capability presets:

- `STANDARD`
- `LOW_MOTION`
- `SEATED`
- `UPPER_BODY`
- `LEFT_SIDE`
- `RIGHT_SIDE`
- `SLOW_RESPONSE`

`ResolvedAbilityProfile` composes presets into posture, body range, allowed anatomical sides, required motion range scale, and reaction window scale. Phase 1D.3a implements `LOW_MOTION` as a bounded `0.6` range scale for MOVE, LEAN, REACH, and SQUAT, and `SLOW_RESPONSE` as a `1.75` reaction scale that resolves to a 240 ms activation-candidate grace. Phase 1D.3b maps `SEATED` and `UPPER_BODY` to a shoulders-and-hips baseline, keeps torso MOVE/LEAN and anatomical REACH usable, and explicitly neutralizes SQUAT/JUMP. These dimensions compose without changing normalized game output or animation playback. STANDARD remains unchanged; LEFT_SIDE/RIGHT_SIDE Pose expansion is not yet claimed.

`PlayerCalibration` remains separate from `ResolvedAbilityProfile`. Version 1 contains normalized MOVE, LEAN, anatomical REACH, comfortable SQUAT ranges, per-step availability, and quality metadata. The policy validates it, maps each available side/action, applies functional scaling, and enforces the Phase 1D.2 safety clamps. In LOW_MOTION, an unavailable action uses the bounded scaled STANDARD fallback; otherwise it retains STANDARD. The result and effective config are session-only and contain no raw landmarks or saved body measurements. JUMP is not calibration- or profile-driven.

Each game control scheme declares compatible profiles. Core gameplay uses capability descriptions only; diagnosis-specific modes and filters are prohibited.

## 9. Game Registry architecture

Physical requirements belong to a control scheme, not globally to a game:

```ts
interface GameControlScheme {
  id: string
  label: string
  requiredActions: readonly MotionActionId[]
  optionalActions?: readonly MotionActionId[]
  inputTypes: readonly MotionInputType[]
  bodyAreas: readonly BodyArea[]
  posture: readonly SupportedPosture[]
  activityLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  supportedAbilityProfiles: readonly AbilityProfileId[]
  supportsSingleSide: boolean
  sensorRequirements: SensorRequirements
}

interface GameRegistration {
  id: GameId
  title: string
  description: string
  category: GameCategory
  subcategory?: SportsSubcategory
  tags: readonly string[]
  difficulty: {
    cognitiveComplexity: 'LOW' | 'MEDIUM' | 'HIGH'
    reactionDemand: 'LOW' | 'MEDIUM' | 'HIGH'
  }
  supportedTeams: readonly (1 | 2 | 3 | 4)[]
  simultaneousPlayers: { min: number; max: number }
  controlSchemes: readonly GameControlScheme[]
  load: () => Promise<GameModule>
}
```

Stable categories are `SPORTS`, `PARTY`, `VOICE`, and `HAND`. Sports subcategories are `RACKET_BALL`, `BALL`, `TRACK_FIELD`, `AQUATIC`, and `OTHER`.

Difficulty is multidimensional:

- cognitive complexity belongs to the game;
- reaction demand belongs to the game;
- physical activity belongs to each control scheme.

Validation catches duplicate game IDs, empty schemes/actions, invalid team counts, impossible player ranges, missing action input types, invalid category/subcategory combinations, seated/profile mismatches, and single-side declaration mismatches. Phase 2A.1 adds the first validated formal registration: `balloon-pop`.

## 10. Worker and performance strategy

Phaser render cadence and inference cadence are independent.

- Phaser targets display refresh and consumes the latest immutable snapshot.
- `InferenceScheduler` will allow at most one in-flight call per task and drop stale intermediate frames rather than queue them.
- `QualityManager` will observe inference time, render time, dropped frames, tracking confidence, visibility, thermal symptoms, and device capability.
- Quality can lower inference resolution/rate, model complexity, active tracker count, or optional sensor features without changing render FPS.
- MediaPipe Web video calls are synchronous on their current thread. A worker spike should use transferable `ImageBitmap`, close it after inference, and post serializable results.
- Safari compatibility requires a throttled main-thread fallback; worker/GPU support is never assumed.
- `MediaStreamTrackProcessor` is not a baseline dependency.
- Audio begins with `AnalyserNode`; `AudioWorklet` is considered only after profiling.

Sensor and Phaser modules remain lazy. Four-body tracking must not be optimized or promised before one-body device measurements.

## 11. Folder structure

Current implemented structure and planned destinations:

```text
src/
  app/                         # shell policy, build gates
  components/                  # future shared accessible DOM components
  design-system/               # future tokens/primitives
  motion/
    contracts/                 # implemented normalized types
    adaptive/                  # implemented profile resolution/gating
    coordinates/               # implemented canonical transforms
    providers/                 # implemented test provider/coordinator
    pose/                      # implemented Phase 1C features/analyzer/provider
    calibration/               # implemented Phase 1D calibration session + adaptation policy
    runtime/                   # future SensorManager/scheduler/quality
    workers/                   # future worker entry points
  sensors/                     # implemented camera/Pose acquisition; future Hands/audio
  game/
    core/                      # shared future renderer-independent systems
    phaser/                    # implemented lazy boot and test view
    registry/                  # implemented schema/validation
    teams/ scoring/ difficulty/ adaptive/  # future gameplay systems
  games/                       # formal lazy game modules; Balloon Pop implemented
  therapist/
    sensor-lab/                # gated Pose + Motion Analyzer diagnostics
    test-lab/                  # implemented gated panel and overlay
    controls/ presets/ session/ # future therapist workflow
  config/ hooks/ utils/ types/  # future shared infrastructure
docs/
```

Narrow unit/integration tests are colocated with their modules to keep contract behavior visible. Browser/visual/device suites may move to top-level test folders when automation infrastructure grows.

## 12. Testing strategy

Implemented automated tests cover:

- provider safe/idempotent start-stop and absence of media permission calls;
- keyboard phases, release, key-repeat behavior, continuous values, pointer normalization, click/drag/velocity, and one-to-four-player independence;
- request/profile reconciliation and neutral stop/restart behavior, including stale key, pulse, pointer, and voice runtime cleanup;
- separate player profiles and predictable side gating;
- canonical mirrored/non-mirrored coordinates, world direction, and anatomical labels;
- normalized voice clamp and sustained duration;
- registry valid/invalid fixtures and useful validation errors;
- provider switching;
- lazy Phaser cancellation, unmount, and idempotent StrictMode-style cleanup;
- build-time test-mode gate.
- Pose feature geometry, confidence validity, anatomical-side preservation, and raw-frame immutability;
- session baseline readiness/reset, stale neutralization, and long-loss re-baselining;
- separate full-body and upper-body readiness, including torso-only baselines;
- MOVE/LEAN/REACH/SQUAT hysteresis and JUMP pulse/refractory state behavior;
- immutable Pose provider mapping, profile gating, and coordinator lifecycle.
- deterministic Balloon Pop countdown/play/finish, hit/miss, held-action, timeout,
  replay, normalized test-provider integration, and formal registry validity.

Browser QA covers shell/Lab navigation, keyboard, pointer, sliders, players, profiles, canvas mount/unmount, console, media element absence, desktop layout, and `852 × 393` landscape overflow/FIT behavior. Phase 2A.1 adds the Balloon Pop home entry, 3-2-1 playfield, Z/C and DOM test controls, result/replay/home flow, and 1280 × 720 FIT projection.

Required device matrix remains:

1. iPhone Safari landscape;
2. iPad Safari;
3. Android Chrome;
4. desktop Chrome.

Emulation cannot replace real safe-area, permission, camera, microphone, projector, thermal, or 60-minute memory tests.

## 13. Deployment strategy

- Vite outputs static assets to `dist`; Vercel provides HTTPS and static deployment. No Function, backend, database, login, or upload path is required.
- A future client-side deep router will add Vercel's documented SPA rewrite only when needed.
- Test controls are automatic in development. Production requires the explicit non-secret build flag `VITE_ENABLE_TEST_INPUT=true`.
- Query strings alone cannot enable test input.
- `.env` and `.env.*` are ignored, while `.env.example` documents safe public flags.
- No secret may be stored in a `VITE_*` variable because Vite bundles it into browser code.
- MediaPipe models/WASM should be version-pinned and self-hosted when approved; this does not eliminate documented SDK metrics.
- Preview deployment QA must never use patient imagery or audio.

## 14. Technical risks

1. MediaPipe's documented metrics behavior requires clinical privacy/legal review and informed-consent planning.
2. iPhone thermal pressure and memory may degrade a 60-minute session.
3. Worker, GPU delegate, `ImageBitmap`, and Safari behavior vary by OS/device version.
4. Overlapping people can swap track identity; pose-array indices cannot represent participant identity.
5. Camera framing, lighting, clothing, mobility aids, seating, and projector delay affect motion reliability.
6. Pitch estimation requires a voiced/unvoiced gate, stability confidence, calibration, and varied-room testing.
7. Permission denial, backgrounding, Safari audio suspension, and camera interruption require therapist-friendly recovery.
8. Safe-area and browser-chrome behavior require physical iOS device testing.
9. Phaser, WASM, and models can make first use slow; lazy loading and readiness UI are mandatory.
10. Client-visible test-mode opt-in is a safety gate, not authentication.
11. Clinical usability needs large text, low cognitive load, predictable pause/reset, and therapist control beyond technical correctness.

## 15. Decisions intentionally deferred

- real Pose provider selection and readiness within formal gameplay;
- production camera/microphone permissions and UI;
- Hand Landmarker, Gesture Recognizer, and Web Audio implementation;
- final model licenses, assets, delegates, inference resolution/rate, and worker compatibility;
- MediaPipe metrics acceptance, blocking policy, consent language, and production legal approval;
- production onboarding, calibration persistence, control-scheme-specific thresholds, and patient-facing lost-tracking UX;
- multi-person identity continuity and four-person device tier;
- team relay/turn/shared-control details;
- replay file format and long-term regression corpus;
- production authentication/protection beyond the build-time test-mode gate;
- persistence, analytics, accounts, database, networking, PWA/offline mode, or AI services;
- formal art, audio assets, and additional production game scenes.

Phase 2A.1 stops at a single-player, test-provider Balloon Pop slice. It does not authorize direct Camera/MediaPipe gameplay, duplicated motion detectors, deferred actions, multi-person tracking, persistence, audio, formal art, or generic sensor-management work.
