# Motion Arcade

**An open-source, browser-based motion gaming platform for accessible and adaptive play.**

> **Status: Alpha — active development**

Motion Arcade explores reusable architecture for camera-based body motion, spatial interaction, voice input, adaptive player profiles, and deterministic arcade games in the browser. It is built with React, TypeScript, Phaser, and MediaPipe, with smartphone landscape play and large-display readability as primary design constraints.

The project began from therapist-operated group-play requirements, but the architecture is intentionally capability-based so it can also be useful for inclusive recreation, rehabilitation-oriented prototypes, classrooms, community activities, and general motion-game experimentation.

## Why this project exists

Browser motion games often couple game rules directly to camera landmarks or device-specific input. Motion Arcade separates those concerns:

```text
camera / microphone / test input
            ↓
local feature extraction + calibration
            ↓
normalized motion / voice actions
            ↓
deterministic game session/core
            ↓
React + Phaser presentation
```

Games consume normalized actions rather than raw MediaPipe landmarks, camera frames, microphone samples, or DOM device events. This makes input providers testable and allows real, simulated, and future replay input to share the same contracts.

## Current capabilities

- local browser camera + MediaPipe Pose pipeline;
- normalized MOVE / LEAN / REACH / SQUAT / JUMP and spatial hand interaction;
- calibration-driven adaptation;
- capability profiles including low-motion, seated, upper-body, single-side, and slower-response play;
- local microphone signal analysis for voice-controlled games without speech transcription;
- reusable camera framing / AR presentation;
- deterministic game cores separated from Phaser rendering;
- developer test input for motion and voice without requesting sensor permissions;
- CI validation with typecheck, lint, tests, and production build;
- smartphone landscape and safe-area-aware UI architecture.

Playable engineering prototypes currently include Balloon Rally, Reaction Arena, Runner, Rhythm Motion, Tennis, Badminton, Bowling, Running Race, Swimming, High Jump, Long Jump Challenge, Baseball, Vocal Hop, and Sound Cannon. Physical-device QA status varies by module; see `docs/CURRENT_PHASE.md` for the current evidence and open work.

## Privacy model

Motion Arcade is designed so application-owned code does not upload or persist raw camera frames, microphone samples, pose landmarks, recordings, or patient identity.

MediaPipe is a third-party SDK and has separate telemetry behavior. The project does **not** claim zero third-party network communication. See [`docs/MEDIAPIPE_PRIVACY_TELEMETRY.md`](./docs/MEDIAPIPE_PRIVACY_TELEMETRY.md) for the current audit, limitations, and production-review requirements.

This alpha project is not a medical device and should not be used for diagnosis or clinical decision-making.

## Run locally

Requires a current Node.js release compatible with the lockfile/CI environment.

```bash
npm ci
npm run dev
```

Validation commands:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Real camera/microphone features require a browser/secure-context environment that supports the relevant Web APIs and an explicit user permission action.

## Project documentation

Start here:

- [`docs/CURRENT_PHASE.md`](./docs/CURRENT_PHASE.md) — live implementation checkpoint;
- [`docs/MASTER_ARCHITECTURE.md`](./docs/MASTER_ARCHITECTURE.md) — architecture boundaries;
- [`docs/MASTER_IMPLEMENTATION_PLAN.md`](./docs/MASTER_IMPLEMENTATION_PLAN.md) — detailed engineering plan;
- [`docs/MOTION_INPUT_CONTRACT.md`](./docs/MOTION_INPUT_CONTRACT.md) — normalized input contract;
- [`docs/MEDIAPIPE_PRIVACY_TELEMETRY.md`](./docs/MEDIAPIPE_PRIVACY_TELEMETRY.md) — privacy / telemetry audit;
- [`ROADMAP.md`](./ROADMAP.md) — public-facing direction;
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — contribution rules.

## Open-source status and asset licensing

Source code and project documentation are being prepared for release under the MIT License.

**Media assets and third-party model files are not automatically covered by the MIT License.** The repository is still private while their provenance and redistribution rights are reviewed. See [`ASSET_LICENSES.md`](./ASSET_LICENSES.md) and [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

## Development status

The repository is deliberately published as an alpha rather than waiting for a feature-complete 1.0. Engineering development is active, while physical QA, multiplayer foundations, broader device validation, and OSS release hardening remain ongoing.
