# Changelog

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
