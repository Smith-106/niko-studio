# Platform Scope Decision

## Result

- `task_id`: `EXEC-005`
- `issue_id`: `ISS-20260418-005`
- `baseline`: `4d63e03 / 9.0.8`
- `customer decision`: `Windows x64 only`
- `decision`: `WINDOWS_X64_ONLY`
- `status`: `scope_recorded`

## Current Retained Evidence Inventory

1. The frozen customer-delivery baseline is the retained release-evidence build `4d63e03db1f673379901fb827aff1a1f6947faa8 / 9.0.8`.
   - Source: `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/customer-delivery-baseline-decision.json`
   - Source: `.workflow/evidence/release/customer-delivery-baseline.json`
2. The retained package evidence is Windows x64-specific.
   - `niko-studio-desktop.exe`
   - `niko-gateway.exe`
   - `niko-gateway-x86_64-pc-windows-msvc.exe`
   - Source: `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/customer-delivery-baseline-decision.json`
3. The formal sign-off path is written around a Windows host and the `x86_64-pc-windows-msvc` packaging target.
   - Source: `docs/release/SIGN_OFF.md`
4. The formal-delivery caveats already state that the repository evidence surface is mainly Windows x64.
   - Source: `.workflow/.team/UAN-nikostudio-formal-delivery-2026-04-09/conclusions.json`

## Customer-Promised Platform Scope

- `promised`: `Windows x64`
- `best_effort`: none
- `not_included`: every non-Windows-x64 platform

This issue treats the user decision received on `2026-04-18` as the selected customer delivery scope. No multi-platform build, packaging, signing, or acceptance work is authorized by this decision.

## Executed Outcome

- `EXEC-006` closed evidence only for the selected `Windows x64 only` scope.
- `EXEC-007` assembled the customer handoff bundle without implying support beyond Windows x64.
- Final delivery readiness still remains on hold because the retained writer-smoke blocker stayed active on the selected platform.
- Current hold artifacts:
  - `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/retained-writer-smoke-attempt.md`
  - `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/final-handoff-status.md`

## Explicit Exclusions And Deferred Evidence Obligations

1. `Windows x86`
   - Delivery status: `not_included`
   - Missing evidence: no retained build, package, sidecar, or acceptance evidence exists for a 32-bit Windows delivery.
   - If scope changes later: produce a target-specific desktop package, matching gateway sidecar, platform-native acceptance evidence, and a refreshed release summary bound to that exact target.
2. `Windows arm64`
   - Delivery status: `not_included`
   - Missing evidence: no retained build, package, sidecar, or acceptance evidence exists for Windows ARM64.
   - If scope changes later: produce an ARM64 package, ARM64 sidecar evidence, Windows acceptance evidence on that architecture, and a refreshed release summary bound to that exact target.
3. `macOS x64`
   - Delivery status: `not_included`
   - Missing evidence: no retained macOS package or acceptance evidence exists.
   - If scope changes later: produce a macOS x64 package, matching gateway/runtime evidence, macOS acceptance evidence, and a refreshed release summary bound to that exact target.
4. `macOS arm64`
   - Delivery status: `not_included`
   - Missing evidence: no retained Apple Silicon package or acceptance evidence exists.
   - If scope changes later: produce a macOS arm64 package, matching gateway/runtime evidence, macOS acceptance evidence, and a refreshed release summary bound to that exact target.
5. `Linux x64`
   - Delivery status: `not_included`
   - Missing evidence: no retained Linux package or acceptance evidence exists.
   - If scope changes later: produce a Linux x64 package, matching gateway/runtime evidence, Linux acceptance evidence, and a refreshed release summary bound to that exact target.
6. `Linux arm64`
   - Delivery status: `not_included`
   - Missing evidence: no retained Linux ARM64 package or acceptance evidence exists.
   - If scope changes later: produce a Linux arm64 package, matching gateway/runtime evidence, Linux acceptance evidence, and a refreshed release summary bound to that exact target.
7. `Any other non-Windows-x64 platform`
   - Delivery status: `not_included`
   - Missing evidence: this session has no retained build, package, signing, or acceptance evidence for any platform outside Windows x64.
   - If scope changes later: record a new customer platform decision first, then generate target-specific build, package, runtime, acceptance, and release-summary evidence for that exact platform.

## Downstream Contract

- `EXEC-006` may only bound evidence obligations for the promised `Windows x64` scope in this delivery session.
- `EXEC-006` must keep every non-Windows-x64 platform recorded above as excluded unless a new customer decision supersedes this artifact.
- `EXEC-007` must cite this artifact so the customer handoff bundle does not imply broader platform support than Windows x64.
- Final customer-delivery readiness remains on hold under the retained writer-smoke artifacts above.
