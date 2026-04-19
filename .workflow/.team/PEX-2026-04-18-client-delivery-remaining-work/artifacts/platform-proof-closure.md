# Platform Evidence Closure

## Result

- `task_id`: `EXEC-006`
- `issue_id`: `ISS-20260418-006`
- `baseline`: `4d63e03 / 9.0.8`
- `platform_scope`: `Windows x64 only`
- `decision`: `BOUNDED_TO_SELECTED_SCOPE`
- `status`: `non_windows_x64_excluded`

## In-Scope Platform

The only promised platform for this delivery is `Windows x64`.

- Recorded scope source: `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/platform-scope-decision.json`
- Frozen baseline source: `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/customer-delivery-baseline-decision.json`
- Retained release evidence source: `.workflow/evidence/release/customer-delivery-baseline.json`

## Retained Evidence That Covers The Promised Scope

1. The retained release summary records the same retained release decision on frozen `4d63e03 / 9.0.8`.
   - Source: `release-check-summary.md`
2. The retained release readiness artifact stays bound to the same SHA and version.
   - Source: `.workflow/evidence/release/release-readiness-artifact.json`
3. The retained package inventory is Windows x64-specific.
   - `niko-studio-desktop.exe`
   - `niko-gateway.exe`
   - `niko-gateway-x86_64-pc-windows-msvc.exe`
   - Source: `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/customer-delivery-baseline-decision.json`
4. The formal sign-off path is written around a Windows host and the `x86_64-pc-windows-msvc` packaging target.
   - Source: `docs/release/SIGN_OFF.md`

## Explicit Exclusions

The following are not included in this delivery promise and therefore do not require scope-bounding work in this task:

- `Windows x86`
- `Windows arm64`
- `macOS x64`
- `macOS arm64`
- `Linux x64`
- `Linux arm64`
- any other non-Windows-x64 platform

The exclusion details remain in `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/platform-scope-decision.json`.

## Cross-Cutting Open Item That Remains Open

Platform scope is bounded only in the sense that no additional platform promise remains unresolved. One customer-delivery blocker remains active on the selected platform:

- Writer golden-path smoke on the retained Windows x64 package remains `NOT_CLOSED`.
- Source: `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/writer-golden-path-smoke.json`

## Hold Artifacts

- Retained blocker source: `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/retained-writer-smoke-attempt.md`
- Current hold-status source: `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/final-handoff-status.md`
- Interpretation rule: platform evidence is bounded to the selected Windows x64 scope, but overall customer-delivery readiness remains on hold under the retained writer-smoke artifacts above.

## Downstream Contract

- `EXEC-007` must not imply support beyond `Windows x64`.
- Any future platform expansion must start with a new customer platform decision and target-specific evidence for that exact platform.
