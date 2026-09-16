# Third-Party Notices

Status: pre-publication inventory. This file does not replace upstream license texts.

Motion Arcade depends on third-party software listed in `package.json` / `package-lock.json`. Each dependency remains subject to its own license.

## Dependency-license audit

A lockfile-based local audit on 2026-09-16 installed the exact dependency graph with `npm ci` and inspected 59 unique packages:

- 53 permissive
- 4 Apache-2.0 / notice-review packages
- 2 MPL-2.0 transitive build packages
- 0 unknown/custom-license packages

No GPL, LGPL, AGPL, or missing-license package was found.

The two MPL-2.0 packages are:

- `lightningcss@1.33.0`
- `lightningcss-win32-x64-msvc@1.33.0`

They are transitive dependencies of the Vite development/build toolchain, are not direct Motion Arcade runtime dependencies, are not vendored into this repository, and are not intended to be redistributed as Motion Arcade source files. Mozilla describes MPL 2.0 as file-level copyleft and explicitly permits MPL-covered code to be combined with differently licensed code in a Larger Work. If Motion Arcade later directly redistributes or modifies MPL-covered Lightning CSS files, those files must continue to comply with MPL-2.0.

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

The project therefore preserves the canonical Apache License 2.0 text at:

- `third_party/licenses/Apache-2.0.txt`

The dependency audit found no package-local NOTICE file for `@mediapipe/tasks-vision`; no upstream NOTICE text is therefore copied into this repository. If a future version adds an upstream NOTICE file, its applicable attribution notices must be preserved when redistributed.

## Other Apache-2.0 build/development packages

The audited graph also contains:

- `typescript@6.0.3`
- `detect-libc@2.1.2`
- `expect-type@1.4.0`

No package-local NOTICE file was found for these audited versions. They are installed through npm rather than vendored into the repository. Their upstream licenses remain applicable.

## Other runtime dependencies

The project also uses React, React DOM, Phaser, Vite, TypeScript, Vitest, and related developer tooling. The exact versions are locked by `package-lock.json`; the public repository does not vendor `node_modules`.

## No relicensing of third-party material

The Motion Arcade MIT license does not relicense third-party dependencies, models, media, or other assets. Their upstream terms continue to apply.
