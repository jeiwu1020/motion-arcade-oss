# OSS History Sanitization Plan

Goal: publish Motion Arcade as an OSS project without exposing tracked media whose redistribution rights are unsuitable or unresolved, while preserving meaningful development history.

## Recommended strategy

Keep the existing `jeiwu1020/motion-arcade` repository private as the source/development repository during the OSS preparation process.

Create a separate private sanitized mirror from a full clone, rewrite only disallowed/unresolved asset paths, validate it, then make **that sanitized mirror** public after the publication checklist passes.

This is safer than force-rewriting the current development repository and still preserves commit authorship, dates, messages, and most project history (commit SHAs will change after filtering).

## Paths confirmed for removal from public history

### Required

- `public/audio/`

Reason: the tracked MP3 files were sourced from Pixabay. Pixabay allows use inside larger creative works but prohibits standalone redistribution. A public Git repository makes the raw MP3 files directly downloadable.

### Pending decision / provenance review

- `public/assets/home/` (or selected subpaths)
- `public/vendor/mediapipe/models/pose_landmarker_lite.task`

Do not remove these automatically until their final provenance/license decision is recorded in `ASSET_LICENSES.md`.

## Safe local procedure

Perform this only on a disposable mirror clone, never directly inside the normal working copy.

```bash
# 1. Mirror-clone the private source repository.
git clone --mirror git@github.com:jeiwu1020/motion-arcade.git motion-arcade-oss-sanitize.git
cd motion-arcade-oss-sanitize.git

# 2. Keep an offline backup before rewriting history.
git bundle create ../motion-arcade-before-oss-sanitize.bundle --all

# 3. Remove Pixabay audio from every commit.
git filter-repo --path public/audio --invert-paths --force

# Add additional --path ... entries only after they are explicitly approved
# for removal in ASSET_LICENSES.md.

# 4. Verify the removed paths no longer exist anywhere in rewritten history.
git log --all -- public/audio

# Expected: no commits.
```

`git filter-repo` commonly removes the original remote as a safety feature. Do not immediately force-push back to the source repository.

## Staging the sanitized history

Create a new **private** GitHub repository for the sanitized mirror, then push all rewritten refs there for review. Use a clearly temporary/private name until QA is complete.

After pushing:

1. apply or cherry-pick the OSS-preparation documentation changes;
2. confirm the current tree contains no blocked media;
3. run a full history secret scan;
4. run dependency-license inventory;
5. run CI/build/tests;
6. review README and all public docs;
7. only then change the sanitized repository visibility to Public.

## Secret scan

At minimum, scan the complete rewritten history with a dedicated scanner such as gitleaks or trufflehog. The earlier GitHub audit found no tracked root `.env` / `.env.local`, but that is not a substitute for a full history scanner.

## Do not

- do not force-push rewritten history over the existing private development repository during preparation;
- do not make either repository public while `ASSET_LICENSES.md` contains unresolved public-release blockers;
- do not assume deleting a file in the latest commit removes it from old Git history;
- do not treat the repository MIT license as a license for third-party media.
