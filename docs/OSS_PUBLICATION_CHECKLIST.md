# OSS Publication Checklist

Status: preparing private repository for a future public alpha release and Codex for OSS application.

## Completed

- [x] Create isolated `oss-prep` branch from current `main`.
- [x] Add repository MIT license for Motion Arcade source code / project documentation.
- [x] Add `CONTRIBUTING.md`.
- [x] Add `SECURITY.md`.
- [x] Add public-facing `ROADMAP.md`.
- [x] Rewrite README to reflect the current alpha architecture and implemented game portfolio.
- [x] Add package metadata (`description`, `license`, repository links) without changing the lockfile version.
- [x] Add `ASSET_LICENSES.md` and `THIRD_PARTY_NOTICES.md`.
- [x] Confirm current CI uses read-only repository contents permission and no Actions secrets.
- [x] Confirm tracked root `.env` and `.env.local` have no commit history.
- [x] Identify the current game MP3 set as Pixabay-sourced and document why raw tracked copies must not appear in the public Git history.
- [x] Prove the chosen history strategy in a disposable local mirror with `git-filter-repo 2.47.0`: 87 commits preserved, `public/audio/` removed from all refs, 0 remaining MP3 blobs, core project files preserved, no push performed, original repository untouched.
- [x] Choose the publication history strategy: preserve the private development repository and publish a separately sanitized mirror/history after all remaining blockers are closed.
- [x] Run full-history secret scanning on the sanitized mirror with official `gitleaks 8.30.0`; checksum verified and 0 findings across all refs.
- [x] Confirm no patient-identifying data, institution-identifying data, private IP/server address, or credential-like token was found in the repository/history audit.
- [x] Prove commit-identity sanitization in a disposable privacy-test mirror: replace `[redacted personal email]` with GitHub noreply identity `249893203+jeiwu1020@users.noreply.github.com`, preserve 87 commits, and retain GitHub attribution.
- [x] Re-run gitleaks after the privacy-test email rewrite and confirm 0 findings.
- [x] Prove local-path sanitization in a second privacy-test mirror: replace historical `%USERPROFILE%\...` references in `docs/SKILLS_AND_RESEARCH.md` with `%USERPROFILE%\...`, preserve all 87 commits, leave no specific `%USERPROFILE%\...` paths, and keep gitleaks at 0 findings.
- [x] Close the secret/privacy/history-metadata audit line for the dry run: no secrets, patient identifiers, institution identifiers, personal Gmail, or user-specific Windows paths remain in the tested public-history candidate.
- [x] Verify the tracked MediaPipe Pose Landmarker Lite model against Google's official Pose Landmarker documentation/model card: exact Lite model source identified; the official BlazePose GHUM 3D model card covers Lite/Full/Heavy variants and licenses the model family under Apache-2.0. Record source/license in `ASSET_LICENSES.md` and `THIRD_PARTY_NOTICES.md`.
- [x] Resolve homepage v2 provenance from the 2026-08-28 Motion Arcade project conversation plus maintainer confirmation: `home_lobby_bg_v2`, `category_sports_v2`, `category_party_v2`, `category_voice_v2`, and `category_hand_v2` are newly generated standalone ChatGPT/OpenAI image outputs for this project. Record this provenance in `ASSET_LICENSES.md`.
- [x] Verify `motion_arcade_mark.svg` is project-controlled pure SVG vector markup with paths/gradients only and no embedded third-party image, external URL, or font dependency.
- [x] Run an exact lockfile dependency-license audit with `npm ci`: 59 unique packages, 53 permissive, 4 Apache-2.0/notice-review, 2 MPL-2.0 transitive build dependencies, 0 unknown/custom, and no GPL/LGPL/AGPL findings.
- [x] Manually review `lightningcss@1.33.0` and `lightningcss-win32-x64-msvc@1.33.0`: both are transitive Vite build dependencies under MPL-2.0, are not vendored into the repository, and do not relicense unrelated Motion Arcade files. Record the disposition in `docs/DEPENDENCY_LICENSE_AUDIT.md` and `THIRD_PARTY_NOTICES.md`.
- [x] Preserve the canonical Apache License 2.0 text at `third_party/licenses/Apache-2.0.txt` for Apache-licensed material redistributed with Motion Arcade, including MediaPipe model/runtime assets.
- [x] License project-controlled homepage v2 visual assets under CC BY 4.0 to the extent project-controlled rights exist; apply the same copyright permission to `motion_arcade_mark.svg` while explicitly reserving trademark/brand rights.

## Publication blockers

- [x] Resolve provenance for tracked homepage v2 artwork in `public/assets/home/`.
- [x] Finalize the public asset license/permission statement for the project-controlled homepage v2 artwork and `motion_arcade_mark.svg`: CC BY 4.0 for copyright/similar rights to the extent held, with Motion Arcade trademark/brand rights reserved.
- [x] Verify that Pixabay MP3 files can be removed from the public OSS history without losing project history or core source files. The proven filter step is `git filter-repo --path public/audio --invert-paths --force`.
- [ ] Apply the proven `public/audio/` history filter to the final sanitized public mirror after all other removal decisions are finalized.
- [x] Verify the GitHub noreply identity and prove personal Gmail can be removed from all author/committer metadata without pruning history.
- [x] Verify historical local Windows account paths can be generalized to `%USERPROFILE%` throughout all public refs without pruning history.
- [x] Resolve redistribution terms for `public/vendor/mediapipe/models/pose_landmarker_lite.task`: Google official documentation/model card supports the exact Lite model family and specifies Apache License 2.0; preserve the upstream notice/provenance.
- [x] Produce and manually review an exact third-party dependency-license inventory from the lockfile; no unresolved dependency license blocker remains for the current graph.
- [ ] Review the final post-license sanitized mirror for internal-only information after all asset decisions are applied.

## Final alpha-release checks

- [ ] Rebase or merge the latest `main` into `oss-prep` and resolve documentation conflicts.
- [ ] Run `npm ci`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run final full-history gitleaks scan on the exact mirror that will become public and confirm 0 findings.
- [ ] Confirm no personal Gmail or user-specific local Windows path remains in any public ref.
- [ ] Confirm no tracked PENDING/BLOCKED asset remains without an explicit disposition.
- [ ] Update package/package-lock version together for the selected alpha version.
- [ ] Change the sanitized repository visibility to Public only after every publication blocker above is closed.
- [ ] Create the first public alpha release/tag.
- [ ] Submit the Codex for OSS application using the public sanitized repository URL.

## Audit evidence (2026-09-16)

### History sanitization dry run

- Source repository: unchanged.
- Disposable mirror: created outside the working copy.
- Backup bundle: created before rewriting history.
- Commit count: 87 before / 87 after.
- Branches: 2.
- Tags: 0.
- `git log --all -- public/audio`: no commits after filtering.
- Remaining `public/audio` paths: 0.
- Remaining MP3 blobs: 0.
- `src/`, `docs/`, `package.json`, homepage assets, and the MediaPipe pose model all remained present.
- No push was performed.

### Secret / privacy audit

- Gitleaks: 8.30.0 from official `gitleaks/gitleaks` GitHub release; checksum verified.
- Scan scope: complete sanitized Git history, all refs.
- Secret findings: 0 throughout the dry-run sanitization chain.
- Patient-identifying data: none found.
- Institution-identifying data: none found.
- Credentials/private server addresses: none found.
- Commit identity dry run: `[redacted personal email]` reduced to 0 occurrences; author identity uses `249893203+jeiwu1020@users.noreply.github.com` and GitHub-generated `noreply@github.com` remains valid.
- Local-path dry run: `%USERPROFILE%\...` reduced to 0 occurrences and generalized to `%USERPROFILE%\...`; no specific `%USERPROFILE%\...` paths remained.
- Commit count stayed 87 after both privacy rewrites; no unexpected pruning occurred.
- Original source repository, first sanitized mirror, and prior privacy-test mirrors remained unchanged; no push was performed.

### Homepage v2 provenance and license

- Project conversation date: 2026-08-28.
- An earlier homepage-art pass produced cleaned/cropped production candidates.
- The later canonical v2 pass explicitly replaced those with five newly generated standalone originals: `home_lobby_bg_v2`, `category_sports_v2`, `category_party_v2`, `category_voice_v2`, and `category_hand_v2`.
- The maintainer confirms these v2 originals were generated through ChatGPT/OpenAI image generation under the maintainer's direction.
- OpenAI Terms of Use state that, as between the user and OpenAI and to the extent permitted by applicable law, the user owns Output and OpenAI assigns any rights it has in Output to the user.
- Project-controlled rights in the v2 visual assets are licensed under CC BY 4.0 to the extent such rights exist.
- `motion_arcade_mark.svg` is pure project SVG vector markup; its copyright/similar rights are also licensed under CC BY 4.0 while trademark/brand rights remain reserved.

### MediaPipe model licensing

- Tracked model: `public/vendor/mediapipe/models/pose_landmarker_lite.task`.
- Official source: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`.
- Official model family: BlazePose GHUM 3D Lite / Full / Heavy.
- Official model card: `https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf`.
- License: Apache License 2.0.

### Dependency license audit

- Exact install: `npm ci` from the current lockfile.
- Unique packages: 59.
- Classification: 53 permissive, 4 Apache-2.0/notice-review, 2 MPL-2.0 transitive build packages, 0 unknown/custom.
- Copyleft manual review: `lightningcss@1.33.0` and `lightningcss-win32-x64-msvc@1.33.0`; cleared for the current publication model because MPL is file-level copyleft and these packages remain transitive build dependencies rather than vendored Motion Arcade source.
- No GPL/LGPL/AGPL dependency was found.
- No package-local NOTICE file was found in the audited graph.
- Canonical Apache-2.0 license text is preserved at `third_party/licenses/Apache-2.0.txt`.

## Safety rule

Do not interpret the presence of the MIT `LICENSE` as permission to redistribute media or third-party assets. `ASSET_LICENSES.md` and upstream terms control those items.
