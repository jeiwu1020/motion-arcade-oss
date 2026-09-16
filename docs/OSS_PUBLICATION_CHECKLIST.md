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

## Publication blockers

- [ ] Resolve provenance / redistribution rights for all tracked homepage artwork in `public/assets/home/`.
- [x] Verify that Pixabay MP3 files can be removed from the public OSS history without losing project history or core source files. The proven filter step is `git filter-repo --path public/audio --invert-paths --force`.
- [ ] Apply the proven `public/audio/` history filter to the final sanitized public mirror after all other removal decisions are finalized.
- [x] Verify the GitHub noreply identity and prove personal Gmail can be removed from all author/committer metadata without pruning history.
- [ ] Sanitize historical local Windows account paths in `docs/SKILLS_AND_RESEARCH.md`. The current document contains `%USERPROFILE%\.codex\...`; replace the user-specific prefix with `%USERPROFILE%\...` throughout all refs in the public mirror.
- [ ] Resolve authoritative redistribution terms for `public/vendor/mediapipe/models/pose_landmarker_lite.task`, or remove it from the public history and replace it with a documented setup/download step.
- [ ] Produce an exact third-party dependency-license inventory from the final lockfile and preserve required notices.
- [ ] Review all remaining docs for internal-only information after the local-path history sanitization pass.

## Final alpha-release checks

- [ ] Rebase or merge the latest `main` into `oss-prep` and resolve documentation conflicts.
- [ ] Run `npm ci`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run final full-history gitleaks scan on the exact mirror that will become public and confirm 0 findings.
- [ ] Confirm no personal Gmail or local Windows account path remains in any public ref.
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
- Secret findings: 0 before and after the privacy-test email rewrite.
- Patient-identifying data: none found.
- Institution-identifying data: none found.
- Credentials/private server addresses: none found.
- Commit identity dry run: `[redacted personal email]` reduced to 0 occurrences; author identity now uses `249893203+jeiwu1020@users.noreply.github.com` and GitHub-generated `noreply@github.com` remains valid.
- Remaining public-history privacy item: historical local Windows account path `%USERPROFILE%\...` in `docs/SKILLS_AND_RESEARCH.md`.

## Safety rule

Do not interpret the presence of the MIT `LICENSE` as permission to redistribute media or third-party model assets. `ASSET_LICENSES.md` and upstream terms control those items.
