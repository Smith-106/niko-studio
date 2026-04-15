# Release Validation Strategy

## Scope

- Session: `TST-release-validation-2026-04-14`
- Date: `2026-04-14`
- Current HEAD: `6345c1bc33812fb8f449bef4ec501a9dcda0ae01`
- Baseline release tag: `v9.0.6` (`6684b29`)
- Delta since baseline tag: `5` commits
- Current checkout packaging prerequisite: `desktop/src-tauri/bin/niko-gateway-x86_64-pc-windows-msvc.exe` is present, so the Windows packaging gate must run in strict mode for this checkout.

## Decision

Use the existing repository validation commands. Do not generate new tests for this HEAD.

Reasoning:

- The change surface is release/workflow, governance, launcher, and documentation heavy.
- Existing gates already cover these surfaces:
  - `src-ts` authoritative release gates in `package.json`, `vitest.phase4.config.ts`, and `vitest.release.config.ts`
  - desktop authoritative local gate plus packaging/sidecar commands in `desktop/package.json`
  - governance regression coverage in `tests/unit/scripts/test_governance_scripts.py`
  - writing-helper acceptance in `scripts/check-writing-helper.ps1`
- The only changed surface not covered by `check:local` alone is the new local desktop launcher workflow. That should be validated with the existing command `npm --prefix desktop run local:selftest`, not with new test code.

## Change Analysis

| Surface | Files | Impact | Priority | Existing validation entrypoints |
| --- | --- | --- | --- | --- |
| Windows packaging gate semantics | `.github/workflows/external-release-gate.yml`, `.github/workflows/integration-tests.yml` | Changes when packaging is blocking vs advisory; release decision can drift if local/CI prereqs differ | P0 | `npm --prefix desktop run validate:package:dry-run`, `python scripts/release_check_summary.py` |
| Desktop launcher contract | `desktop/package.json`, `scripts/start_desktop_local.ps1`, `scripts/status_desktop_local.ps1`, `scripts/stop_desktop_local.ps1`, `scripts/selftest_desktop_local.ps1`, `.cmd` wrappers | New public launcher path for local desktop smoke; needs runtime confirmation | P0 | `npm --prefix desktop run local:selftest`, `python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q` |
| Governance/release guardrails | `scripts/delivery_gate.py`, `scripts/check_authority_alignment.py`, `tests/unit/scripts/test_governance_scripts.py` | Release proof depends on these checks and their new launcher/doc anchors | P0 | `python scripts/delivery_gate.py`, `python scripts/check_authority_alignment.py`, targeted pytest |
| Desktop packaging dependency lock | `desktop/src-tauri/Cargo.lock` | Packaging/build reproducibility may have changed even without app source edits | P0 | `npm --prefix desktop run validate:package:dry-run`, optional `npm --prefix desktop run tauri:build` |
| Release docs and retained evidence references | `docs/release/SIGN_OFF.md`, `docs/testing/TEST_TIER_MATRIX.md`, `README.md`, `desktop/README.md`, `docs/operations/DESKTOP_RUNBOOK.md`, `docs/release/RELEASE_NOTES.md` | Sign-off guidance changed; must stay aligned with executable gates | P1 | `python scripts/check_authority_alignment.py`, `python scripts/delivery_gate.py`, `python scripts/release_check_summary.py` |

## Recommended Layers

### L1 Unit and Contract Regression

- Scope:
  - governance script regression
  - launcher contract anchoring
  - `src-ts` phase 4 baseline coverage set
  - desktop unit/component/API suite already wired into `desktop` Vitest
- Coverage target:
  - reuse repo defaults from session metadata: `L1 >= 80`
  - preserve existing `src-ts` phase 4 thresholds already encoded in `vitest.phase4.config.ts`
- Commands:
  - `python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q`
  - `npm --prefix src-ts run test:coverage:phase4 -- --coverage.reporter=text`
  - `npm --prefix desktop run test`

### L2 Integration and Runtime Gates

- Scope:
  - production/runtime guard tests
  - MCP/workflow integration smoke
  - desktop launcher self-test
  - sidecar contract validation
- Coverage target:
  - reuse repo defaults from session metadata: `L2 >= 60`
  - all changed integration surfaces green
- Commands:
  - `npm --prefix src-ts run check:local`
  - `npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts --reporter=default`
  - `npm --prefix src-ts exec -- vitest run tests/mcp/workflow-endpoints.integration.test.ts tests/mcp/workflow-critic-smoke.integration.test.ts --reporter=default`
  - `npm --prefix desktop run check:local`
  - `npm --prefix desktop run local:selftest`
  - `npm --prefix desktop run validate:sidecar-contract`

### L3 Release, Acceptance, and Packaging Proof

- Scope:
  - strict Windows packaging gate
  - writing-helper acceptance
  - retained release evidence refresh
- Coverage target:
  - reuse repo defaults from session metadata: `L3 >= 40`
  - for release sign-off, all blocking commands must pass and evidence must be regenerated
- Commands:
  - `npm --prefix desktop run validate:package:dry-run`
  - `./scripts/check-writing-helper.ps1 -Strict -Port 18080 -Host 127.0.0.1`
  - `python scripts/release_check_summary.py`
  - conditional when an actual installer/MSI bundle is required from current HEAD: `npm --prefix desktop run tauri:build`

## Execution Order

### Preflight

1. Confirm exact revision and prerequisites:
   - `git rev-parse HEAD`
   - `Test-Path desktop/src-tauri/bin/niko-gateway-x86_64-pc-windows-msvc.exe`
2. Ensure required toolchains are available on the Windows host:
   - Node.js `20+`
   - npm `10+`
   - Python `3.11+`
   - Rust stable with `x86_64-pc-windows-msvc`

### Worker Order

1. `TESTRUN-003` phase A, fast-fail governance lane:
   - `python scripts/check_versions.py`
   - `python scripts/delivery_gate.py`
   - `python scripts/check_authority_alignment.py`
   - `python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q`
2. `TESTRUN-001` src-ts authoritative lane:
   - `npm --prefix src-ts run check:local`
   - rerun the exact release-shape smoke commands if isolated runtime/integration logs are needed:
     - `npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts --reporter=default`
     - `npm --prefix src-ts exec -- vitest run tests/mcp/workflow-endpoints.integration.test.ts tests/mcp/workflow-critic-smoke.integration.test.ts --reporter=default`
3. `TESTRUN-002` desktop authoritative lane:
   - `npm --prefix desktop run check:local`
   - `npm --prefix desktop run local:selftest`
   - `npm --prefix desktop run validate:package:dry-run`
4. `TESTRUN-003` phase B, final release proof after `TESTRUN-001` and `TESTRUN-002` are green:
   - start gateway: `python scripts/start_gateway.py --host 127.0.0.1 --port 18080 --log-level warning`
   - acceptance: `./scripts/check-writing-helper.ps1 -Strict -Port 18080 -Host 127.0.0.1`
   - stop gateway
   - `python scripts/release_check_summary.py`
5. Conditional packaging artifact regeneration:
   - if this run must produce fresh customer/internal installers from current HEAD, run `npm --prefix desktop run tauri:build` after the dry-run succeeds and retain the generated NSIS/MSI artifacts with the refreshed release evidence

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| Strict/advisory packaging semantics are misread | High | High | Treat packaging as blocking in this checkout because the packaged compatibility artifact is present; do not accept advisory-only reasoning |
| Launcher scripts pass static governance checks but fail at runtime | Medium | High | Run `npm --prefix desktop run local:selftest` in addition to governance pytest |
| Release evidence remains stale relative to current HEAD | High | High | Run `python scripts/release_check_summary.py` only after the main lanes are green so it refreshes the retained sign-off artifacts |
| Packaging regressions hide behind `check:local` | Medium | High | Keep `npm --prefix desktop run validate:package:dry-run` as a separate required step |
| Fresh shipping bundle is needed, but only dry-run proof is produced | Medium | Medium | Escalate to `npm --prefix desktop run tauri:build` whenever the output of this validation is a deliverable installer/MSI, not just a sign-off decision |

## Coverage Gap Decision

No real coverage gap justifies writing new tests for this strategy task.

Use the existing repository suites and commands:

- governance regression pytest covers the newly expanded delivery/authority rules
- `src-ts` release suites already isolate runtime and workflow-smoke tests
- desktop `check:local` plus `local:selftest` plus packaging dry-run cover the changed launcher and packaging surfaces
- writing-helper acceptance already exists as the release-grade Windows smoke

If any of the above fail, fix the code or docs and rerun the same gates. Do not create speculative tests before a real uncovered failure mode is identified.
