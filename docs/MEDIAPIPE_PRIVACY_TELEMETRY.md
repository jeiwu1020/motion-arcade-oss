# MediaPipe Web Privacy and Telemetry Audit

Status: Phase 1A baseline plus Phase 1B sensor-spike audit

Audited package: `@mediapipe/tasks-vision@1.0.1`

Audit date: 2026-08-28

Real camera/microphone access performed: **No**

## Executive conclusion

MediaPipe's official terms state that task input such as images and video is processed on-device and is not sent to Google. The same terms separately state that MediaPipe Solution APIs contact Google and send performance/utilization metrics.

Those are different privacy properties:

```text
raw patient media             remains local according to official terms
model/WASM assets             can be served from the application origin
MediaPipe SDK metrics         documented as sent to Google
application-owned analytics  disabled by Motion Arcade
```

Motion Arcade must not claim “no third-party network communication” merely because raw frames remain local.

## 1. Authoritative documentation

Google's [MediaPipe APIs Terms of Service](https://developers.google.com/edge/mediapipe/legal/tos), last modified April 7, 2026, states that:

- input processing occurs on-device and MediaPipe does not send input data to Google servers;
- the APIs may contact Google for items such as bug fixes, updated models, and hardware-accelerator compatibility information;
- the APIs send performance and utilization metrics to Google;
- the application owner is responsible for informed consent for Google's processing of MediaPipe metrics data where applicable law requires it.

The documented usage-data categories are:

| Category | Official examples |
|---|---|
| Engagement | SDK usage/downloads, installs, session counts |
| Usage and performance | inference counts, hardware-level performance metrics |
| Application and input metadata | app ID and general characteristics of processed media, such as image/video |
| System environment | host system and version |

The current [MediaPipe Tasks Privacy Notice](https://developers.google.com/edge/mediapipe/solutions/tasks) repeats that task input processing takes place on-device. It does not negate the separate metrics language in the API Terms.

## 2. Web package and public API inspection

The installed package reports version `1.0.1` and Apache-2.0 code licensing. Inspection of its distributed Web declarations found model path/buffer and delegate configuration but no documented Web option that disables metrics transmission.

Inspection of the distributed `vision_bundle.mjs` found:

- a metrics destination string: `https://odml.pa.googleapis.com/v1/log`;
- an HTTP `POST` path using `application/x-protobuf`;
- logging code associated with task creation/operation and periodic flushing.

This static inspection is evidence about the audited package build, not a stable public API promise. The exact endpoint, payload schema, and implementation may change in another package version. Motion Arcade does not depend on or attempt to modify undocumented bundle internals.

## 3. Controlled same-origin network test

A disposable localhost page was created outside the repository. It served all tested artifacts from its own origin:

- the installed MediaPipe JavaScript bundle;
- MediaPipe vision WASM files;
- a small official test model.

The page created and closed a `FaceDetector` without providing an image, video, camera, microphone, patient data, or game data. Page-level `fetch` instrumentation recorded requests and returned a synthetic failure for external destinations.

Observed requests after module load:

| Method | Destination | Purpose/result |
|---|---|---|
| `GET` | localhost vision WASM | same-origin asset; succeeded |
| `GET` | localhost model file | same-origin asset; succeeded |
| `POST` | `https://odml.pa.googleapis.com/v1/log` | external metrics attempt; deliberately blocked |

The task initialized and closed even though the external POST was blocked in this narrow test. This demonstrates current technical tolerance for that failed request; it does **not** establish that blocking telemetry is an officially supported configuration, contractually sufficient, or safe across tasks and future versions.

## 4. Answers to the Phase 1A questions

### What requests occur after initialization?

For the controlled no-media task, the application fetched the configured WASM/model assets and the package attempted a metrics POST to Google's `odml.pa.googleapis.com` endpoint. Other tasks, delegates, versions, or runtime conditions may make additional documented update/compatibility requests.

### Do requests still occur with self-hosted assets?

Yes. The Google metrics POST was attempted even when the tested WASM and model were served from localhost.

### Are telemetry/metrics transmitted by the Web package?

Google officially documents metrics transmission for MediaPipe Solution APIs, and the audited Web package attempted the metrics request. Because the controlled test blocked the POST, the audit did not transmit or decode a payload.

### What metadata categories are documented?

Engagement, usage/performance, application/input metadata, and system environment, as listed above. Google explicitly includes app ID, general media characteristics, inference counts, hardware performance, and host/version examples.

### Is there an official telemetry opt-out?

No supported Web opt-out was found in the official Terms, Web setup guide, task guide, public `BaseOptions`, or installed TypeScript declarations. Motion Arcade must not invent or rely on undocumented disable flags.

### Is blocking external telemetry officially supported?

No authoritative document located in this audit promises support for blocking the metrics endpoint. A controlled network block did not prevent one no-media task from initializing and closing, but that observation is not a supported-product guarantee.

### What consent does Google require?

Google states that the application owner is responsible for obtaining informed consent for Google's processing of MediaPipe metrics data when required by applicable law. Clinical deployment therefore needs privacy/legal review and user-facing disclosure before real sensors are enabled.

### Are Google-hosted model/WASM resources required?

The [official Web setup guide](https://developers.google.com/edge/mediapipe/solutions/setup_web) accepts a model path/buffer, and the [Pose Landmarker Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js) instructs developers to download and store a model in the project. `FilesetResolver` accepts an application-controlled WASM root. The controlled test also initialized with same-origin WASM/model assets.

Therefore Google-hosted model and WASM URLs are not mechanically required for the audited setup. Self-hosting assets does not disable SDK metrics.

## 5. Required production architecture

Before a real provider is approved:

1. Pin the MediaPipe package, model, and WASM versions.
2. Serve reviewed model/WASM assets from the Motion Arcade deployment origin where licensing permits.
3. Repeat a network audit against the exact production task, delegate, browser, and package version.
4. Maintain an allowlist/inventory of every expected third-party request.
5. Obtain clinical privacy/legal review of Google terms, metrics categories, consent language, and regional requirements.
6. Decide whether the product may use the documented telemetry behavior. Do not treat an unsupported block as a complete compliance strategy.
7. Keep Motion Arcade analytics disabled unless a separate privacy review explicitly approves them.
8. Keep raw frames, audio samples, landmarks, face imagery, patient names, and stable patient identifiers out of application logs and telemetry.

## 6. Current Phase 1A behavior

- `@mediapipe/tasks-vision` remains installed and pinned but is not imported by the application or Developer Input Lab.
- The normal shell and test provider do not initialize MediaPipe or request camera/microphone access.
- No application analytics, backend, upload route, recording, or transcription exists.
- Production readiness does not claim zero third-party communication.

## 7. Remaining uncertainty

- Exact metrics payload fields and server-side retention were not established from a documented Web-specific schema.
- No authoritative Web-specific opt-out or supported blocking procedure was found.
- Behavior may differ by task, delegate, browser, runtime duration, model, or future SDK version.
- Model redistribution and update policy require license review for each selected production model.

These uncertainties are pre-production blockers for a clinical real-sensor release, not blockers for the permission-free Phase 1A simulator.

## 8. Phase 1B Pose Landmarker spike (2026-08-28)

The Phase 1B implementation keeps the existing package pin (`@mediapipe/tasks-vision@1.0.1`), stores the official Pose Landmarker Lite task locally, and copies the package's exact WASM/runtime files to the same-origin `/vendor/mediapipe/wasm/` directory. The application has no sensor backend, upload route, recording API, persistence, or application-owned analytics.

The exact worker task was exercised with a disposable blank-canvas harness (no camera, person, microphone, or patient data). The first development run exposed a Vite serving issue for a public WASM loader; the repository now serves only the whitelisted generated MediaPipe loader modules directly in development. A subsequent pinned-worker run reached the package's loader initialization but the available browser connector became unavailable due to its usage limit before a complete Pose initialization/network capture could be repeated. Accordingly, this section records observations and limits rather than claiming a successful real-camera Pose run.

Observed / configured boundaries for the exact spike:

| Question | Phase 1B observation |
|---|---|
| Same-origin assets | Model path and WASM root are absolute Motion Arcade `/vendor/...` paths; the build copies the installed 1.0.1 files, with no CDN runtime URL. |
| Camera startup | No camera request occurred on HOME or Lab mount. The connector left `getUserMedia()` pending only after the explicit start click; Stop returned the Lab to a stopped state. |
| Third-party metrics | The installed bundle still contains the previously audited `https://odml.pa.googleapis.com/v1/log` metrics destination. A complete successful Pose-task browser network capture was **not available** in this run, so no new Pose-specific absence claim is made. |
| Raw image/video upload | No Motion Arcade upload path exists. The blank-canvas harness supplied one local `ImageBitmap`; no camera/video blob or landmark array was sent to an application endpoint. The official MediaPipe terms' on-device input statement and separate SDK-metrics statement remain applicable. |
| Browser/device | Localhost desktop browser connector; no physical camera and no iPhone Safari were available. |

The prior controlled FaceDetector audit remains the only completed network observation of a task initialization: same-origin WASM/model GETs and an attempted Google metrics POST, blocked in that disposable test. It remains the governing warning for production consent/legal review. Phase 1B must not be described as “no third-party traffic” until the exact Pose task, browser, delegate, and deployment are captured with network tooling.
