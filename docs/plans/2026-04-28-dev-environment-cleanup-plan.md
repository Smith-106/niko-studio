# Niko Studio Development Environment Cleanup Plan

**Date**: 2026-04-28  
**Scope**: Current repository working tree only (`D:/工作目录/niko-studio`)  
**Goal**: Produce a cautious, reviewable cleanup plan for build/cache artifacts and development-environment sprawl without deleting runtime data, release evidence, or active workflow state.

---

## 1. Project state summary

This repository is a mixed-stack desktop product:

- **Primary shipped runtime**: `desktop/` (React + Tauri) + `src-ts/` (Node/TypeScript gateway) — see `README.md:10`, `README.md:85`
- **Python role**: governance scripts, release helpers, compatibility surfaces — see `README.md:32`, `requirements.txt:1`
- **Persistent local runtime data**: `.writing/` is the configured `data_dir` — see `config/niko-studio.yaml:7`
- **Workflow / release evidence**: `.workflow/evidence/` is referenced by docs and release notes, not disposable by default — see `.workflow/evidence/README.md:1`, `docs/release/RELEASE_NOTES.md:131`
- **Tracked sidecar binaries exception**: `desktop/src-tauri/bin/niko-gateway-node` and `.cmd` are intentionally tracked, while most sibling binaries are ignored — see `.gitignore:74`, Bash `git ls-files -- desktop/src-tauri/bin`
- **Worktree scope**: repo-local registered worktrees currently exist under `.claude/worktrees/` and `.ccw/batch-worktrees/`, while separate external worktrees also exist under `C:/Users/32852/.codex/worktrees/...`; this plan covers only the repo-local paths under `D:/工作目录/niko-studio`

Current high-volume candidates observed:

- `desktop/src-tauri/target/` — ~6.0G
- `src-ts/node_modules/` — ~725M
- `desktop/node_modules/` — ~212M
- `desktop/dist/` — ~77M
- `.claude/worktrees/` — ~1019M
- `.ccw/` — ~247M
- `.workflow/` — ~3.3M
- `.writing/` — ~1.2M

---

## 2. Cleanup principles

1. **Do not delete anything merely because it is ignored by git.** Many ignored paths are still active runtime state or workflow evidence.
2. **Protect runtime data and evidence first.** `.writing/`, `.workflow/evidence/`, and tracked sidecar entry files are not normal cache directories.
3. **Separate cleanup into tiers.**
   - Tier A: safe build/cache/log cleanup now
   - Tier B: conditional cleanup after checks
   - Tier C: protected / no-delete by default
4. **Do not remove git worktree directories manually.** Use worktree-aware cleanup only after confirming registration state.
5. **Prefer reversible cleanup steps.** Remove regenerated outputs first; leave source, plans, evidence, and stateful data untouched.

---

## 3. Tier A — Safe to delete now

These are generated artifacts or local logs that are safe to regenerate from the documented toolchain.

### A1. Dependency installs

- `desktop/node_modules/`
- `src-ts/node_modules/`

**Why safe**: these are the two documented npm workspaces with lockfiles and rebuildable installs; they are gitignored and restored via npm install/ci — see `.gitignore:59`, `.gitignore:60`, `desktop/package.json:6`, and `src-ts/package.json:6`.

**Important qualification**: the repo currently has a top-level `node_modules/`, but there is no root `package.json` in this checkout. Treat that top-level directory as **conditional cleanup**, not automatic-safe cleanup.

### A2. Frontend/backend build outputs

- `desktop/dist/`
- `src-ts/dist/`
- `desktop/src-tauri/gen/`
- `.workflow/.analysis/` (if present)
- `.workflow/.scratchpad/` (if present)
- `test-results/` (if present)
- `desktop/test-results/`
- `src-ts/coverage/` (if present)
- `.pytest_cache/`
- `.vite/`
- `coverage.xml` (if present)
- `pytest-*.xml` (if present)
- `docs/contracts/__pycache__/`
- `scripts/__pycache__/`
- `tests/unit/scripts/__pycache__/`

**Why safe**: all are build/test/transient outputs or ignored workflow scratch areas and are covered by ignore rules such as `.gitignore:37`, `.gitignore:54`, `.gitignore:55`, `.gitignore:61`, `.gitignore:63`, `.gitignore:64`, `.gitignore:100`.

### A2b. Large Tauri target tree — conditional, not default-safe

- `desktop/src-tauri/target/`

**Do not treat this as an automatic Tier A deletion.** It is mostly regenerable build output, but release sign-off docs also retain specific validated proof artifacts under this tree, including:

- `desktop/src-tauri/target/x86_64-pc-windows-msvc/debug/niko-studio-desktop.exe`
- `desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.0.8_x64-setup.exe`
- `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_en-US.msi`
- `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_zh-CN.msi`

These are explicitly listed as retained release proof artifacts in `docs/release/SIGN_OFF.md:201` and `docs/release/SIGN_OFF.md:203`.

**Rule**: only delete `desktop/src-tauri/target/` after one of the following is true:
1. you have copied out the exact retained proof artifacts you care about, or
2. you explicitly accept losing the local retained packaging proof and are willing to regenerate it later.


### A3. Local transient logs / snapshots

- `gateway.log`
- `gateway.err`
- `desktop/pytest_full.log`
- `desktop/typecheck.log`
- `src-ts/phase4-memory-debug.log`

**Why safe**: these are generated local logs and are gitignored — see `.gitignore:46`, `.gitignore:67`.

**Expected result**: recover substantial space immediately, primarily from the documented `desktop/node_modules/` and `src-ts/node_modules/` trees, plus regenerated build/test outputs and local logs.

---

## 4. Tier B — Conditional cleanup after explicit checks

These paths may be cleanable, but only with prerequisites and tool-aware handling.

### B1. `.claude/worktrees/`

**Observed**: ~1019M, and multiple registered git worktrees exist under this directory.

**Do not** delete this directory directly.

**Why caution is required**:
- `git worktree list --porcelain` shows active registered worktrees in `.claude/worktrees/...`
- manual deletion can leave broken git worktree metadata or lose in-progress agent state

**Conditional cleanup rule**:
1. enumerate registered worktrees
2. decide which are stale
3. remove each stale worktree with git-aware commands, not raw file deletion
4. re-run `git worktree list` to verify consistency

**Prerequisite**: confirm none of these worktrees are still used by current Claude/agent sessions.

### B2. Root `node_modules/`

**Observed**: a top-level `node_modules/` directory exists, but this checkout does not currently have a root `package.json`.

**Why caution is required**:
- it is gitignored, but not clearly tied to a documented workspace in the current repository contract
- it may have been created by an auxiliary tool or an older workflow

**Conditional cleanup rule**:
- safe to remove only if you intentionally want to clear undocumented top-level dependencies
- if uncertain, treat it as a low-priority cleanup target rather than part of the first automatic pass

### B3. `.ccw/`

**Observed**: ~247M; contains `batch-worktrees/`, `specs/`, `personal/`, `worktrees/`.

**Why caution is required**:
- repo-local CCW batch worktrees are registered git worktrees (`.ccw/batch-worktrees/s1`, `s2`, `s3`, `s5`)
- this directory also appears to contain CCW state/config, not just cache

**Conditional cleanup rule**:
- only remove stale batch worktrees through worktree-aware commands
- preserve reusable CCW config/spec folders unless user explicitly wants a CCW reset

### B4. `release-check-summary.md`

**Observed**: ignored local summary snapshot, but also one of the retained production-contract evidence items in sign-off docs.

**Why caution is required**:
- it is explicitly retained in `docs/release/SIGN_OFF.md:151` and `docs/release/SIGN_OFF.md:195`
- the current file is historical for a different HEAD (`release-check-summary.md:60`) than the repo snapshot used in this session, so it should not be treated as fresh proof for current HEAD

**Conditional cleanup rule**:
- keep it if you want to preserve prior local sign-off evidence
- if you remove it, do so intentionally and plan to regenerate it with `python scripts/release_check_summary.py` before any future GO claim

### B5. `.codex-run/`

**Observed**: small (~10K), likely launcher/runtime state.

**Conditional cleanup rule**:
- safe only if the user wants to reset local launcher/session state
- otherwise preserve

### B6. `desktop/src-tauri/bin/` ignored binaries

Current directory contains both tracked and ignored files:

- **Tracked and protected**:
  - `desktop/src-tauri/bin/niko-gateway-node`
  - `desktop/src-tauri/bin/niko-gateway-node.cmd`
- **Ignored and removable as generated artifacts**:
  - `desktop/src-tauri/bin/niko-gateway`
  - `desktop/src-tauri/bin/niko-gateway.cmd`
  - `desktop/src-tauri/bin/niko-gateway.exe`
  - `desktop/src-tauri/bin/niko-gateway-x86_64-pc-windows-msvc.exe`

**Rule**:
- remove only ignored entries in this directory
- never remove the tracked `niko-gateway-node*` pair
- if you rely on packaged compatibility verification, note that the `.exe` artifacts may need to be re-hydrated before the next sign-off run

### B7. Workflow retention policy review

**Observed**:
- `.workflow/active/WFS-narrative-authority-architecture/workflow-session.json` says `status: "completed"`
- `.workflow/.team/`, `.workflow/.csv-wave/`, `.workflow/.lite-plan/`, `.workflow/.review-module/` contain tracked planning/review history

**Why caution is required**:
- these directories currently contain tracked repository files
- docs and release notes reference workflow evidence and history
- sign-off also depends on workflow metadata such as `.workflow/issues/issue-history.jsonl`

**Conditional review rule**:
- do not delete these directories as part of environment cleanup
- if the project later wants history reduction, treat it as a repository-content pruning decision, not local cache cleanup
- keep `.workflow/evidence/`, `.workflow/issues/issue-history.jsonl`, manifests, and index/metadata files by default

---

## 5. Tier C — Protected, do not delete by default

### C1. `.writing/`

**Reason**: active runtime data store configured in `config/niko-studio.yaml:7`, with graph/vector/session/token DB files present. Deleting this is a data reset, not cleanup.

### C2. `.workflow/evidence/`

**Reason**: explicitly documented evidence contract and release traceability surface — see `.workflow/evidence/README.md:1` and `docs/release/RELEASE_NOTES.md:131`.

### C3. `.workflow/project-tech.json`, `.workflow/project-guidelines.json`, `.workflow/archives/manifest.json`, `.workflow/issues/issue-history.jsonl`

**Reason**: project workflow metadata, archive indexes, and retained issue-history state; sign-off logic explicitly depends on `.workflow/issues/issue-history.jsonl`.

### C4. `desktop/src-tauri/bin/niko-gateway-node` and `desktop/src-tauri/bin/niko-gateway-node.cmd`

**Reason**: tracked source-controlled sidecar entry artifacts.

### C5. `.env`, `desktop/.env.local`, secrets, config, and top-level docs/plans

**Reason**: configuration or authored documentation, not cache.

### C6. `.niko-studio/`, `src-ts/.niko-studio/`

**Reason**: small, state-like directories; unclear value but not worth deleting without intent to reset local state.

### C7. `.workflow/.team/`, `.workflow/.csv-wave/`, `.workflow/.lite-plan/`, `.workflow/.review-module/`, `.workflow/active/`

**Reason**: these are not merely disposable scratch directories in this repository. They currently contain tracked project files and workflow history that would remove repo content if deleted. A completed entry may still be an archive/prune candidate later, but not a blind-delete target.

### C8. Repo-local release and workflow proofs inside tracked trees

**Reason**: tracked workflow/review/planning files under `.workflow/**` should be treated as repository content first, even when neighboring paths are ignored.

### C9. External Codex worktrees outside the repo root

**Reason**: `git worktree list` also shows detached worktrees under `C:/Users/32852/.codex/worktrees/...`, but they are outside this repository tree and not part of a repo-local cleanup pass.

---

## 6. Recommended phased cleanup execution plan


### Phase 1 — Low-risk disk recovery

Delete only Tier A paths.

This should recover the vast majority of space while preserving:
- all runtime data
- all workflow evidence
- all tracked artifacts
- all worktree metadata/state

### Phase 2 — Worktree hygiene review

Review repo-local worktrees as a separate operation:

- repo-local Claude/CCW worktrees under `.claude/worktrees/` and `.ccw/batch-worktrees/`
- distinguish these from detached external Codex worktrees under `C:/Users/32852/.codex/worktrees/*`, which also appear in `git worktree list` but are outside this repository tree

1. map each repo-local worktree to purpose / owner / last known use
2. identify stale ones
3. remove stale ones with git-aware workflow
4. confirm `git worktree list` is clean afterward

### Phase 3 — Workflow state pruning policy

Decide whether this repo should keep all historical CCW/Claude workflow artifacts or only release-grade evidence.

If pruning is desired, define retention rules such as:
- keep `.workflow/evidence/**`
- keep archive manifests and current active session skeleton
- prune old `.workflow/.csv-wave/**`, `.workflow/.team/**`, and completed scratch coordinator runs after export/archive

### Phase 4 — Optional environment reset tier

Only if explicitly requested later:
- clear `.codex-run/`
- clear `.niko-studio/` state dirs
- remove ignored sidecar binaries except tracked `niko-gateway-node*`

---

## 7. Verification checklist after cleanup

After any deletion pass:

1. `git status --ignored --short` — verify only expected ignored paths disappeared
2. reinstall dependencies if needed:
   - `npm ci` in `src-ts/`
   - `npm ci` in `desktop/`
3. verify authoritative local path:
   - `npm --prefix src-ts run typecheck`
   - `npm --prefix desktop run typecheck`
4. if Tauri artifacts were removed and desktop dev is needed:
   - `npm --prefix desktop run build:sidecar`
   - `npm --prefix desktop run validate:sidecar-contract`
5. if workflow worktrees were touched:
   - `git worktree list`
6. if any workflow retention pruning was done:
   - ensure docs/release references still point to existing evidence paths

---

## 8. Plan refinements from final review

The final review tightened several important boundaries:

- `desktop/src-tauri/target/` remains conditional cleanup because release sign-off docs retain specific proof artifacts under that tree.
- `release-check-summary.md` remains conditional/protected evidence handling because sign-off docs explicitly retain it even though it is gitignored.
- tracked workflow directories such as `.workflow/.team/`, `.workflow/.csv-wave/`, `.workflow/.lite-plan/`, `.workflow/.review-module/`, and `.workflow/active/` are protected by default instead of being treated as disposable scratch history.
- automatic dependency cleanup is limited to the two documented npm workspaces (`desktop/` and `src-ts/`); top-level `node_modules/` is conditional because this checkout has no root `package.json`.
- `.workflow/.analysis/` and `.workflow/.scratchpad/` are called out as safe ignored workflow scratch paths when present.
- `desktop/src-tauri/bin/` cleanup is now explicitly ignored-entry-only, never the tracked `niko-gateway-node*` pair.
- repo-local worktrees under `.claude/worktrees/` and `.ccw/batch-worktrees/` are now distinguished from external Codex worktrees under `C:/Users/32852/.codex/worktrees/...`, so the plan stays within the repository root.
- `.workflow/evidence/` remains protected even though it is gitignored, because it currently contains tracked repository evidence.

---

## 9. Proposed “perfect plan” boundary

For this repository, a “good” cleanup plan is **not** one that deletes every ignored file. It is one that:

- aggressively removes regenerated artifacts
- preserves runtime data and release evidence
- treats worktrees as git-managed resources
- separates disk cleanup from workflow-history policy decisions
- keeps the repo able to return to the documented `desktop + src-ts` authoritative path quickly

---

## 10. Current recommendation

**Recommended immediate action**: execute Tier A, plus optionally remove ignored `desktop/src-tauri/bin/` artifacts other than tracked `niko-gateway-node*`, while still excluding `desktop/src-tauri/target/`.  
**Recommended second-pass action**: review `.claude/worktrees/`, `.ccw/batch-worktrees/`, `desktop/src-tauri/target/`, top-level `node_modules/`, and retained release evidence individually before any deletion.  
**Do not touch yet**: `.writing/`, tracked `.workflow/**` history and metadata, `.workflow/evidence/`, `release-check-summary.md` (unless intentionally regenerating/removing stale proof), tracked `desktop/src-tauri/bin/niko-gateway-node*`, `.workflow/issues/issue-history.jsonl`, and generic workflow metadata.

---

## 11. Final cleanup execution checklist

### Immediate-delete items

Delete these first, in one low-risk pass:

- `desktop/node_modules/`
- `src-ts/node_modules/`
- `desktop/dist/`
- `src-ts/dist/`
- `desktop/src-tauri/gen/`
- `.workflow/.analysis/` (if present)
- `.workflow/.scratchpad/` (if present)
- `test-results/` (if present)
- `desktop/test-results/`
- `src-ts/coverage/` (if present)
- `.pytest_cache/`
- `.vite/`
- `coverage.xml` (if present)
- `pytest-*.xml` (if present)
- `docs/contracts/__pycache__/`
- `scripts/__pycache__/`
- `tests/unit/scripts/__pycache__/`
- `gateway.log`
- `gateway.err`
- `desktop/pytest_full.log`
- `desktop/typecheck.log`
- `src-ts/phase4-memory-debug.log`
- optional in the same pass if desired: ignored `desktop/src-tauri/bin/` entries other than `niko-gateway-node*`

### Confirm-first items

Do not delete these until the specific confirmation is complete:

- `desktop/src-tauri/target/`
  - confirm you do not need retained local release proof artifacts under this tree, or copy them out first
- `release-check-summary.md`
  - confirm you do not need prior local sign-off evidence, or plan to regenerate it before the next GO claim
- top-level `node_modules/`
  - confirm you intentionally want to clear undocumented root dependencies
- `.claude/worktrees/`
  - confirm which repo-local Claude worktrees are stale and remove them with git-aware worktree commands only
- `.ccw/batch-worktrees/`
  - confirm which repo-local CCW batch worktrees are stale and remove them with git-aware worktree commands only
- `.codex-run/`
  - confirm you want a local launcher/session-state reset
- `.niko-studio/`, `src-ts/.niko-studio/`
  - confirm you want a local state reset
- external `C:/Users/32852/.codex/worktrees/...`
  - out of scope for repo-local cleanup; only touch in a separate explicit operation

### Protected items

Do not delete these in the cleanup run:

- `.writing/`
- `.workflow/evidence/`
- `.workflow/.team/`
- `.workflow/.csv-wave/`
- `.workflow/.lite-plan/`
- `.workflow/.review-module/`
- `.workflow/active/`
- `.workflow/project-tech.json`
- `.workflow/project-guidelines.json`
- `.workflow/archives/manifest.json`
- `.workflow/issues/issue-history.jsonl`
- tracked `desktop/src-tauri/bin/niko-gateway-node`
- tracked `desktop/src-tauri/bin/niko-gateway-node.cmd`
- `.env`, `desktop/.env.local`, and other secrets/config files
- authored docs/plans and tracked workflow history under `.workflow/**`

### Execution order

1. Delete all immediate-delete items except the optional `desktop/src-tauri/bin/` ignored binaries.
2. Re-check `git status --ignored --short` to confirm only expected ignored artifacts were removed.
3. If desired, delete ignored `desktop/src-tauri/bin/` entries while preserving tracked `niko-gateway-node*`.
4. Reinstall dependencies only where needed:
   - `npm ci` in `src-ts/`
   - `npm ci` in `desktop/`
5. Run basic verification:
   - `npm --prefix src-ts run typecheck`
   - `npm --prefix desktop run typecheck`
6. Only after the low-risk pass succeeds, decide separately on each confirm-first item.
7. If any worktrees are being cleaned, enumerate repo-local worktrees, remove stale ones with git-aware commands, then re-run `git worktree list`.
8. If any retained evidence is being removed, explicitly note that regeneration will be required before future release/sign-off claims.

### Post-cleanup verification

- `git status --ignored --short`
- `npm --prefix src-ts run typecheck`
- `npm --prefix desktop run typecheck`
- if sidecar/bin artifacts were removed:
  - `npm --prefix desktop run build:sidecar`
  - `npm --prefix desktop run validate:sidecar-contract`
- if `desktop/src-tauri/target/` was removed and desktop packaging/dev is needed later:
  - rebuild the required Tauri artifacts before relying on local packaging proof
- if any worktrees were touched:
  - `git worktree list`
- if any workflow retention pruning was done:
  - verify docs/release references still point to existing evidence paths

