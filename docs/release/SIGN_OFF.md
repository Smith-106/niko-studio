# Release Sign-Off

## Purpose

This document is the repeatable local and CI sign-off path for the shipped Niko Studio contract:

- `Supported runtime`: `desktop/` + Tauri host + local `src-ts/` Node/TypeScript gateway
- `Packaged runtime` (v9.2.2+): Tauri NSIS bundles the Rust launcher (`niko-gateway-launcher.exe`, hydrated to `desktop/src-tauri/bin/niko-gateway*.exe` via `npm --prefix desktop run hydrate:packaged-compat`) plus the staged Node TS gateway (`bin/sidecar/`) and portable Node 20.18.1 runtime — no host-side Node install required. The legacy Python compatibility sidecar (`--runtime python` override) remains as an advisory fallback only.
- `Primary release gate`: `.github/workflows/external-release-gate.yml`
- `Windows acceptance gate`: `.github/workflows/writing-helper-acceptance.yml`
- `100% completion contract`: single scorecard（functional / testing / release / governance）plus issue-pending inspection must all stay green before claiming `Decision: GO`

## Prerequisites

- Windows host for `npm --prefix desktop run validate:package:dry-run` and local `check-writing-helper.ps1`
- Node.js 20+, npm 10+, Python 3.11+, Rust stable with the MSVC Windows target
- `npm ci` completed in `src-ts/` and `desktop/`
- Pre-stage the packaged sidecar artifact in `desktop/src-tauri/bin/`:
  - Windows: `niko-gateway.exe` and `niko-gateway-x86_64-pc-windows-msvc.exe`
  - Standard path: `npm --prefix desktop run build:sidecar` builds the Rust launcher (`target/release/niko-gateway-launcher.exe`) and stages the Node TS gateway under `bin/sidecar/`. Set `NIKO_SIDECAR_BUNDLE_NODE=true` to additionally bundle portable Node 20 for hosts without a globally-installed Node.
  - Hydration helper: `npm --prefix desktop run hydrate:packaged-compat` copies `target/release/niko-gateway-launcher.exe` (preferred) into the two `bin/niko-gateway*.exe` filenames Tauri's `bundle.externalBin` expects. If the launcher is missing, the script falls back to legacy `target/**/debug/niko-gateway.exe`.
  - The retired legacy Python gateway sources are not required for the v9.2.2+ Node-first contract.
- Local packaging proof is intentionally unsigned:
  - `desktop/src-tauri/tauri.conf.json` keeps `bundle.windows.certificateThumbprint: null`
  - `desktop/src-tauri/tauri.conf.json` keeps `bundle.windows.timestampUrl: ""`
  - `npm --prefix desktop run validate:package:dry-run` runs `tauri build --debug --no-bundle --target x86_64-pc-windows-msvc`
- Signed external bundles require release-private certificate thumbprint and timestamp URL material outside git before `npm --prefix desktop run tauri:build:signed`
- Release-host signing flow:
  1. Export `NIKO_WINDOWS_CERT_THUMBPRINT`
  2. Export `NIKO_WINDOWS_TIMESTAMP_URL`
  3. Run `python scripts/generate_signed_tauri_config.py`
  4. Run `npm --prefix desktop run tauri:build:signed`
  5. Verify with `Get-AuthenticodeSignature desktop/src-tauri/target/release/bundle/nsis/*.exe | Format-List`

## Release states and external prerequisites

Use the following 3 release states consistently across local sign-off, CI gate output, and handoff language:

1. `unsigned_local_proof`
   - Repo-visible gates are green and the packaged sidecar artifact (Rust launcher + staged Node TS gateway) is hydrated.
   - `desktop/src-tauri/tauri.conf.json` still keeps `bundle.windows.certificateThumbprint: null` and `bundle.windows.timestampUrl: ""`.
   - This is valid local validation proof, but it is not a signed external shipment.
2. `prerequisite_missing_hold`
   - External shipment is on hold whenever any of these 4 prerequisites is missing:
     - Windows code-signing certificate thumbprint
     - Windows timestamp URL
     - Hydrated packaged sidecar artifact (`desktop/src-tauri/bin/niko-gateway*.exe` Rust launcher + `bin/sidecar/` staged Node TS gateway)
     - Windows packaging host or toolchain (`validate:package:dry-run` / `tauri:build:signed` on Windows with the MSVC target)
   - Treat this state as non-shippable even if earlier local checks were green.
3. `signed_external_release`
   - The same repo-visible gates stay green.
   - All 4 prerequisites above are present on the Windows packaging host.
   - `npm --prefix desktop run tauri:build:signed` completes with the release-private signing inputs provided outside git.

The reusable `.github/workflows/external-release-gate.yml` workflow must surface the same state model in CI output so unsigned local proof cannot be misread as a signed release.

## Local Sign-Off Sequence

### 1. Governance and contract proof

```bash
python scripts/check_versions.py
python scripts/delivery_gate.py
python scripts/check_authority_alignment.py
python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q
```

The release summary is the authoritative single scorecard for 100% completion. It must keep all four dimensions green:

- `functional`: delivery semantics, runtime policy, external E2E smoke, runtime/metrics guards
- `testing`: governance regression + baseline tests/coverage
- `release`: desktop authoritative gate, sidecar readiness, packaging dry-run, writing-helper acceptance, local:selftest enforcement
- `governance`: authority alignment, evidence completeness, blocker semantics, and `issue_pending_blocker_signal`

`issue_pending_blocker_signal` is blocking. If the roadmap issue set required for the 100% contract has any non-terminal status in `.workflow/issues/issue-history.jsonl`, release sign-off must stop with `Decision: NO_GO`.

### 2. Authoritative local quality gates

```bash
npm --prefix src-ts run check:local
npm --prefix desktop run check:local
```

The authoritative desktop local gate is `npm --prefix desktop run check:local`. In `desktop/package.json` this currently resolves to `check:release`, and `python scripts/release_check_summary.py` reruns this exact command before it can report `Decision: GO`.
If the packaged sidecar artifact is not present, `npm --prefix desktop run check:local` can still validate the local/runtime contract; only explicit packaging proof (`npm --prefix desktop run validate:package:dry-run`) must fail before formal release sign-off.
`npm --prefix desktop run local:selftest` is the authoritative launcher smoke-test. It is mandatory whenever the retained release evidence for `release_summary_report`, `authority_alignment`, `writing_helper_acceptance`, and `governance_scripts_regression` is not already `fresh_current` for the current HEAD.
If those retained release-evidence sources are already same-HEAD `fresh_current`, `local:selftest` is optional for that sign-off pass.

### 3. Runtime, smoke, and packaging proof

```bash
npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts --reporter=default
npm --prefix src-ts exec -- vitest run tests/mcp/workflow-endpoints.integration.test.ts tests/mcp/workflow-critic-smoke.integration.test.ts --reporter=default
npm --prefix desktop run validate:sidecar-contract
npm --prefix desktop run validate:package:dry-run
```

For the v9.2.2+ baseline, `validate:sidecar-contract` validates the Rust launcher manifest, version-match (against `desktop/package.json`), and staleness gate (>30d threshold via `--strict-packaging`); `validate:package:dry-run` exercises `tauri build --debug --no-bundle --target x86_64-pc-windows-msvc` against the pre-staged sidecar artifact. Neither rebuilds the retired Python gateway sources.

### 4. Evidence refresh single path

Prefer the single operator path whenever retained same-head evidence must be refreshed before sign-off:

```bash
npm --prefix desktop run release:evidence:refresh
```

This helper runs the authoritative launcher smoke-test, starts the authoritative gateway, refreshes strict writing-helper acceptance evidence, and then regenerates `release-check-summary.md`.
If the single-path helper fails, fall back to the granular commands below to diagnose the specific broken leg.

### 5. Writing-helper acceptance

Start the authoritative gateway in one PowerShell session:

```powershell
$proc = Start-Process -FilePath python -ArgumentList "scripts/start_gateway.py --host 127.0.0.1 --port 18080 --log-level warning" -PassThru
```

Run the acceptance suite in another Windows PowerShell session:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-writing-helper.ps1 -Strict -Port 18080 -Host 127.0.0.1
```

Stop the gateway after the suite finishes:

```powershell
Stop-Process -Id $proc.Id -Force
```

The reusable CI equivalent is `.github/workflows/writing-helper-acceptance.yml`.
Each strict run must also refresh `.workflow/evidence/release/writing-helper-acceptance.json` for the same `git rev-parse HEAD`.

### 6. Installed-package smoke acceptance

After package-generation proof, run the installed-package checklist on the Windows host for the exact retained artifact:

```bash
npm --prefix desktop run package:e2e:checklist
```

Authoritative checklist:
- `docs/operations/E2E_VERIFICATION.md`

Retained evidence artifact:
- `.workflow/evidence/release/package-e2e-acceptance.json`

This closes the remaining gap between package-generation proof and actual install/start/use validation of the retained package artifact.
If package-generation proof is green but installed-package smoke fails, treat external handoff as blocked.

### 7. Consolidated release snapshot

```bash
python scripts/release_check_summary.py
```

`release-check-summary.md` must end in `Decision: GO`.
A `Decision: GO` with `certificateThumbprint = null` and `timestampUrl = ""` is only the `unsigned_local_proof` state. If any of the 4 external prerequisites is missing, treat the result as `prerequisite_missing_hold`; only a Windows-hosted `npm --prefix desktop run tauri:build:signed` with release-private signing inputs can graduate that proof to `signed_external_release`.
This command also refreshes the formal sign-off artifacts under `.workflow/evidence/release/`, including the retained authority-alignment JSON, `.workflow/evidence/release/writing-helper-acceptance.json`, and the governance and Vitest JUnit/XML reports used by the release bundle manifest.
The consolidated snapshot is only valid when the retained writing-helper acceptance artifact is `strict: true`, `freshness_status: fresh`, and `supersession_status: current`.
The release readiness artifact at `.workflow/evidence/release/release-readiness-artifact.json` now records `head_sha`, `version`, `generated_at`, `freshness_window_hours: 48`, and the retained `evidence_sources` list used by the sign-off decision.
Any retained evidence labeled `stale_*` or `*_superseded` is non-green and must not be reused for a `Decision: GO`, even if the file still exists on disk.
The release summary now exposes this as a blocking `local_selftest_enforcement` signal: missing, stale, or superseded retained proof for the bound release-sign-off sources means rerun `npm --prefix desktop run local:selftest` before claiming `Decision: GO`.

## Customer Handoff Bundle

Use one concise bundle for internal delivery or customer-facing demo preparation.

### Latest validated packaging snapshot

- Validation date: `2026-04-16`
- Retained evidence HEAD stamp: see `.workflow/evidence/release/writing-helper-acceptance.json`
- Packaging proof completed:
  - `npm --prefix desktop run validate:package:dry-run`
  - `npm --prefix desktop run tauri:build:signed`
- Retained unsigned package artifacts:
  - `desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.0.8_x64-setup.exe`
  - `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_en-US.msi`
  - `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_zh-CN.msi`
- Signing state:
  - local proof only; `certificateThumbprint = null`
  - local proof only; `timestampUrl = ""`

### Retained production contract evidence (8 items)

These 8 retained evidence items are the production contract. Docs, package files, and sidecar binaries support the handoff, but they do not replace this proof set:

1. `release-check-summary.md`
2. `.workflow/evidence/release/release-readiness-artifact.json`
3. `.workflow/evidence/release/authority-alignment.json`
4. `.workflow/evidence/release/writing-helper-acceptance.json`
5. `.workflow/evidence/release/package-e2e-acceptance.json`
6. `.workflow/evidence/release/vitest-production-guard.xml`
7. `.workflow/evidence/release/vitest-e2e.xml`
8. `.workflow/evidence/release/governance-scripts.junit.xml`

### Include

- The 8 retained production contract evidence items listed above
- `docs/release/SIGN_OFF.md`
- The exact desktop executable or package artifact produced from the validated path
- The exact packaged sidecar artifacts used for sign-off (`desktop/src-tauri/bin/niko-gateway*.exe` Rust launcher + `desktop/src-tauri/bin/sidecar/` staged Node TS gateway on Windows)

### Exclude

- `.workflow/active/**`
- `.workflow/archives/**`
- `.workflow/.csv-wave/**`
- local debug logs such as `writing-helper-gateway*.log`
- ad hoc screenshots not explicitly referenced by the retained proof set
- intermediate `desktop/src-tauri/target/**` trees except the exact retained executable/package artifact used as release proof

### Operator Notes

- Treat the current worktree plus the regenerated 2026-04-16 packaging proof and retained GO evidence as the authoritative handoff baseline.
- Prefer a single authoritative handoff bundle over duplicate release summaries or copied historical session conclusions.
- If a signed external bundle is required, add the release-private certificate thumbprint and timestamp URL material outside git before running `npm --prefix desktop run tauri:build:signed`.
- If the package is for customer demo rather than external shipment, keep the same proof set and explicitly mark the package as an unsigned local validation build when applicable.

## CI Mapping

- `.github/workflows/integration-tests.yml`
  - Ubuntu baseline for governance, backend coverage, desktop build signal, and authority hard gates
  - Windows packaging advisory lane on every run
  - Windows packaging hard-fail lane on `main`
- `.github/workflows/external-release-gate.yml`
  - Blocking release gate for governance, backend smoke, authority alignment, Codecov policy, Windows packaging dry-run, and Windows writing-helper acceptance. The workflow is reusable and now also supports manual `workflow_dispatch` runs for final release confirmation.
- `.github/workflows/writing-helper-acceptance.yml`
  - Reusable/manual Windows acceptance workflow for `/writing-helper/process`

## Evidence to Keep

- `release-check-summary.md`
- `.workflow/evidence/release/release-readiness-artifact.json`
- `.workflow/evidence/release/authority-alignment.json`
- `.workflow/evidence/release/vitest-production-guard.xml`
- `.workflow/evidence/release/vitest-e2e.xml`
- `.workflow/evidence/release/governance-scripts.junit.xml`
- Windows packaging dry-run artifact from CI or the local `desktop/src-tauri/target/x86_64-pc-windows-msvc/debug/niko-studio-desktop.exe`
- Windows release package artifacts retained from the validated `2026-04-16` local build:
  - `desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.0.8_x64-setup.exe`
  - `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_en-US.msi`
  - `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_zh-CN.msi`
- The exact packaged sidecar artifacts used for the release sign-off (`desktop/src-tauri/bin/niko-gateway*.exe` Rust launcher + `desktop/src-tauri/bin/sidecar/` staged Node TS gateway on Windows)
- The delivery manifest and package README that enumerate the exact retained proof set for the release bundle
