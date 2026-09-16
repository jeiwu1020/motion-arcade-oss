# Third-Party Notices

Status: pre-publication inventory. This file does not replace upstream license texts.

Motion Arcade depends on third-party software listed in `package.json` / `package-lock.json`. Each dependency remains subject to its own license.

## MediaPipe

`@mediapipe/tasks-vision` is pinned in the project. MediaPipe source code is published under Apache License 2.0. The project's privacy audit also documents SDK telemetry behavior and production-review requirements in `docs/MEDIAPIPE_PRIVACY_TELEMETRY.md`.

### Pose Landmarker Lite model

Motion Arcade includes:

- `public/vendor/mediapipe/models/pose_landmarker_lite.task`
- Official source: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`
- Upstream model family: BlazePose GHUM 3D (Lite / Full / Heavy)
- Official model card: `https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf`
- License: Apache License 2.0

The official BlazePose GHUM 3D model card explicitly lists Lite, Full, and Heavy variants and states that the model is licensed under the Apache License, Version 2.0. Redistribution must continue to comply with Apache-2.0 requirements.

## Other runtime dependencies

The project also uses React, React DOM, Phaser, Vite, TypeScript, Vitest, and related developer tooling. Before the first public release, generate or review a dependency-license inventory from the exact lockfile and preserve any notices required by upstream packages.

## No relicensing of third-party material

The Motion Arcade MIT license does not relicense third-party dependencies, models, media, or other assets. Their upstream terms continue to apply.
