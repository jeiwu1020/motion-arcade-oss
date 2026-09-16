# Asset Licensing Inventory

Status: **pre-publication audit in progress**.

The repository-level MIT license applies to Motion Arcade source code and project documentation unless a file states otherwise. It does **not** automatically grant redistribution rights for third-party models, images, audio, fonts, or other media assets.

Nothing marked `PENDING` or `BLOCKED` below should be treated as cleared for public redistribution.

| Asset group | Current location | Public redistribution status | Required action before repository becomes public |
|---|---|---|---|
| Homepage artwork and source PNGs | `public/assets/home/` | PENDING | Project records describe the v2 images as newly generated standalone originals, but the exact generator/source and applicable output terms were not preserved in the repository. Confirm provenance and terms; document the final asset license or replace/remove them. |
| Motion Arcade mark | `public/assets/home/motion_arcade_mark.svg` | PENDING | Confirm ownership/provenance and explicitly choose an asset license. |
| Balloon Rally / Reaction Arena music and sound effects | `public/audio/` | **BLOCKED in current tracked form** | Prior project records identify these MP3s as Pixabay downloads. The current Pixabay Content License prohibits distributing Content on a standalone basis. A public Git repository exposes the original MP3 files directly, so do not publish these tracked files as-is. Replace/remove them and purge them from public Git history, or publish from a sanitized history that never contains them. Preserve source links/certificates for any game deployment use that remains permitted as part of the larger game. |
| MediaPipe Pose Landmarker Lite model | `public/vendor/mediapipe/models/pose_landmarker_lite.task` | **CLEARED — Apache-2.0** | Google’s official MediaPipe Web documentation uses the exact Lite model URL `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`. The official BlazePose GHUM 3D model card explicitly covers Lite, Full, and Heavy variants and states that the models are licensed under Apache License 2.0. Preserve Apache-2.0 attribution/notices in `THIRD_PARTY_NOTICES.md`. |
| MediaPipe runtime WASM | generated under `public/vendor/mediapipe/wasm/` | Apache-2.0 upstream dependency | Produced from the installed `@mediapipe/tasks-vision` npm dependency during setup/build; retain upstream notices and license requirements. |

## MediaPipe model provenance

- Asset: `pose_landmarker_lite.task`
- Official source: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`
- Model family: BlazePose GHUM 3D (Lite / Full / Heavy)
- Model card: `https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf`
- License: Apache License 2.0
- Copyright / authorship: Google / MediaPipe model authors as documented in the upstream model card

## Pixabay audio note

Pixabay permits use and adaptation of Content subject to its Content License, but prohibits standalone distribution where the content remains substantially in the same form. Because source repositories make tracked media files individually downloadable, the current raw MP3 history is not suitable for the planned public OSS repository.

## Release rule

The repository must remain private until all tracked `PENDING` / `BLOCKED` assets are either:

1. documented with clear redistribution rights and required attribution/notices; or
2. removed/replaced **and excluded from the Git history that will become public**.

When an asset is cleared, record its exact path, source/provenance, copyright holder where known, license, and required attribution here.
