# Changelog

## [9.2.1] - 2026-04-30

### Fixed
- 修复 `tests/unit/scripts/test_governance_scripts.py` 在 ruff 0.15.x 下的 format drift，使 CI `python -m ruff format --check scripts tests/unit/scripts` 重新通过。
- 抬高根 `vitest.config.ts` 的 `testTimeout` 至 10000ms，消除本地 Windows 高负载下 11/836 个 desktop 测试的 5 秒 flaky 超时（StoryBiblePanel / PlotTab / KnowledgeModal / ChatArea 等 `userEvent.setup()` 多步异步流程）。CI ubuntu 一直绿，仅本地体验改进。
- 同步 `desktop/src-tauri/Cargo.lock` 中 `niko-studio-desktop` crate 版本从 9.0.10 到 9.2.1。

### Added
- 为 5 个 CI-gating Python 启动器补充独立单元测试（共 75 个新增测试）：
  - `tests/unit/scripts/test_ci_checks.py`：covers `check_versions.py` + `check_i18n_keys.py`（22 tests）
  - `tests/unit/scripts/test_start_gateway.py`：gateway launcher runtime/parser/branches（24 tests）
  - `tests/unit/scripts/test_delivery_gate.py`：`GateRule` + `check_rule` + `main` 退出码（15 tests）
  - `tests/unit/scripts/test_check_authority_alignment.py`：`AuthorityRule` + `RULES` 表 + JSON payload 契约（14 tests）
- `tests/unit/scripts/` 测试总数从 39 提升到 114，套件用时 ~3.1s。

### Known Issues
- **ISS-20260430-001 (P1, release-blocker)**：v9.2.1 NSIS 安装包打包了 stale Python compat sidecar (`niko-gateway.exe` 2026-03-14, /health 报 8.0.0)，而非 v9.2.1 Node TS gateway。包安装后 WebView 因 CORS 配置缺失而无法连接 sidecar，前端显示 "运行时不可用 / Failed to fetch"。修复前 v9.2.1 不应作为 external release 发布。详见审计报告与 issue。

## [9.2.0] - 2026-04-30

### Changed
- 统一全局版本号到 9.2.0，对齐 backend production readiness release 基线。
- 升级 src-ts vitest 从 1.3.0 到 3.2.4，消除 5 个 moderate 依赖漏洞（esbuild/vite 链）。
- 收紧 src-ts ESLint 阈值到 --max-warnings 0，与 desktop 保持一致。
- 新增 CONTRIBUTING.md 贡献指南。
- 重写 docs/API_REFERENCE.md，覆盖当前 TypeScript Gateway 全部 69 个 HTTP 端点。

## [9.0.10] - 2026-04-24

### Changed
- 收紧桌面壳层焦点行为，覆盖 checkpoint disclosure、automation panel restore-focus 与 QuickPanel 可访问性流程。
- 加固写作流解析，JSON/SSE 响应拒绝无效 payload 结构并保留现有 callback 契约。
- 合并 sidecar 治理测试覆盖到统一 Python 回归套件，移除重复的独立测试副本。

## [9.0.9] - 2026-04-18

### Changed
- 新增受控 revision loop v1 与自动化工作流面板可靠性测试覆盖。
- 冻结 retained delivery baseline 并收紧 handoff hold 文档。
- 稳定 stage1 frontstage 验证与 dirty UI editor convergence session 清理。

## [9.0.8] - 2026-04-16

### Changed
- 基于最新本地重打包结果切出新的补丁版本，避免将新生成的桌面安装包继续复用 `9.0.7` 的既有 release/tag 资产。
- 同步 backend、desktop、Tauri、Rust crate 与配置版本号到 `9.0.8`，为下一轮安装包与签收记录提供独立版本基线。

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
