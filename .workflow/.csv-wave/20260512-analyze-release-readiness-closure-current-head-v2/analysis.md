# Analysis Report -- Close current-head release-readiness blockers

## Executive Summary

- Overall assessment: `NO_GO`
- Confidence: `high`
- Current head: `1e75baf01c589a3306fb1f52f6a942c47d82cd66`
- Current release artifact: `.workflow/evidence/release/release-readiness-artifact.json`

The current head does not fail because release governance is missing. It fails because the implementation and retained evidence no longer agree on one current release contract. `python scripts/delivery_gate.py` and `python scripts/check_authority_alignment.py` both pass, but `python scripts/check_versions.py` fails, `python scripts/release_check_summary.py` regenerates a `NO_GO` artifact, `npm --prefix desktop run build:sidecar` fails during sidecar dependency hydration, and `npm --prefix desktop run validate:sidecar-contract` fails because the strict validator expects a narrower frontend capability boundary than the checked-in capability file currently grants.

## Dimension Scores

| Dimension | Score | Key Evidence |
|-----------|-------|-------------|
| Feasibility | 74 | Failures are localized to version authority, desktop capability/validator contract, sidecar packaging, stale retained evidence, and triage blocker accounting. |
| Impact | 93 | Closing these blockers directly affects the repo's ability to claim `Decision: GO` on current head. |
| Risk | 82 | Current retained proof is stale/superseded, desktop gate stack is red, and triage semantics may be over-reporting blockers. |
| Complexity | 68 | Changes span Python scripts, desktop package metadata, Tauri capability config, packaging scripts, and release docs. |
| Alignment | 95 | Existing docs already define these surfaces as blocking P0 release conditions. |
| Maintainability | 71 | Current authority is explicit but split; validator and config boundary are not self-consistent. |

## Verified Current-Head Evidence

### Passing checks

- `python scripts/delivery_gate.py` -> PASS
- `python scripts/check_authority_alignment.py` -> PASS (`96/96`)
- `python scripts/release_check_summary.py` regenerated `release-check-summary.md` and `.workflow/evidence/release/release-readiness-artifact.json`

### Blocking failures

1. `version_consistency`
   - `python scripts/check_versions.py` fails.
   - Expected version source is `src-ts/config/index.ts:APP_VERSION = 9.2.5`.
   - Mismatches:
     - `desktop/package.json = 9.13.0`
     - `desktop/src-tauri/tauri.conf.json = 9.13.0`
     - `desktop/src-tauri/Cargo.toml = 9.13.0`

2. `desktop_sidecar_readiness` and `desktop_check`
   - `npm --prefix desktop run build:sidecar` fails while hydrating `desktop/src-tauri/bin/sidecar/node_modules`.
   - Failure chain includes native dependency install under the bundled Node 20 target and ends inside `sharp` with `Cannot find module 'semver/functions/coerce'`.
   - This keeps `desktop_check`, `desktop_sidecar_readiness`, and `desktop_packaging_dry_run` red in the regenerated release artifact.

3. Desktop capability contract mismatch
   - `npm --prefix desktop run validate:sidecar-contract` fails in strict mode.
   - Validator expectation in `desktop/scripts/validate_sidecar_contract.cjs` is:
     - `capabilityPermissions.length === 1`
     - `capabilityPermissions[0] === 'core:default'`
   - Current `desktop/src-tauri/capabilities/main-desktop.json` grants:
     - `core:default`
     - `updater:default`
     - `fs:default`
     - `fs:allow-read-text-file`
     - `fs:allow-write-text-file`
     - `fs:allow-exists`
     - `fs:allow-mkdir`
     - `fs:allow-read-dir`
     - `fs:allow-remove`

4. Retained release evidence is stale for this head
   - `writing_helper_acceptance_signal` fails because the retained artifact is bound to older head/version:
     - retained head: `c6937b14c99338534cf24e7e7d6d04c1ad39d3e8`
     - current head: `1e75baf01c589a3306fb1f52f6a942c47d82cd66`
     - retained version: `9.2.5`
     - current artifact version: `9.13.0`
   - `package_e2e_acceptance_signal` fails for the same stale/superseded reason.

5. `unresolved_triage_blocker_signal`
   - Regenerated artifact reports:
     - `state_files_scanned=385`
     - `linked_triage_records=115`
     - `unresolved_triage_records=115`
     - `invalid_state_files=270`
     - blocker semantics: `triage_state_not_in_{resolved,rejected}`
   - Direct reproducible scan of parseable `.workflow/active/*/.data/state.json` in this checkout did not yield a current unresolved triage sample, which means the blocker logic or the scanned artifact pool needs reconciliation before this signal can be trusted as release authority.

## Risk Matrix

| Risk | Probability | Impact | Notes |
|------|-------------|--------|-------|
| Refreshing evidence before fixing gate failures | High | High | Produces fresh but still red proof and wastes operator cycles. |
| Relaxing triage semantics incorrectly | Medium | High | Could hide real unresolved workflow states. |
| Keeping split version authority | High | High | Leaves release scripts and desktop metadata permanently divergent. |
| Leaving desktop capability contract inconsistent | High | Medium | Validator remains red and docs overstate the actual boundary. |

## Recommendations

1. Lock one release version authority and align all dependent metadata to it before any evidence refresh.
2. Reconcile the desktop capability contract by choosing one truth:
   - either narrow `main-desktop.json` to `core:default` only,
   - or update validator/docs to reflect the intentionally granted updater/fs permissions.
3. Stabilize `npm --prefix desktop run build:sidecar` on the current host and bundled Node target before rerunning `check:local` or packaging dry-run.
4. Re-audit `unresolved_triage_blocker_signal` against parseable active state files and decide whether invalid state files should be:
   - ignored,
   - warned separately,
   - or blocked via a distinct signal.
5. Only after 1-4 are green, rerun retained acceptance/e2e proof so `release-readiness-artifact.json` becomes same-head fresh-current evidence.
