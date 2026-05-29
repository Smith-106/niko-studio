## TASK-002 完成摘要

- 结论：`desktop` frontend capability contract 已收束为单一真相，当前 worktree 内的实现与测试已经一致，无需再覆盖已有未提交改动。
- 选定 contract：`main-desktop` 允许 `core:default`、`process:default`、`updater:default`，以及本地模板、workflow、project storage 所需的显式 `fs:*` 权限。
- 实现状态：
  - `desktop/scripts/validate_sidecar_contract.cjs` 已用显式权限白名单校验 capability file，而不是旧的 “仅 `core:default`” 断言。
  - `desktop/src-tauri/capabilities/main-desktop.json` 已声明与 validator 一致的权限边界。
  - `tests/unit/scripts/test_governance_scripts.py` 已将 sidecar contract fixture 与断言更新为同一套权限 contract。
  - `release-check-summary.md` 已包含 2026-05-12 的 current-head closure note，说明旧的 `core invoke access` 失败输出是历史证据，当前无需再改。
- 验证结果：
  - `npm --prefix desktop run validate:sidecar-contract`：通过，输出 `Contract validation PASSED`。
  - `python -m pytest tests/unit/scripts/test_governance_scripts.py -q -k sidecar_contract`：`5 passed`。
  - `rg -n "core:default|process:default|updater:default|fs:default" desktop/src-tauri/capabilities/main-desktop.json desktop/scripts/validate_sidecar_contract.cjs`：validator 与 capability file 共享同一套 frontend boundary。
