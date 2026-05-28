# Changelog

## [10.0.0] - 2026-05-28

### Added — Phase 1: Quick Wins (8 gaps)

- **EventBus backpressure strategies**: 策略枚举 Buffer / Sample / DropOldest，超阈值自动降级
- **Circuit Breaker per-provider tracking**: CLOSED→OPEN→HALF_OPEN 状态机，每个 provider 独立追踪
- **SearchHybridResult source tagging**: 搜索结果携带 `source: 'knowledge' | 'obsidian' | 'graph' | 'wiki'` 标签
- **NowledgeGraphSync nowledge↔graph bridge**: 双向同步 `nowledge:entity-*` 与 `graph:node-*` 事件
- **LLM ProviderLatencyTracker**: 滑动窗口延迟追踪，自动统计 P50/P95
- **LLM Service per-provider circuit breaker integration**: 每个 LLM provider 独立熔断，失败自动跳过
- **MemoryService replayFrom()**: 基于时间戳的内存快照回放
- **KnowledgeService schema-validated merge**: 合并时按 schema 校验，非法数据拒绝写入

### Added — Phase 2: Architecture Completion (8 gaps)

- **EventLog (ring buffer)**: IEventLog + EventLogImpl，append-only ring buffer，支持 replayFrom / getEvents / getLatestSeq
- **DeadLetterQueue**: IDeadLetterQueue + DeadLetterQueueImpl，捕获失败 handler 投递，retry / retryAll + backoff，eventbus:dead-letter 监控
- **TypedEventBus extended**: EventBusConfig (eventLog / deadLetterQueue / backpressure)，replayFrom() 方法，3 种 backpressure 策略（buffer / sample / drop-oldest）。向后兼容 — 无 config 时行为不变
- **MCPRequestRouter provider routing**: 按配置权重 + circuit breaker 状态路由请求到健康 provider
- **KnowledgeSearchService relevance scoring**: 4 信号评分 (RECENCY / SOURCE_AUTHORITY / QUERY_EXPANSION / SELECTION)
- **HybridSearchService LRU + TTL cache**: LRU eviction + TTL expiration + EventBus-driven source-based invalidation
- **WorkflowDelegate parallel result aggregation**: 4 策略 (MERGE_ALL / FIRST_N / MAJORITY_VOTE / SCHEMA_VALIDATED)，aggregateWithTimeout() + EventBus 事件
- **DI Container 47 symbols**: ServiceTypes 从 25 扩展到 47，所有新服务注册到 Inversify 容器

### Added — Phase 3: Advanced Collaboration (10 gaps)

- **LLMFallbackChain**: ILLMFallbackChain + LLMFallbackChainImpl，executeWithFallback 跨 provider 自动降级链，CircuitBreakerRegistry + ProviderLatencyTracker + EventBus 集成
- **EventBus replay + Dead-letter queue**: EventLog ring buffer replayFrom / DeadLetterQueue retry/retryAll + backoff / eventbus:dead-letter channel / 3 backpressure strategies
- **ParallelResultAggregator**: IParallelResultAggregator + ParallelResultAggregatorImpl，4 聚合策略，EventBus 集成
- **Obsidian↔Knowledge bidirectional sync**: IObsidianKnowledgeSync + ObsidianKnowledgeSyncImpl，双向同步，ConflictStrategy (LAST_WRITE_WINS / MERGE / HUMAN_QUEUE)，EventBus subscriptions，debounced batch processing
- **Graph↔Wiki link resolution bridge**: IGraphWikiLinkBridge + GraphWikiLinkBridgeImpl，bidirectional Maps，fallback resolution，orphan detection，integrity checking
- **MCP Service Discovery + Health Monitoring**: IMCPServiceDiscovery + MCPServiceDiscoveryImpl (config+env discovery / auto-registration) / IMCPHealthMonitor + MCPHealthMonitorImpl (health probes / degradation tracking / CircuitBreakerRegistry integration)
- **SearchRelevanceScorer + SearchCacheManager**: 4 signal scoring + LRU+TTL+EventBus-driven invalidation
- **Quality Gate Feedback Loop**: IQualityGateFeedbackLoop + QualityGateFeedbackLoopImpl，detectGaps / generateRemediation / executeRemediation / runFeedbackLoop / escalation
- **Wave Execution Engine**: IWaveExecutionEngine + WaveExecutionEngineImpl，parallel/sequential wave execution，4 failure strategies (retry-all / retry-failed / skip / abort)，timeout + AbortController cancellation
- **Full-stack integration test suite**: 5 integration test files，35 passing tests

### Verification

- TypeScript 编译零错误 (`tsc --noEmit`)
- 3057 测试全绿，零回归
- 47 DI symbols 注册完成
- DI 容器 resolve 全部 47 服务成功
- 5 full-stack integration test suites 通过 (35 tests)

## [9.27.0] - 2026-05-26

### Added
- **PhaseOrchestrator + Workflow Gate**: 阶段门控系统，支持 soft/hard gate 评估、fix-retry 耗尽自动强制完成
- **DelegateBroker**: 委托任务代理，支持任务分发、状态追踪、结果收集
- **WorkflowEventRelay (WebSocket)**: 实时状态推送，客户端可订阅事件类型过滤，支持 ping/pong 心跳
- **Hook 实战接入**: HookRegistry + HookType 扩展，WorkflowEngine 构造器注入 _hooks/_phaseOrch
- **Lazy 工具类**: 懒加载工具类，减少启动时间
- **HybridSearch 不可变策略**: 搜索结果不可变，防止意外修改
- **25 项性能优化**: 对标 maestro-flow 经验，涵盖 logger 统一、WorkflowEngine 双写、store 安全写入、模块 console 清理等
- **Phase 3 深度对比分析**: Dashboard 可视化架构、配置热加载与动态重配置、TUI 架构分析，产出 10 项迁移路线图

### Fixed
- PhaseOrchestrator fixAttempts 累积逻辑：仅在 complete 阶段重置计数器，修复 fix-retry 永远无法耗尽的 bug
- vitest 全量测试 OOM：启用 singleFork 减少内存叠加
- WorkflowEngine 构造器注入 _hooks/_phaseOrch 字段

### Verification
- 47 tests pass (18 phase-orchestrator + 11 delegate-broker + 9 gateway-ws + 9 lazy)
- 30 hybrid-search + openkl-contract tests pass
- No regressions

## [9.26.2] - 2026-05-20

### Fixed
- sidecar 打包阶段现在会一并拷贝 `writing-craft/catalog-data` 运行时 JSON 目录，修复安装包内写作工艺链路因缺少目录数据而冒烟失败的问题。
- desktop 正式发布门禁切换到 `test:serial`，并为长跑 `vitest` 显式增加 `--max-old-space-size=8192`，消除全量串行测试的 OOM / 挂尾不稳定性。
- `AnalysisPanel` 的写作工艺 host 测试改为稳定 mock，并修正章节数组 mock 的引用稳定性，避免 `useEffect` 循环导致发布门禁卡死。
- 多组 desktop / graph 回归测试补齐异步等待与结构化日志断言，使 current-head `desktop_check` 和 retained evidence 能稳定收敛到 `GO`。

### Verification
- `npm --prefix desktop run check:local`
- `python scripts/release_check_summary.py`
- `python scripts/refresh_release_evidence.py`
- `python scripts/package_e2e_checklist.py --artifact-path "desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.26.1_x64-setup.exe" --tester Codex --result pass --install-verified --launch-verified --core-flow-verified --shutdown-verified`

## [9.26.1] - 2026-05-14

### Fixed
- 桌面端 `resolve_base()` 添加 30 秒 TTL 缓存，消除 McpStatusPanel 并行 API 请求的级联健康检查超时，修复"部分状态拉取失败"误报。
- MCP 状态面板：非关键 API 失败（metrics / tools / serviceConfigs）不再触发全局错误提示，仅健康检查类失败显示警告。

### Verification
- `cargo check` — Rust 编译通过（CARGO_TARGET_DIR workaround）
- `npx tsc --noEmit` — TypeScript 类型检查通过
- 桌面应用启动验证：Gateway 7/7 服务 healthy，所有 API 端点返回 200

## [9.26.0] - 2026-05-14

### Added
- CAP-001 导入学习: DocumentParser → EntityExtractor → StyleExtractor → WorldviewExtractor → DistillationPipeline
- CAP-002 自演进写作: ReflectionAgent (Generator-Reflector-Curator) + RuleEvolver + PreferenceTracker + StyleDriftDetector
- CAP-003 阅读学习: SessionTracker → SpoilerGate (chapter-gated) → Light/HeavyExtractor → InsightDistiller (6-stage marginalia)
- LearningOrchestrator 统一编排三大学习管线，支持按 capability 注册/启用/禁用
- 7 个 MCP 学习端点 (import, styleFeedback, styleDrift, rules, readingSession, readingExtract, status)
- DI 容器新增 4 个服务绑定 (LearningOrchestrator, ImportLearning, SelfEvolvingWriting, ReadingLearning)
- 6 个测试套件覆盖学习模块 (extraction-utils, insight-distiller, integration, preference-tracker, rule-evolver, spoiler-gate)

### Verification
- python scripts/check_versions.py: 7/7 文件版本一致 9.26.0
- npx tsc --noEmit (src-ts): 类型检查通过
- 494 tests pass, TypeScript clean

## [9.25.8] - 2026-05-14

### Fixed
- 桌面端 gateway 连接诊断增强：错误信息包含实际 gateway URL，便于排查 `.env.local` 配置错误。
- Rust 端 `get_configured_gateway_base()` 优先读取 `VITE_NIKO_GATEWAY_URL`（Vite 只暴露 `VITE_` 前缀变量），避免因缺前缀导致连接失败。
- Gateway URL 不可达时，Rust 侧输出诊断日志（configured base / override base unhealthy），加速定位 fallback 链路问题。

### Added
- `desktop/.env.example` 模板文件，文档化 `VITE_` 前缀要求与开发环境配置方法。

### Verification
- `python scripts/check_versions.py` — 7/7 文件版本一致 `9.25.8`
- `npx tsc --noEmit`（src-ts）— 类型检查通过

## [9.25.0] - 2026-05-12

### Changed
- 同步全局版本号 `9.13.0 → 9.25.0`，统一 `desktop`、`src-ts`、Tauri manifest、Cargo manifest 与运行时配置的 release 口径，消除 `version_consistency` 门禁阻断。
- 更新当前生产 readiness 归档到 `v9.25.0`，将项目完成度文档口径收敛到当前 `GO` 状态。

### Fixed
- 收口 release gate 阻断项，修复本地发布验收链路中的版本漂移问题，重新生成 `9.25.0` 安装包并通过 retained evidence 验证。
- 为角色画像五维评分补齐空值兜底，避免评分字段缺失时造成前端异常或错误显示。
- 补齐 `writing-helper/process` 兼容路由，恢复 writing helper 主流程与既有入口的兼容性。

### Verification
- `python scripts/check_versions.py`
- 当前 retained release evidence 已刷新到 `v9.25.0`，并在本地 sign-off 下达到 `Decision: GO`。

## [9.2.5] - 2026-05-01

### Changed
- 同步全局版本号 `9.2.4 → 9.2.5`：8 个 source-of-truth 文件同步更新（与 v9.2.4 同范围）。
- **No runtime behavior delta vs v9.2.4** — 收尾 v9.3 周期 deferred 项内部清理，不动 desktop / sidecar / NSIS 任何输出。

### Closed (was deferred to v9.4+)
- **ISS-20260426-004** — MCP workflow workspace-aware caches: 已验证早已实现。`src-ts/mcp/services/workflow.ts:87-128` 的 `workflowRuntimeCachesByWorkspace = new Map<string, WorkflowRuntimeCaches>()` 按 workspace 隔离 engine instance / scheduler entries / checkpoint authority bindings；跨 workspace bleed 禁止由 `src-ts/mcp/workflow-service.workspace.test.ts` 覆盖（5/5 测试通过，含 mismatched-workspace lifecycle/restore/rollback 拒绝路径）。
- **ISS-20260428-010** — Authoritative capability matrix: 落地 `docs/CAPABILITY_MATRIX.md` 作为单一支持矩阵真源（writer features / 集成 adapters / desktop runtime / release sign-off / 历史参考 5 大类，每条带 status 标签 ✅ supported / 🟡 partial / 🧪 experimental / ⛔ disabled / 📜 historical 与 source-of-truth 锚点）。`README.md` 当前权威地图、`desktop/README.md` 当前交付契约、`docs/INDEX.md` 核心文档清单分别新增对该矩阵的引用。Authority alignment 96/96 PASS。

### Refactored
- **ISS-20260426-005** — Container workflow DI canonical runtime contract: 在 `src-ts/container/workflow-runtime-provider.ts` 定义新的 `IWorkflowEngineRuntime` interface（route / plan / execute / quickRollback / lifecycle / checkpoint helpers + 可选 bindPlanAuthority / getPlanAuthority / getCheckpoint），将 `WorkflowEngineRuntimeProvider` 返回类型从 `unknown` 收紧到 `IWorkflowEngineRuntime`。新增 `WorkflowEngine.getCheckpoint(id)` public 方法替代直接访问 private `checkpoints` Map。`src-ts/mcp/services/workflow.ts` 删除 `WorkflowEngineRuntimeLike` + `WorkflowEngineAuthorityBridge` 本地接口定义（约 -40 行）和两处 `as unknown as ...` cast；`src-ts/container/gateway-control-plane.ts` 删除过时的 `(container as unknown as { workflow?: unknown }).workflow` defensive cast（`container.workflow` 已经是 `IWorkflowEngine` typed）。`mcp/endpoints/chat.ts` 同步从 `as ChatWorkflowEngine` 调整为 `as unknown as ChatWorkflowEngine`。`src-ts` typecheck 干净，workflow + container 测试 15/15 通过。

## [9.2.4] - 2026-05-01

### Changed
- 同步全局版本号 `9.2.3 → 9.2.4`：8 个 source-of-truth 文件全量更新（`desktop/package.json`、`src-ts/package.json`、`desktop/src-tauri/Cargo.toml` + `Cargo.lock`、`tauri.conf.json`、`src-ts/config/index.ts`、`config/niko-studio.yaml` + `niko-studio.production.yaml`）。
- **No runtime delta vs v9.2.3** — Rust launcher、gateway runtime、sidecar bundling、NSIS install layout 全部不变。

### Fixed
- **`scripts/generate_signed_tauri_config.py`** — 修复 Tauri 2 签名构建链路 2 个潜伏 bug，由 ISS-20260428-004 self-signed dry-run 暴露：
  - **TAURI_CONFIG env path-mode 在 Tauri 2 已废弃**：原脚本设 `TAURI_CONFIG=<relative_path>`，Tauri 2 现把 `TAURI_CONFIG` 当 inline JSON 内容（不是路径），cargo build script 试解析路径字符串为 JSON 抛 `expected value at line 1 column 1`。改为 `npm run tauri -- build --config <relative_path>` CLI arg，Tauri 2 明确支持 path-or-inline-json 双模式。
  - **`KitsRoot10` 注册表 mismatch 阻塞 signtool 检测**：在用 Visual Studio installer 装 Windows SDK 到 `C:\Program Files (x86)\Windows Kits\10\`、但 `HKLM` 注册表 `KitsRoot10` 仍指 `C:\Program Files\Windows Kits\10\` 空 stub 的 host 上，tauri-bundler 报 `failed to bundle project SignTool not found`。新增可选 `NIKO_WINDOWS_SIGNTOOL_PATH` env override：设了之后脚本注入 `bundle.windows.signCommand` 用绝对 signtool 路径，完全绕过 KitsRoot10 lookup（commit `0d550fd`）。

### Docs
- **`docs/operations/CODE_SIGNING.md`**：新增 "Self-Signed Pipeline Dry-Run" 章节（5 步剧本 + 期望输出表，self-signed `NotTrusted` 状态是预期行为，证明工具链可工作），新增 SDK install gotcha + `NIKO_WINDOWS_SIGNTOOL_PATH` 用法说明 + 诊断命令（commit `f417143`/`0d550fd`）。
- **`docs/release/SIGN_OFF.md` §8**：新增 `signed-bundle-attestation.json` evidence schema（release_state 枚举：`signed_external_release`/`self_signed_dry_run`、artifact `sha256_unsigned`+`sha256_signed`、signature 元数据 cert_subject + thumbprint last8 + authority + digest + `is_authenticode_valid` + `is_root_trusted`、thumbprint 截断政策、未来 release_check_summary.py 集成路径）。Production contract evidence 列表新增第 9 项（仅当 release_state ≥ `signed_external_release` 时必需，commit `f417143`）。

### Self-Signed Dry-Run（ISS-20260428-004 advancement，本地证据）
- 在 ASCII-only host 上 self-signed dry-run 应能完整跑通；当前 dev host (`D:\工作目录\…` CJK 路径) 验到 signtool subprocess 边界，被 Win32 error 123 阻断（极可能是 Tauri bundler 的 ANSI-vs-UTF-16 argv 编码处理 bug）。Pipeline 8 项验证 PASS（cert mint / config 注入 / `--config` arg / vite build / cargo release compile / external-bin signing 入口 / signCommand override 激活），具体审计在 `.workflow/evidence/release/signed-bundle-attestation.json` (gitignored, `release_state=self_signed_dry_run`, `dry_run_status=blocked_by_environment`)。

## [9.2.3] - 2026-05-01

### Changed
- 将 v9.2.2 ship 后的 4 个 post-release 提交（`2e60305` + `37efb57` + `b0cce4d`）固化为正式 patch 版本，使 git tag 与 main HEAD 状态对齐，避免后续 release-check 出现 `fresh_superseded`。
- 同步全局版本号 `9.2.2 → 9.2.3`：`desktop/package.json`、`src-ts/package.json`、`desktop/src-tauri/Cargo.toml`、`desktop/src-tauri/Cargo.lock`、`desktop/src-tauri/tauri.conf.json`、`src-ts/config/index.ts`、`config/niko-studio.yaml`、`config/niko-studio.production.yaml`。

### Fixed
- 修复 `desktop/vite.config.ts` 缺 `test.exclude`（vitest 默认 discovery 扫到 `src-tauri/bin/sidecar/**` + `src-tauri/target/**` 下 staged 的 Node 20 ABI 编译的 native 模块测试，host Node 24 加载 `better-sqlite3.node` 抛 NODE_MODULE_VERSION 不匹配）。补 exclude 后 836/836 desktop 测试通过。
- 修复 `desktop/scripts/hydrate_packaged_compat_artifact.cjs` source 候选优先级（原 candidate 只有 `target/.../debug/niko-gateway.exe`，本机解析为 47 天前 March 14 stale Python compat exe，导致 `validate_sidecar_contract --strict-packaging` >30d staleness gate 失败）。改为优先选 `target/release/niko-gateway-launcher.exe`，legacy 候选保留作为最后回退。
- 修复 `tests/unit/scripts/test_governance_scripts.py` 的 `run_node_cjs_and_capture` 测试 harness（原 `fsStub` 只 mock `existsSync`/`readFileSync`，但 ISS-001 在 `choose_sidecar.cjs` 加的 `detectStalePythonBinaries` 用 `fs.statSync` + `writeSidecarManifest` 用 `fs.mkdirSync`+`fs.writeFileSync` 在 vm sandbox 中调用立即抛 "fs.X is not a function"）。补 `statSync`（fake mtimeMs=now）、`mkdirSync`、`writeFileSync` (no-op) 后 39/39 governance tests 通过。
- 重跑 `scripts/check-writing-helper.ps1 -Strict` 刷新 `.workflow/evidence/release/writing-helper-acceptance.json`，head_sha 对齐当前 HEAD（之前 stay 在 v9.2.1 era 被 release-check 标记 `fresh_superseded`）。7/7 cases pass。

### Docs
- 更新 `docs/release/SIGN_OFF.md`，将 `Packaged runtime` 描述从 "Packaged Python compatibility runtime" 替换为 v9.2.2+ Node-first 契约：Tauri NSIS bundle the Rust launcher (`niko-gateway-launcher.exe`) + `bundle.resources` 下 `bin/sidecar/` staged Node TS gateway + portable Node 20.18.1。Python compat sidecar 退化为 advisory `--runtime python` fallback only。同步更新 prerequisites 段、release states 段、retained-artifact 列表（commit `b0cce4d`）。

### Closed Issues
- **ISS-20260428-001 (P0, ISSUE-PR-1)**：Unify packaged runtime contract — code paths v9.2.2 已 ship，docs 对齐 in v9.2.3。
- **ISS-20260428-002 (P0, ISSUE-PR-2)**：Restore desktop authoritative local gate — `npm --prefix desktop run check:local` exit 0 验证。
- **ISS-20260428-003 (P0, ISSUE-PR-3)**：Refresh same-head release evidence + reclose local selftest enforcement — release_check_summary.py 33/33 PASS。
- **ISS-20260428-008 (P1, ISSUE-PR-8)**：Python static quality gates — pyproject.toml + ruff CI 已早期到位。
- **ISS-20260428-009 (P1, ISSUE-PR-9)**：Productize release-evidence refresh — `scripts/refresh_release_evidence.py` 已是 single-path operator helper。

## [9.2.2] - 2026-05-01

### Fixed
- **ISS-20260430-001 (P1, release-blocker)** 关闭。v9.2.1 NSIS 打包的 stale 128 MB Python compat sidecar (`niko-gateway.exe` 2026-03-14, /health 报 8.0.0) 被替换为 216 KB Rust launcher + 262 MB Node TS gateway bundle + 67 MB portable Node 20.18.1。/health 现返回 `version: 9.2.2` + 7 服务全 healthy + CORS 允许 `tauri://localhost`。
- 修复 `desktop/scripts/build_node_sidecar.cjs` native 模块 ABI 漂移：当 `NIKO_SIDECAR_BUNDLE_NODE=true` 时注入 `npm_config_target=20.18.1` 等环境变量，强制 prebuild-install 拉匹配 Node 20 ABI 的预构建（否则 host Node 24 装 better-sqlite3 v137 ABI .node，运行时 v20 加载 fails with "NODE_MODULE_VERSION 137 vs 115"）。
- 修复 `desktop/src-tauri/Cargo.toml` 缺 `default-run = "niko-studio-desktop"`，导致 `tauri build` 在双 [[bin]] 目标下报 "find a `package > default-run`"。
- 修复 `desktop/src-tauri/src/bin/niko-gateway-launcher.rs` 的 sidecar 解析路径：补 `<exe_dir>/bin/sidecar/` 候选，匹配 Tauri 2 NSIS 对 `bundle.resources` 路径 "bin/sidecar" 保留相对结构的安装布局（之前 launcher 找不到 sidecar，启动后 exit 126）。
- 修复 `desktop/src-tauri/src/gateway_runtime.rs` 端口绑定：识别 `NIKO_GATEWAY_PORT` env override，用户路径默认仍是 ephemeral 端口避免冲突；让 Layer 4 packaged_app_smoke `--installer-path` 模式可以 pin 端口做 E2E 验证。

### Added
- `packaged-app-smoke` CI job 从 advisory 升级为 blocking（`.github/workflows/integration-tests.yml`）。NSIS 安装+启动+/health+CORS 契约验证后续每次 push 到 main 都强制执行；NSIS build 基础设施失败仍非 gating（toolchain/runner 抖动隔离）。

### Post-release maintenance (commit `2e60305`)
v9.2.2 ship 后 release-check (`scripts/release_check_summary.py`) 仍报 6 个 P0 FAIL 的 baseline 清理（4 个独立 fix，2 个派生信号自动跟随）：
- 修复 `desktop/vite.config.ts` 缺 `test.exclude`：vitest 默认 discovery 会扫到 `src-tauri/bin/sidecar/**` 和 `src-tauri/target/**` 下 staged 的 `*.test.js`（含 Node 20 ABI 编译的 native 模块 + 三方 deps 的测试 fixtures），host Node 24 加载 `better-sqlite3.node` 时抛 NODE_MODULE_VERSION 不匹配。补 exclude 后 836/836 desktop 测试通过。
- 修复 `desktop/scripts/hydrate_packaged_compat_artifact.cjs` source 候选优先级：原 candidate 只有 `target/.../debug/niko-gateway.exe`（在本机解析为 47 天前 March 14 的 stale Python compat exe），覆写到 `bin/` 后 `validate_sidecar_contract --strict-packaging` staleness gate (>30d) 失败。改为优先选 `target/release/niko-gateway-launcher.exe`（fresh launcher），legacy 候选保留作为最后回退。
- 修复 `tests/unit/scripts/test_governance_scripts.py` 的 `run_node_cjs_and_capture` 测试 harness：原 `fsStub` 只 mock `existsSync`/`readFileSync`，但 ISS-001 在 `choose_sidecar.cjs` 加的 `detectStalePythonBinaries` (用 `fs.statSync`) 和 `writeSidecarManifest` (用 `fs.mkdirSync`+`fs.writeFileSync`) 在 vm sandbox 中调用立即抛 "fs.X is not a function"。补 `statSync`（mocked path 返回 mtimeMs=now 的 fake stat）、`mkdirSync` 和 `writeFileSync` (no-op) 后 39/39 governance tests 通过。
- 重跑 `scripts/check-writing-helper.ps1 -Strict` 刷新 `.workflow/evidence/release/writing-helper-acceptance.json`（之前 head_sha + version 停在 v9.2.1 era，被 release-check 标记 "fresh_superseded"）。7/7 cases pass，head_sha 对齐当前 HEAD。
- 派生：`local_selftest_enforcement` + `delivery_contract_100_signal` 跟随上面 4 项一起 PASS。
- **Result**: `scripts/release_check_summary.py` decision NO_GO → **GO**（33/33 signals PASS）。

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
