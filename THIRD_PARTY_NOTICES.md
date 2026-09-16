# Third-Party Notices

Status: pre-publication inventory. This file does not replace upstream license texts.

Motion Arcade depends on third-party software listed in `package.json` / `package-lock.json`. Each dependency remains subject to its own license.

## MediaPipe

`@mediapipe/tasks-vision` is pinned in the project. MediaPipe source code is published under Apache License 2.0. The project's privacy audit also documents SDK telemetry behavior and production-review requirements in `docs/MEDIAPIPE_PRIVACY_TELEMETRY.md`.

The tracked `pose_landmarker_lite.task` model is being treated separately from the SDK source code. Its public-redistribution terms must be verified before the repository becomes public. See `ASSET_LICENSES.md`.

## Other runtime dependencies

The project also uses React, React DOM, Phaser, Vite, TypeScript, Vitest, and related developer tooling. Before the first public release, generate or review a dependency-license inventory from the exact lockfile and preserve any notices required by upstream packages.

## No relicensing of third-party material

The Motion Arcade MIT license does not relicense third-party dependencies, models, media, or other assets. Their upstream terms continue to apply.
