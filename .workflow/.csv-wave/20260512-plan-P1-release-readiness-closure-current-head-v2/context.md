# Context: plan for current-head release-readiness closure

**Date**: 2026-05-12
**Mode**: full
**Requested skill call**: `$maestro-plan "1 --dir .workflow/scratch/20260512-analyze-release-readiness-closure-current-head-v2" -y`
**Chain topic**: `analyze-plan-execute` step 2/3
**Primary sources**:
- `.workflow/.csv-wave/20260512-analyze-release-readiness-closure-current-head-v2/context.md`
- `.workflow/.csv-wave/20260512-analyze-release-readiness-closure-current-head-v2/conclusions.json`
- `release-check-summary.md`
- `.workflow/evidence/release/release-readiness-artifact.json`
- `scripts/check_versions.py`
- `desktop/scripts/validate_sidecar_contract.cjs`

## Execution note

The required raw skill call was attempted first, but this checkout does not expose a standalone `maestro-plan` executable, and `maestro run maestro-plan ... -y` is rejected by the wrapper layer before the skill arguments can be forwarded. To keep the chain moving, this session records the equivalent planning artifacts manually while preserving the exact requested skill call string.

## Current blocker summary

- Critical: `python scripts/check_versions.py` fails because `src-ts` still declares `9.2.5` while desktop/Tauri/Cargo already declare `9.13.0`.
- Critical: `npm --prefix desktop run validate:sidecar-contract` fails because the strict validator expects a narrower frontend capability boundary than `desktop/src-tauri/capabilities/main-desktop.json` currently grants.
- High: `npm --prefix desktop run validate:package:dry-run` is wired through `hydrate:packaged-compat` and strict packaging validation, so packaging proof remains red until the retained compatibility artifact chain is corrected.
- High: retained release evidence is stale and superseded, so `writing_helper_acceptance_signal`, `package_e2e_acceptance_signal`, and `local_selftest_enforcement` cannot legitimately turn green until the gate chain is fixed and evidence is refreshed on the corrected head.
- High: `unresolved_triage_blocker_signal` still needs targeted reconciliation so invalid or legacy workflow-state noise does not masquerade as a real current unresolved blocker.

## Planned approach

1. Unify release version authority and protect it with regression coverage.
2. Reconcile the desktop capability file and strict validator into one explicit frontend capability contract.
3. Repair the packaged compatibility dry-run chain so `desktop_check`, `desktop_sidecar_readiness`, and `desktop_packaging_dry_run` can converge on the same packaging proof path.
4. Refresh retained release evidence only after the gates are fixed, while preserving a strict but precise unresolved triage blocker rule.

## Plan summary

- Complexity: `high`
- Task count: `4`
- Wave 1: `TASK-001`, `TASK-002`
- Wave 2: `TASK-003`
- Wave 3: `TASK-004`

## Notes

- `.workflow/state.json` is malformed JSON in this checkout, so artifact registration and index updates were intentionally skipped to avoid writing invalid or partial state.
- No `.workflow/.maestro/` status files were touched.
