# Dependency License Audit

Audit date: 2026-09-16

This document records the pre-publication license review of the exact dependency graph installed from `package-lock.json` with `npm ci`.

## Summary

- Unique packages: 59
- Direct runtime dependencies: 4
- Direct development dependencies: 8
- Transitive dependencies: 47
- Permissive: 53
- Apache-2.0 / notice-review: 4
- MPL-2.0 manual review: 2
- Unknown/custom: 0
- GPL/LGPL/AGPL findings: 0

## Direct dependencies

| Package | Version | License | Review status |
|---|---:|---|---|
| `@mediapipe/tasks-vision` | 1.0.1 | Apache-2.0 | Cleared; Apache license copy preserved in `third_party/licenses/Apache-2.0.txt` |
| `phaser` | 4.2.1 | MIT | Cleared |
| `react` | 19.2.8 | MIT | Cleared |
| `react-dom` | 19.2.8 | MIT | Cleared |
| `@types/node` | 24.13.3 | MIT | Cleared |
| `@types/react` | 19.2.18 | MIT | Cleared |
| `@types/react-dom` | 19.2.5 | MIT | Cleared |
| `@vitejs/plugin-react` | 6.1.0 | MIT | Cleared |
| `oxlint` | 1.80.0 | MIT | Cleared |
| `typescript` | 6.0.3 | Apache-2.0 | Cleared; development dependency |
| `vite` | 8.2.2 | MIT | Cleared |
| `vitest` | 4.1.11 | MIT | Cleared |

## Apache-2.0 packages

The audited dependency graph contains:

- `@mediapipe/tasks-vision@1.0.1`
- `typescript@6.0.3`
- `detect-libc@2.1.2`
- `expect-type@1.4.0`

No package-local `NOTICE`, `NOTICE.txt`, or `NOTICE.md` file was found for the audited installed versions. The canonical Apache License 2.0 text is preserved at `third_party/licenses/Apache-2.0.txt` for the Apache-licensed material that Motion Arcade actually redistributes, especially the MediaPipe model/runtime assets.

## MPL-2.0 review

The two packages initially flagged for manual review are:

- `lightningcss@1.33.0`
- `lightningcss-win32-x64-msvc@1.33.0`

Dependency chain:

`Motion Arcade dev dependency -> Vite -> Lightning CSS -> platform package`

Disposition: **CLEARED FOR THIS PUBLICATION MODEL**.

Rationale:

- Both packages are transitive development/build dependencies rather than direct Motion Arcade runtime dependencies.
- Motion Arcade does not vendor their source files into the repository.
- The public repository does not include `node_modules`.
- Mozilla describes MPL 2.0 as file-level copyleft: MPL obligations remain with MPL-covered files and do not relicense unrelated files in a Larger Work.
- If a future Motion Arcade release directly redistributes or modifies Lightning CSS source/binaries, that distribution must preserve the applicable MPL-2.0 obligations for the covered files.

Upstream project: `https://github.com/parcel-bundler/lightningcss`

## Unknown / custom licenses

None found in the audited graph.

## Audit artifacts

The local audit generated the following non-repository evidence files:

- `dependency-license-inventory.json`
- `dependency-license-summary.csv`
- `dependency-tree.json`

These audit artifacts are intentionally not committed to the project repository.

## Release rule

Re-run the dependency-license audit if `package-lock.json` changes materially before the first public release or when dependencies are upgraded to new major/minor versions with changed license metadata.
