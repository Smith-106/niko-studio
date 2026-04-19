# Customer Handoff Bundle Manifest

## Result

- `task_id`: `EXEC-007`
- `issue_id`: `ISS-20260418-007`
- `baseline`: `4d63e03 / 9.0.8`
- `shipment_mode`: `unsigned demo/internal handoff`
- `platform_scope`: `Windows x64 only`
- `bundle_status`: `ASSEMBLED_WITH_HOLD_NOTE`
- `readiness`: `HOLD_PENDING_WRITER_SMOKE`

## Bundle Include Set

### Release Evidence

- `release-check-summary.md`
- `.workflow/evidence/release/customer-delivery-baseline.json`
- `.workflow/evidence/release/release-readiness-artifact.json`
- `.workflow/evidence/release/authority-alignment.json`
- `.workflow/evidence/release/writing-helper-acceptance.json`
- `.workflow/evidence/release/governance-scripts.junit.xml`
- `.workflow/evidence/release/vitest-production-guard.xml`
- `.workflow/evidence/release/vitest-e2e.xml`
- `docs/release/SIGN_OFF.md`

### Session-Local Delivery Notes

- `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/writer-golden-path-smoke.md`
- `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/shipment-proof-closure.md`
- `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/platform-proof-closure.md`
- `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/platform-proof-closure.json`
- `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/retained-writer-smoke-attempt.md`
- `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/final-handoff-status.md`

### Windows x64 Package Payload

- `desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.0.8_x64-setup.exe`
- `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_en-US.msi`
- `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_zh-CN.msi`
- `desktop/src-tauri/bin/niko-gateway.exe`
- `desktop/src-tauri/bin/niko-gateway-x86_64-pc-windows-msvc.exe`

## Customer-Visible Scope Notes

1. This bundle is only for the selected `unsigned demo/internal handoff`.
2. This bundle only carries evidence for `Windows x64`.
3. `signed external shipment` is not included and is not implied.
4. No non-Windows-x64 platform support is included or implied.

## Explicit Exclusions

- signing certificates, timestamp inputs, and any signed package claim
- current dirty-workspace rebuild evidence
- internal workflow/archive/csv-wave internals
- historical analysis artifacts not required by the handoff contract
- any package or evidence that implies support beyond Windows x64

## Send/Hold Readiness

This bundle is assembled, but it is **still not cleared for customer delivery**.

Reason:

- `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/writer-golden-path-smoke.md` records `decision = NOT_CLOSED` and `status = retained_package_partial_walkthrough_incomplete`.
- `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/retained-writer-smoke-attempt.md` is the latest retained-package attempt record and captures the exact evidence plus blocker list.
- `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/final-handoff-status.md` is the latest hold disposition for this bundle and keeps the delivery on `HOLD_PENDING_WRITER_SMOKE`.
- The retained installed `zh-CN` MSI surface at `D:\写作\niko-studio-desktop.exe` launched and reached settings and knowledge entry, but `新建文档` only produced `新对话` while the center pane stayed on `小说创作助手`.
- No visible edited text was directly verified on the retained package, so no retained-package Writing Helper success on document text can be claimed.
- The retained knowledge surface also showed `保存角色失败，请稍后重试。`

## Hold Artifacts

- Current hold-status source: `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/final-handoff-status.md`
- Latest retained attempt source: `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/retained-writer-smoke-attempt.md`
- Enforcement rule: do not present this bundle as cleared for customer delivery while those retained-package blocker notes remain active.

Operational rule:

- The bundle may be reviewed internally or used for a clearly labeled `unsigned demo/internal handoff` on `Windows x64` only.
- The bundle must travel with the explicit retained-package blocker note above, plus the retained smoke attempt and final hold-status artifacts.
- Do not present it as cleared for customer delivery until the retained-package writer/editor/helper path is directly verified without a customer-blocking defect.
