# Changelog

## [9.0.7] - 2026-04-15

### Changed
- 提升模板库、设置面板与评估面板的交互一致性，补齐失败反馈、焦点恢复、字段级校验语义与回归测试。
- 完成壳层级视觉无障碍修复：增强全局 focus-visible、补充主内容 skip link、修正语义色与关键对比度问题，并提升弱边界组件的可辨识度。
- 将持久化 `fontSize` 偏好接入桌面壳层字号体系，抬升长期可见的 10px/11px 微文案，并为 checkpoint 弹出层补齐 disclosure 语义与焦点交接。
- 同步 backend、desktop、Tauri 与配置版本号到 `9.0.7`，作为本次桌面可访问性与交互修复发布基线。

## [9.0.6] - 2026-04-14

### Changed
- 刷新根 README、Desktop README 与索引/运维/发布文档，使说明口径与当前 `desktop + src-ts` 交付路径一致。
- 修正文档中的失效引用、过时验证命令与不存在文件路径，并将多份历史架构/规划文档明确标记为 historical reference。
- 同步 backend、desktop、Tauri 与配置版本号到 `9.0.6`，为本次文档发布建立一致的版本基线。
- 新增 Windows 本地桌面启动器工作流：提供 `ps1` / `.cmd` / npm 入口，支持自动复用健康 gateway、端口回退、状态检查、自检和 gateway-only 调试路径。
- 实际完成 `9.0.6` Windows 桌面打包，产出 unsigned NSIS / MSI 安装包，并将产物与签收信息补充到 release 文档。

## [9.0.4] - 2026-04-11

### Changed
- 收敛 `desktop` 与 `src-ts` 的交付热点修复，确保 `Settings`、workflow engine 契约与桌面发布门禁在干净发布候选上可验证。
- 明确 Node-first 本地运行时与打包 Python compatibility sidecar 的边界，并把 sidecar 先决条件写入 release / runbook / desktop 文档。
- 稳定桌面发布校验链：修复 lockfile 与 audit 基线漂移，保留 Windows packaging advisory 日志，同时避免 advisory lane 把发布 PR 误判为失败。

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
