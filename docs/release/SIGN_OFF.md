# Release Sign-Off

## Purpose

This document is the repeatable local and CI sign-off path for the shipped Niko Studio contract:

- `Supported runtime`: `desktop/` + Tauri host + local `src-ts/` Node/TypeScript gateway
- `Packaged compatibility runtime`: bundled Python sidecar
- `Primary release gate`: `.github/workflows/external-release-gate.yml`
- `Windows acceptance gate`: `.github/workflows/writing-helper-acceptance.yml`

## Prerequisites

- Windows host for `npm --prefix desktop run validate:package:dry-run` and local `check-writing-helper.ps1`
- Node.js 20+, npm 10+, Python 3.11+, Rust stable with the MSVC Windows target
- `npm ci` completed in `src-ts/` and `desktop/`
- Pre-stage the packaged Python compatibility sidecar artifact in `desktop/src-tauri/bin/`:
  - Windows: `niko-gateway.exe` and `niko-gateway-x86_64-pc-windows-msvc.exe`
  - The current node-first checkout does not include the retired legacy Python gateway sources needed to rebuild these binaries from source.
- Local packaging proof is intentionally unsigned:
  - `desktop/src-tauri/tauri.conf.json` keeps `bundle.windows.certificateThumbprint: null`
  - `desktop/src-tauri/tauri.conf.json` keeps `bundle.windows.timestampUrl: ""`
  - `npm --prefix desktop run validate:package:dry-run` runs `tauri build --debug --no-bundle --target x86_64-pc-windows-msvc`
- Signed external bundles require release-private certificate thumbprint and timestamp URL material outside git before `npm --prefix desktop run tauri:build`

## Local Sign-Off Sequence

### 1. Governance and contract proof

```bash
python scripts/check_versions.py
python scripts/delivery_gate.py
python scripts/check_authority_alignment.py
python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q
```

### 2. Authoritative local quality gates

```bash
npm --prefix src-ts run check:local
npm --prefix desktop run check:local
```

The authoritative desktop local gate is `npm --prefix desktop run check:local`. In `desktop/package.json` this currently resolves to `check:release`, and `python scripts/release_check_summary.py` reruns this exact command before it can report `Decision: GO`.
If the packaged Python compatibility sidecar artifact is not present, this gate is expected to fail before formal release sign-off.

### 3. Runtime, smoke, and packaging proof

```bash
npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts --reporter=default
npm --prefix src-ts exec -- vitest run tests/mcp/workflow-endpoints.integration.test.ts tests/mcp/workflow-critic-smoke.integration.test.ts --reporter=default
npm --prefix desktop run validate:sidecar-contract
npm --prefix desktop run validate:package:dry-run
```

For the current migration baseline, `validate:sidecar-contract` and `validate:package:dry-run` validate a pre-staged packaged Python compatibility artifact plus the repo-local Node launcher. They do not rebuild the retired Python gateway sources.

### 4. Writing-helper acceptance

Start the authoritative gateway in one PowerShell session:

```powershell
$proc = Start-Process -FilePath python -ArgumentList "scripts/start_gateway.py --host 127.0.0.1 --port 18080 --log-level warning" -PassThru
```

Run the acceptance suite in another PowerShell session:

```powershell
./scripts/check-writing-helper.ps1 -Strict -Port 18080 -Host 127.0.0.1
```

Stop the gateway after the suite finishes:

```powershell
Stop-Process -Id $proc.Id -Force
```

The reusable CI equivalent is `.github/workflows/writing-helper-acceptance.yml`.

### 5. Consolidated release snapshot

```bash
python scripts/release_check_summary.py
```

`release-check-summary.md` must end in `Decision: GO`.

## CI Mapping

- `.github/workflows/integration-tests.yml`
  - Ubuntu baseline for governance, backend coverage, desktop build signal, and authority hard gates
  - Windows packaging advisory lane on every run
  - Windows packaging hard-fail lane on `main`
- `.github/workflows/external-release-gate.yml`
  - Blocking release gate for governance, backend smoke, authority alignment, Codecov policy, Windows packaging dry-run, and Windows writing-helper acceptance
- `.github/workflows/writing-helper-acceptance.yml`
  - Reusable/manual Windows acceptance workflow for `/writing-helper/process`

## Evidence to Keep

- `release-check-summary.md`
- `.workflow/evidence/release/release-readiness-artifact.json`
- `authority-alignment.json`
- `vitest-production-guard*.xml`
- `vitest-e2e*.xml`
- `governance-scripts.junit.xml`
- Windows packaging dry-run artifact from CI or the local `desktop/src-tauri/target/x86_64-pc-windows-msvc/debug/niko-studio-desktop.exe`
- The exact packaged Python compatibility sidecar artifact used for the release sign-off (`desktop/src-tauri/bin/niko-gateway*.exe` on Windows)
