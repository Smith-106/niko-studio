# Context: Close current-head release-readiness blockers

**Date**: 2026-05-12
**Mode**: full
**Requested skill call**: `$maestro-analyze "Close current-head release-readiness blockers: unify version consistency, reconcile desktop capability contract, rerun desktop gates, refresh current-head release evidence, resolve unresolved triage blocker semantics, and align readiness docs." -y`

## Executive Summary

Current-head release readiness remains `NO_GO`. The repository's governance contract is present and internally aligned, but the current head is blocked by a real closure gap between version authority, desktop validation surfaces, retained evidence freshness, and triage blocker accounting.

## Decisions

### Decision 1: Version authority must be unified before any release-proof refresh
- **Context**: `check_versions.py` uses `src-ts/config/index.ts:APP_VERSION` (`9.2.5`) as the expected release version, while desktop metadata is already `9.13.0`.
- **Options**:
  1. Treat `src-ts` as release authority and roll desktop metadata back to `9.2.5`.
  2. Promote desktop release metadata to the current authority and update scripts/docs accordingly.
- **Chosen**: Unify authority first, then align all metadata and release scripts to that choice.
- **Reason**: Same-head evidence refresh is not trustworthy while the repository still disagrees on the release version.

### Decision 2: Desktop capability contract must have one explicit truth
- **Context**: strict sidecar validation expects the frontend capability boundary to be `core:default` only, but `main-desktop.json` currently grants updater and fs permissions too.
- **Options**:
  1. Narrow capability permissions to `core:default` only.
  2. Keep the broader permissions and update validator/docs to match.
- **Chosen**: Reconcile validator, capability file, and docs to one contract before claiming desktop gate readiness.
- **Reason**: Current HEAD fails strict validation because policy and implementation disagree.

### Decision 3: Retained release evidence refresh is a finalization step, not an exploratory step
- **Context**: `writing_helper_acceptance_signal` and `package_e2e_acceptance_signal` fail because retained artifacts are stale/superseded.
- **Options**:
  1. Refresh retained evidence immediately.
  2. Fix current blocking gates first, then regenerate retained proof on the corrected head.
- **Chosen**: Fix blocking gates first.
- **Reason**: Refreshing evidence on a still-red head produces newer artifacts but does not improve the release decision.

### Decision 4: Triage blocker semantics need targeted reconciliation, not blanket relaxation
- **Context**: release summary reports 115 unresolved triage records, but a direct parseable active-state scan in this checkout did not reproduce a current unresolved sample.
- **Options**:
  1. Keep current blocker semantics unchanged.
  2. Disable unresolved triage as a release blocker.
  3. Separate invalid/legacy state-file noise from real unresolved triage states.
- **Chosen**: Reconcile the signal implementation and scanned artifact population before changing severity.
- **Reason**: The repo still needs a hard blocker for real unresolved workflow states, but current accounting appears noisy.

## Constraints

### Locked
- Do not claim `GO` while `release-check-summary.md` and `.workflow/evidence/release/release-readiness-artifact.json` remain `NO_GO`.
- Do not refresh retained release evidence until version authority and desktop gate failures are fixed.
- Keep `delivery_gate.py` and `check_authority_alignment.py` green while closing the remaining blockers.

### Free
- The version authority can be anchored to either `src-ts` or desktop release metadata, as long as all dependent files and scripts converge on the same choice.
- The desktop boundary can be narrowed or the validator can be widened, as long as docs, config, and strict validation all match.

### Deferred
- Broader cleanup of historical `.workflow/active` state-file noise may happen after the release blocker semantics are accurately separated into `unresolved` versus `invalid/legacy`.

## Code Context

- Version authority:
  - `scripts/check_versions.py`
  - `src-ts/config/index.ts`
  - `desktop/package.json`
  - `desktop/src-tauri/tauri.conf.json`
  - `desktop/src-tauri/Cargo.toml`
- Desktop capability boundary:
  - `desktop/scripts/validate_sidecar_contract.cjs`
  - `desktop/src-tauri/capabilities/main-desktop.json`
- Release evidence and decision:
  - `scripts/release_check_summary.py`
  - `release-check-summary.md`
  - `.workflow/evidence/release/release-readiness-artifact.json`
- Retained acceptance proof:
  - `.workflow/evidence/release/writing-helper-acceptance.json`
  - `.workflow/evidence/release/package-e2e-acceptance.json`
