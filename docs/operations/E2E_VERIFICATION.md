# Desktop Installed-Package E2E Verification

## Purpose

This checklist covers the gap between package-generation proof and actual installed-package behavior.
Use it on the Windows host that produced the retained package artifact.

It does **not** replace:
- `npm --prefix desktop run validate:package:dry-run`
- `npm --prefix desktop run tauri:build:signed`
- `npm --prefix desktop run local:selftest`
- `python scripts/release_check_summary.py`

Instead, it adds install/start/use validation for the exact package artifact retained for sign-off.

## Required Inputs

- Exact retained package artifact under `desktop/src-tauri/target/release/bundle/**`
- Matching retained release evidence set under `.workflow/evidence/release/`
- Windows host with the packaging/runtime prerequisites already satisfied

## Verification Scope

Validate the exact package artifact you plan to hand off:

1. Install succeeds
2. App launches successfully
3. Gateway-backed desktop path becomes usable
4. Primary user path is reachable
5. App can be closed cleanly
6. Evidence is recorded for the same artifact and same HEAD

## Installed-Package Smoke Checklist

Record the following for the exact artifact under test:

- Artifact path:
- Artifact SHA256:
- HEAD SHA:
- Version:
- Verification host:
- Verification timestamp:

### Step 1 — Install

- [ ] Launch the retained installer package
- [ ] Installation completes without fatal error
- [ ] Installed app entry is visible in Windows shortcuts / installed apps surface

### Step 2 — First launch

- [ ] Launch the installed application from the installed location / shortcut
- [ ] Main window opens
- [ ] No startup crash dialog appears

### Step 3 — Runtime readiness

- [ ] Desktop reaches usable state
- [ ] Gateway-backed features do not remain stuck in permanent loading/error state
- [ ] If startup recovery UI appears, it resolves to a usable desktop state

### Step 4 — Primary writer path

- [ ] Knowledge view is reachable
- [ ] Settings view is reachable
- [ ] Evaluation view is reachable
- [ ] Primary writing/chat surface is reachable

### Step 5 — Basic interaction proof

- [ ] Open the app and navigate across the primary surfaces
- [ ] Confirm at least one gateway-backed interaction completes successfully
- [ ] Close the app cleanly

## Evidence to retain

Retain at minimum:

- package artifact path
- SHA256
- HEAD SHA
- version
- operator name / host
- verification timestamp
- pass/fail result for each checklist section
- optional screenshots only if needed to explain a failure

## Suggested verification record template

```text
installed_package_artifact =
sha256 =
head_sha =
version =
verification_host =
verified_at =
install = PASS|FAIL
first_launch = PASS|FAIL
runtime_readiness = PASS|FAIL
primary_writer_path = PASS|FAIL
basic_interaction = PASS|FAIL
overall = PASS|FAIL
notes =
```

## Retained evidence entrypoint

After the manual checklist passes on the Windows host, record the retained artifact acceptance for the exact package you validated:

```bash
npm --prefix desktop run package:e2e:checklist -- --artifact-path "desktop/src-tauri/target/release/bundle/nsis/<installer>.exe" --tester "<operator>" --result pass --install-verified --launch-verified --core-flow-verified --shutdown-verified
```

This writes:

- `.workflow/evidence/release/package-e2e-acceptance.json`

The command is intentionally strict:
- `--artifact-path` must point at the exact retained installer/package artifact you validated.
- `--tester` is required.
- `--result pass` requires all four verification flags.
- `--result fail` requires `--notes` so the blocked handoff reason is retained.

## Relationship to release sign-off

Use this checklist after package generation proof and before external handoff language claims installed-package readiness.
If package-generation proof is green but this checklist fails, treat the release as blocked for installed-package acceptance.
