# Changelog

## [9.0.2] - 2026-04-09

### Changed
- 同步 backend、desktop、config 与 Tauri 的发布版本号到 `9.0.2`。
- 为当前 control-plane 拆分提交准备一致的 release/tag 基线，保持版本校验可通过。

## [9.0.1] - 2026-04-08

### Changed
- 对齐根文档与 Desktop 文档中的本地质量门禁说明，明确 `check:local` 为权威本地验收入口。
- 修复桌面端关键测试断言与 mock 合约，使 `client`、`EvaluationPanel`、`writerWorkflowExperience` 套件与当前 workspace-aware 行为一致。
- 稳定 `SettingsModal` 保存路径测试在完整 `desktop check:local` 下的执行表现，消除 release summary 中的 `desktop_check` 阻断。
- 重新生成 release readiness 快照，`release-check-summary.md` 与 release artifact 现已达到 `Decision: GO`。

## [8.2.0] - 2026-03-27

### Changed
- 同步 Python/配置/Desktop/Tauri 版本号到 `8.2.0`。
- external 发布流程准备：沿用既有门禁与发布汇总脚本执行校验。

## [8.0.0] - 2026-02-10

### Changed
- 统一 Python/CLI/Desktop/Tauri 版本号到 `8.0.0`，移除 Gateway 版本硬编码。
- 新增 `scripts/check_versions.py`，用于版本一致性校验。
- 统一环境变量加载入口，新增 `.env.example`。
- 新增环境预检能力（启动前校验关键配置）。
- 新增集中 `pytest.ini`，统一本地与 CI 测试参数。
- CI 扩展为 `unit + integration` 必测集，覆盖率门槛统一为 `80%`。
- 补齐发布与回退操作文档。
