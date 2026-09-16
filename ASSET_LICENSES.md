# Asset Licensing Inventory

Status: **pre-publication audit in progress**.

The repository-level MIT license applies to Motion Arcade source code and project documentation unless a file states otherwise. It does **not** automatically grant redistribution rights for third-party models, images, audio, fonts, or other media assets.

Nothing marked `PENDING` or `BLOCKED` below should be treated as cleared for public redistribution.

| Asset group | Current location | Public redistribution status | Required action before repository becomes public |
|---|---|---|---|
| Homepage v2 artwork and source/master PNGs | `public/assets/home/` | **PROVENANCE CLEARED — project-controlled OpenAI output; asset-license label still to finalize** | Project conversation history from 2026-08-28 records the five v2 files as newly generated standalone originals: `home_lobby_bg_v2`, `category_sports_v2`, `category_party_v2`, `category_voice_v2`, and `category_hand_v2`. The project owner has confirmed they were generated in ChatGPT/OpenAI image generation under the owner's direction. OpenAI's current Terms of Use state that, as between the user and OpenAI and to the extent permitted by applicable law, the user owns Output and OpenAI assigns any rights it has in Output to the user. Before public release, choose and record the repository-facing license/permission statement for these project-controlled visual assets. |
| Motion Arcade mark | `public/assets/home/motion_arcade_mark.svg` | **PROVENANCE CLEARED — project-authored SVG; asset-license label still to finalize** | Pure SVG vector markup consisting of paths and gradients, with no embedded third-party image, external URL, or font dependency. Added with the homepage v2 asset commit `1dc8f3572eeb8e11208c0cb3f723de5bd4c89d37`. Before public release, record the repository-facing license/permission statement for this project-controlled mark; trademark/branding rights, if any, remain separate from copyright licensing. |
| Balloon Rally / Reaction Arena music and sound effects | `public/audio/` | **BLOCKED in current tracked form** | Prior project records identify these MP3s as Pixabay downloads. The current Pixabay Content License prohibits distributing Content on a standalone basis. A public Git repository exposes the original MP3 files directly, so do not publish these tracked files as-is. Replace/remove them and purge them from public Git history, or publish from a sanitized history that never contains them. Preserve source links/certificates for any game deployment use that remains permitted as part of the larger game. |
| MediaPipe Pose Landmarker Lite model | `public/vendor/mediapipe/models/pose_landmarker_lite.task` | **CLEARED — Apache-2.0** | Google’s official MediaPipe Web documentation uses the exact Lite model URL `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`. The official BlazePose GHUM 3D model card explicitly covers Lite, Full, and Heavy variants and states that the models are licensed under Apache License 2.0. Preserve Apache-2.0 attribution/notices in `THIRD_PARTY_NOTICES.md`. |
| MediaPipe runtime WASM | generated under `public/vendor/mediapipe/wasm/` | Apache-2.0 upstream dependency | Produced from the installed `@mediapipe/tasks-vision` npm dependency during setup/build; retain upstream notices and license requirements. |

## Homepage v2 provenance

Project conversation history on 2026-08-28 establishes the production sequence:

1. an earlier homepage-art pass included cleaned/cropped production candidates; then
2. the v2 set was explicitly replaced with five newly generated standalone originals.

The v2 canonical files are:

- `home_lobby_bg_v2.webp`
- `category_sports_v2.webp`
- `category_party_v2.webp`
- `category_voice_v2.webp`
- `category_hand_v2.webp`

Their corresponding source/master PNGs are part of the same project-controlled visual set. The project owner has confirmed that these images were generated through ChatGPT/OpenAI image generation for Motion Arcade.

OpenAI Terms of Use (effective 2026-01-01) state that, as between the user and OpenAI and to the extent permitted by applicable law, the user owns Output and OpenAI assigns to the user any rights OpenAI has in that Output. AI-generated output may not be unique, and copyright protectability can vary by jurisdiction; this provenance record therefore avoids making broader copyright claims than necessary.

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

For project-controlled assets whose provenance is already cleared, finalize and document the intended public asset license/permission statement before release.
