# Phase 0 — Skills, Plugins, and API Research

Snapshot date: 2026-08-28  
Research order: official documentation, then official repositories. No deprecated `openai/skills` content or unverified third-party skill was installed.

## 1. Relevant session and local capabilities

The session exposed the following installed skill/plugin families before Phase 0 work:

- Codex system: `imagegen`, `openai-docs`, `plugin-creator`, `skill-creator`, `skill-installer`.
- Game and engineering: `animations`, `cameras`, `fighter-asset-pipeline`, `game-design`, `game-playtest`, `game-ui-frontend`, `input-keyboard-mouse-touch`, `loading-assets`, `scale-and-responsive`, `scenes`, `systematic-debugging`, `test-driven-development`, `web-game-foundations`.
- Browser and desktop control: Browser, Browser Use, Chrome, and Computer Use plugins.
- Artifact tools: Documents, PDF, Presentations, Spreadsheets, Excel live control, and Template Creator.
- Canva: brand check, branded presentation, bulk create, design feedback/edit/feedback implementation, social resize, and translation.
- Sites: site building and hosting.
- Vercel: agent browser/verification; AI SDK/UI/gateway/persistence; auth; caching; CMS; CI/CD/deployments; email; environment variables; observability; payments; React best practices; routing; storage; Next.js; Turborepo; Vercel CLI/API/Functions/Firewall/Flags/Queues/Sandbox/Services; Workflow, and related official Vercel skills.
- Other available helpers: Plugin Management and Visualize.

This is an inventory of capabilities exposed to this session, not a claim that every cached plugin is globally enabled. No recommended external connector (Airtable, Figma, Google Drive, and so on) was needed or installed.

## 2. OpenAI official plugin research

Primary source: [`openai/plugins`](https://github.com/openai/plugins), pinned during research at commit `6d99ee149c9fe3c7a55b96cab062cadc1ad36a9d`.

The official repository contains all requested Game Studio skills:

- `game-studio`
- `web-game-foundations`
- `phaser-2d-game`
- `game-ui-frontend`
- `game-playtest`

It also contains the requested Build Web Apps skills:

- `frontend-app-builder`
- `frontend-testing-debugging`
- `react-best-practices`

The official Game Studio and Build Web Apps plugin manifests both reported plugin version `0.1.2` at the pinned commit.

### Installation decisions

| Name | Result | Source/version | Location/reason |
|---|---|---|---|
| `web-game-foundations` | already available | pre-existing OpenAI Game Studio copy; local copy has no provenance metadata | `%USERPROFILE%\.codex\skills\openai-game-studio\skills\web-game-foundations` |
| `game-ui-frontend` | already available | same condition | `%USERPROFILE%\.codex\skills\openai-game-studio\skills\game-ui-frontend` |
| `game-playtest` | already available | same condition | `%USERPROFILE%\.codex\skills\openai-game-studio\skills\game-playtest` |
| `game-studio` | installed | official `openai/plugins`, pinned commit above; plugin manifest `0.1.2` | `%USERPROFILE%\.codex\skills\game-studio` |
| `phaser-2d-game` | installed | official `openai/plugins`, pinned commit above | `%USERPROFILE%\.codex\skills\phaser-2d-game` |
| `frontend-testing-debugging` | installed | official `openai/plugins`, pinned commit above | `%USERPROFILE%\.codex\skills\frontend-testing-debugging` |
| `react-best-practices` | already available | installed Vercel plugin `0.21.4` | Vercel plugin cache; not duplicated |
| `frontend-app-builder` | skipped | official source confirmed | The minimal Phase 0 scaffold did not need a full frontend-builder workflow. |

The three newly installed OpenAI skills become session-discoverable after Codex reloads its skill catalog. Installation used the official repository and did not alter global Codex configuration.

## 3. Phaser official skills

Primary source: [`phaserjs/phaser/skills`](https://github.com/phaserjs/phaser/tree/master/skills), pinned during research at commit `02d8931b626d9764c133cbb3fbf99966c03c757c`.

Already present and not duplicated:

| Skill | Existing location | Version/provenance note |
|---|---|---|
| `scale-and-responsive` | `%USERPROFILE%\.codex\skills\scale-and-responsive` | local copy has no commit metadata |
| `scenes` | `%USERPROFILE%\.codex\skills\scenes` | local copy has no commit metadata |
| `input-keyboard-mouse-touch` | `%USERPROFILE%\.codex\skills\input-keyboard-mouse-touch` | local copy has no commit metadata |
| `loading-assets` | `%USERPROFILE%\.codex\skills\loading-assets` | local copy has no commit metadata |
| `animations` | `%USERPROFILE%\.codex\skills\animations` | local copy has no commit metadata |

Installed from the pinned official Phaser repository into `%USERPROFILE%\.codex\skills\<name>`:

- `game-setup-and-config`
- `events-system`
- `geometry-and-math`
- `physics-arcade`
- `audio-and-sound`
- `sprites-and-images`
- `tweens`
- `particles`
- `text-and-bitmaptext`

All nine share source commit `02d8931b626d9764c133cbb3fbf99966c03c757c`. `v3-to-v4-migration` was deliberately not installed because this is a Phaser 4 greenfield project. Matter Physics was also deferred.

## 4. Current package versions and setup

Registry and official-source check at the snapshot date:

| Package/tool | Current stable/latest observed | Project choice |
|---|---:|---:|
| Phaser | `4.2.1` | `4.2.1` |
| `@mediapipe/tasks-vision` | `1.0.1` | `1.0.1` |
| React | `19.2.8` | `^19.2.8` |
| Vite | `8.2.2` | `^8.2.2` |
| TypeScript | npm latest `7.0.2` | `~6.0.2`, the official Vite React/TS template choice |

Phaser's official installation path is `npm install phaser` and ES-module import. Vite's official `react-ts` template supplies the React/TypeScript build setup. The project keeps the template TypeScript line rather than independently jumping to a newer major during Phase 0.

## 5. MediaPipe Tasks Vision findings

Official Web setup installs `@mediapipe/tasks-vision` and supports CPU or GPU delegates. The architecture should lazy-load and pin WASM/model assets rather than use an unpinned production CDN URL.

- [Pose Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js) returns normalized and world landmarks. `numPoses` defaults to one and can be raised, but the requested four-person capacity is performance-gated rather than promised.
- [Hand Landmarker for Web](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js) exposes 21 landmarks per hand; `numHands` defaults to one.
- [Gesture Recognizer for Web](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer/web_js) provides canned gesture categories plus hand results. It remains an optional source; games still consume normalized actions.
- Video inference calls such as `detectForVideo()` are synchronous and block their current JavaScript thread. The official guides recommend moving them to a worker when blocking affects the UI.
- Google's [official worker sample](https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/workers/object-detector.worker.ts) transfers an `ImageBitmap`, performs inference in a worker, closes the bitmap, and posts serializable results.
- `MediaStreamTrackProcessor` is not a safe architecture dependency because its availability and exposed global context differ across browsers. The initial worker spike should validate `HTMLVideoElement → ImageBitmap` with a throttled main-thread fallback.

## 6. Web Audio findings

- [`getUserMedia()`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) requires a secure context and user permission. A therapist gesture starts microphone access.
- [`AnalyserNode`](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode) supplies real-time time-domain and frequency-domain samples without recording. It can support level and a first pitch estimator.
- Pitch is not a native Web Audio output. It needs an estimator, a voiced/unvoiced confidence gate, room-noise calibration, and testing across varied voices.
- An [`AudioContext`](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume) may need to be resumed from a user gesture. [`AudioWorklet`](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) is the later option for measured low-latency work on the audio rendering thread, not a Phase 0 requirement.

## 7. iPhone Safari and responsive findings

- Camera/microphone require HTTPS, user permission, and explicit recovery UX for denial. The front camera is a `facingMode: "user"` preference rather than an infallible guarantee.
- The hidden camera element must use `autoplay`, `muted`, and `playsinline`; WebKit's [iOS video policy](https://webkit.org/blog/6784/new-video-policies-for-ios/) and camera behavior make inline playback important.
- WebKit's [safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) requires `viewport-fit=cover` plus `env(safe-area-inset-*)` when content extends around notches and rounded corners.
- Dynamic viewport units react to changing browser chrome. The shell uses `100dvh`, but resize/orientation/visual-viewport changes must not reset simulation state.
- Browser and iOS-version changes can regress viewport and camera behavior, so emulation is insufficient; the target device matrix remains mandatory.

## 8. Vercel deployment findings

Vercel's [official Vite guide](https://vercel.com/docs/frameworks/frontend/vite) supports static Vite deployment with framework detection. Vite outputs `dist`; no Vercel Function is needed. If Phase 1 later adds client-side deep routes, use the documented SPA rewrite. Deployments may come from Git integration or the [Vercel CLI](https://vercel.com/docs/projects/deploy-from-cli), but Phase 0 intentionally performs no deployment.

## 9. Research limitations

- A repository commit records the source snapshot used for installation/research, but installed standalone skill folders do not themselves carry an update mechanism or embedded lock file.
- Pre-existing local Phaser/Game Studio skills lacked source commit metadata, so their precise installed revision is reported as unknown instead of inferred.
- Browser emulation cannot prove physical camera framing, microphone behavior, thermal stability, projector latency, or real safe-area behavior. Those remain device tests.
