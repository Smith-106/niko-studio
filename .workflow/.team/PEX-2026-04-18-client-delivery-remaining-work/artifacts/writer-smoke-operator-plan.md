# Writer Smoke Operator Plan

## Objective

Close the residual blocked note from `.workflow/.csv-wave/cwp-client-delivery-handoff-20260413/context.md` by rerunning one customer-facing writer golden-path walkthrough on the frozen customer-delivery baseline instead of on the current dirty workspace.

Current state:

- Current customer-delivery readiness remains `HOLD_PENDING_WRITER_SMOKE`.
- Governing hold artifacts:
  - `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/retained-writer-smoke-attempt.md`
  - `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/final-handoff-status.md`

## Frozen Baseline To Use

- `head_sha`: `4d63e03db1f673379901fb827aff1a1f6947faa8`
- `short_sha`: `4d63e03`
- `version`: `9.0.8`
- Binding artifacts:
  - `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/customer-delivery-baseline-decision.json`
  - `.workflow/evidence/release/customer-delivery-baseline.json`
  - `release-check-summary.md`
  - `.workflow/evidence/release/release-readiness-artifact.json`

## Exact Package Surface To Walk

Use a retained `2026-04-16` release artifact, not the `2026-04-18` debug shell or rebuilt debug executable.

- Preferred installer: `desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.0.8_x64-setup.exe`
- Alternate installer: `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_en-US.msi`
- If an installed build is already present and known to come from the same retained package set, verify its About/version surface still reports `9.0.8`.
- Required compatibility sidecar artifacts:
  - `desktop/src-tauri/bin/niko-gateway.exe`
  - `desktop/src-tauri/bin/niko-gateway-x86_64-pc-windows-msvc.exe`

## Do Not Use As Closure Proof

- `desktop/src-tauri/target/x86_64-pc-windows-msvc/debug/niko-studio-desktop.exe`
- `desktop/src-tauri/target/debug/niko-studio-desktop.exe`
- Any `npm --prefix desktop run dev`, `tauri:dev`, or `local:shell` session
- `.codex-run/desktop-local-state.json` and `.codex-run/local-shell-4177.out.log`

Those local surfaces are useful for developer investigation, but they are newer workspace outputs and cannot prove the frozen customer-delivery baseline.

## Operator Walkthrough

1. Confirm the freeze binding before launch.
   - Open `release-check-summary.md` and verify it records the same retained release decision, `head_sha = 4d63e03db1f673379901fb827aff1a1f6947faa8`, `version = 9.0.8`.
   - Open `.workflow/evidence/release/customer-delivery-baseline.json` and verify the same SHA/version pair.
2. Launch the retained package.
   - Prefer installing from the retained NSIS or MSI package.
   - If installer prompts require elevation, retain the installer log path used by Windows.
3. Verify the app opens without a blocking startup failure.
   - Capture one screenshot of the initial app surface.
4. Walk the customer writer golden path.
   - Open or create a writable document.
   - Enter sample text into the main editor.
   - Invoke Writing Helper on that text and confirm a non-error response path appears.
   - Open the key settings surface.
   - Open the knowledge/library entry surface.
   - Return to the main writing surface and confirm the app remains usable.
5. Record outcome.
   - If all steps succeed with no customer-blocking defect, mark the prior note closed.
   - If any step fails, capture the exact surface, error text, and whether the failure is product-blocking or tooling-only.

## Required Evidence Capture

- At least one screenshot for each of:
  - App launch
  - Main writing surface with edited text
  - Writing Helper open or completed
  - Settings entry point
  - Knowledge entry point
- A short operator note including:
  - date/time
  - operator name
  - machine/host identifier
  - exact package path used
  - whether the prior blocked note is now closed

## Closure Rule

The historical note from `cwp-client-delivery-handoff-20260413` is resolved only if:

- the walkthrough used the retained `4d63e03 / 9.0.8` package surface,
- the screenshots/operator note are retained next to the smoke artifact, and
- no customer-blocking defect is observed in launch, writing, Writing Helper, settings, or knowledge entry.
