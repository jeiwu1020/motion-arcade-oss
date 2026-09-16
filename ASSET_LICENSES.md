# Asset Licensing Inventory

Status: **pre-publication audit in progress**.

The repository-level MIT license applies to Motion Arcade source code and project documentation unless a file states otherwise. It does **not** automatically grant redistribution rights for third-party models, images, audio, fonts, or other media assets.

Nothing marked `PENDING` below should be treated as cleared for public redistribution.

| Asset group | Current location | Public redistribution status | Required action before repository becomes public |
|---|---|---|---|
| Homepage artwork and source PNGs | `public/assets/home/` | PENDING | Confirm creator/provenance and redistribution rights; document final license or remove source assets from public history. |
| Motion Arcade mark | `public/assets/home/motion_arcade_mark.svg` | PENDING | Confirm ownership/provenance and explicitly choose an asset license. |
| Balloon Rally / Reaction Arena music and sound effects | `public/audio/` | PENDING | Identify source for every MP3 and confirm redistribution / modification rights; replace or remove any unclear files. |
| MediaPipe Pose Landmarker task model | `public/vendor/mediapipe/models/pose_landmarker_lite.task` | PENDING / third-party | Verify authoritative model redistribution terms. If not clearly permitted, remove the model from the public repository and provide a documented download/setup step instead. |
| MediaPipe runtime WASM | generated under `public/vendor/mediapipe/wasm/` | Not tracked | Produced from the installed npm dependency during setup/build; retain upstream notices and license requirements. |

## Release rule

The repository must remain private until all tracked `PENDING` assets are either:

1. documented with a clear redistribution license and required attribution/notices; or
2. removed/replaced before public release.

When an asset is cleared, record its exact path, source/provenance, copyright holder where known, license, and required attribution here.
