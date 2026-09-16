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

## Publication blockers

- [ ] Resolve provenance / redistribution rights for all tracked homepage artwork in `public/assets/home/`.
- [ ] Replace/remove Pixabay MP3 files from the public OSS snapshot **and** ensure the history made public never contains the raw MP3 files.
- [ ] Choose the history strategy: sanitize the existing repository history (preferred if safely performed, because it preserves maintenance history) or publish a clean sanitized OSS history/repository.
- [ ] Resolve authoritative redistribution terms for `public/vendor/mediapipe/models/pose_landmarker_lite.task`, or remove it from the public history and replace it with a documented setup/download step.
- [ ] Produce an exact third-party dependency-license inventory from the final lockfile and preserve required notices.
- [ ] Run a full local Git-history secret scan (for example, gitleaks or trufflehog) before changing repository visibility.
- [ ] Review all docs for accidental personal, institutional, patient, credential, local-path, or internal-only information.

## Final alpha-release checks

- [ ] Rebase or merge the latest `main` into `oss-prep` and resolve documentation conflicts.
- [ ] Run `npm ci`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Confirm no tracked PENDING/BLOCKED asset remains without an explicit disposition.
- [ ] Update package/package-lock version together for the selected alpha version.
- [ ] Change repository visibility to Public only after every publication blocker above is closed.
- [ ] Create the first public alpha release/tag.
- [ ] Submit the Codex for OSS application using the public repository URL.

## Safety rule

Do not interpret the presence of the MIT `LICENSE` as permission to redistribute media or third-party model assets. `ASSET_LICENSES.md` and upstream terms control those items.
