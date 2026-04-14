# Niko Studio Test Tier Matrix

## Purpose

This document defines the current practical test tiers for the shipped `desktop + src-ts` Niko Studio product.
Use it to decide which commands to run during day-to-day development, before merging, and before release.

This matrix is current-operational guidance.
Historical Python/TDD planning material under `docs/tdd/` remains reference-only and does not redefine the current release contract.

## Scope

- `desktop/`: React + Tauri desktop shell, sidecar contract, packaging
- `src-ts/`: local Node/TypeScript gateway, MCP/runtime/workflow services
- `scripts/`: governance, authority alignment, release summary, local launcher helpers

## Tier Summary

| Tier | When to run | Goal | Typical runtime |
|---|---|---|---|
| `L1` | During local development | Fast feedback on the area you just changed | minutes |
| `L2` | Before commit / PR update | Strong local confidence for the changed subsystem | several minutes |
| `L3` | Before merge to `main` | High-signal repo-level regression and release-shape validation | longer |
| `L4` | Before release / handoff | Near-full release proof with retained evidence | longest |

## L1: Daily Development

Run the smallest useful checks for the files you changed.

### Desktop/UI changes

```bash
npm --prefix desktop run test
npm --prefix desktop run check
```

### Gateway/runtime changes

```bash
npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts --reporter=default
```

### Governance / launcher / docs changes

```bash
python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q
npm --prefix desktop run local:selftest
```

### Goal

- Catch obvious regressions quickly.
- Avoid paying the full `check:local` cost on every small edit.

## L2: Pre-Commit / Pre-PR Update

Use the authoritative local quality gates for the affected product surfaces.

```bash
npm --prefix src-ts run check:local
npm --prefix desktop run check:local
python scripts/delivery_gate.py
python scripts/check_authority_alignment.py
```

### Goal

- Prove the current local checkout still satisfies the supported `desktop + src-ts` path.
- Catch contract drift in docs, workflow, runtime, and release helpers before review.

## L3: Pre-Merge to `main`

Run the release-shape checks that are expensive enough to skip during tight edit loops, but should be green before merge.

```bash
python scripts/release_check_summary.py
npm --prefix desktop run validate:package:dry-run
```

Add targeted runtime integration coverage when the change touches MCP/workflow/runtime boundaries:

```bash
npm --prefix src-ts exec -- vitest run tests/mcp/workflow-endpoints.integration.test.ts tests/mcp/workflow-critic-smoke.integration.test.ts --reporter=default
```

### Goal

- Validate the repo-level release summary and packaging shape before changes land on `main`.
- Catch issues that only show up when desktop packaging, release scripts, or integrated runtime guards are exercised.

## L4: Release / Handoff

This is the near-full release proof path.
Use `docs/release/SIGN_OFF.md` as the authoritative checklist.

```bash
python scripts/check_versions.py
python scripts/delivery_gate.py
python scripts/check_authority_alignment.py
python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q
npm --prefix src-ts run check:local
npm --prefix desktop run check:local
npm --prefix desktop run validate:package:dry-run
python scripts/release_check_summary.py
```

When an actual Windows package is required:

```bash
npm --prefix desktop run tauri:build
```

### Goal

- Produce a defensible release decision.
- Retain packaging artifacts, release summary, and sign-off evidence.

## Risk-Based Rule of Thumb

- Only UI / frontend changes: `L1`, then `desktop check:local` before merge.
- Gateway / runtime / MCP changes: `L1` + `L2`, then add targeted runtime/integration coverage from `L3`.
- Launcher / release / governance / documentation changes: governance pytest + authority/delivery checks + launcher self-test.
- External handoff or packaging request: run `L4`.

## Current Authoritative Entrypoints

- Desktop local quality gate: `npm --prefix desktop run check:local`
- Gateway local quality gate: `npm --prefix src-ts run check:local`
- Release summary: `python scripts/release_check_summary.py`
- Authority alignment: `python scripts/check_authority_alignment.py`
- Release checklist: `docs/release/SIGN_OFF.md`
- Release contract: `docs/release/RELEASE_NOTES.md`
- Desktop operations runbook: `docs/operations/DESKTOP_RUNBOOK.md`

## Notes

- `desktop/package.json` already exposes the local launcher helpers for desktop-specific smoke validation.
- Packaging on the current Windows path is valid as local unsigned proof; signed external bundles still require release-private signing material outside git.
