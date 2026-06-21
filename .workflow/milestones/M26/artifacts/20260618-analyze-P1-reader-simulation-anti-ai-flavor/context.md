# Context: Phase 1 — Reader Simulation 2.0 + Anti-AI-Flavor Suite

**Date**: 2026-06-18
**Scope**: M26 Phase 1
**Areas discussed**: Persona expansion, analysis weight feedback, anti-AI-flavor detection, De-AI rewrite, A/B testing, Chinese i18n

## Decisions

### Decision 1: Anti-AI-flavor 采用独立 detector 层
- **Context**: R-M26-003 需要在不破坏现有 9 维度分析契约的前提下引入反 AI 味检测。
- **Options**:
  1. 新增 `QualityDimension` 枚举值，扩散到所有维度消费点。
  2. 新建 `src-ts/reader/ai-flavor-detector.ts`，由 `DualEngine.runEditorEngine` 调用并作为 `editorialAnalysis.aiFlavor` 字段返回。
- **Chosen**: 选项 2 — 独立 detector。
- **Reason**: 选项 1 会修改 `src-ts/quality/types.ts:13-18` 并影响 analysis dashboard、 detectors、tests 等多处；选项 2 最小侵入，保持 detector 可独立演进。

### Decision 2: De-AI rewrite 复用 RevisionService
- **Context**: R-M26-004 需要提供「降低 AI 味」和「切换风格」两种重写模式。
- **Options**:
  1. 在 reader-endpoints 直接调用 LLM writer，reader 模块承担写职责。
  2. 复用 M25 `IRevisionService.revise`，将 De-AI 目标作为 `qualityGoals` 注入 critic/writer 循环。
- **Chosen**: 选项 2 — 复用 RevisionService。
- **Reason**: 保持 reader 模块只读分析职责；复用现有 revision session tracking、learning insights、comparison 能力；符合架构约束「RevisionOrchestrator 作为独立服务而非 React Hook」。

### Decision 3: Phase 1 必须修复 `/reader/analyze` 空文本 TODO
- **Context**: `src-ts/reader/mcp/reader-endpoints.ts:165-167` 当前把 `manuscriptText` 硬编码为空字符串。
- **Options**:
  1. 在 analyze 阶段记录为已知约束，plan/execute 中处理。
  2. 在 analyze 阶段明确为前置依赖，plan Wave 0/Wave 1 必须修复。
- **Chosen**: 选项 2 — 必须修复。
- **Reason**: 所有上层功能（persona 扩展、A/B 测试、权重反馈）都依赖真实文本分析结果；不修复则功能无法验证。

## Constraints

### Locked
- 不破坏现有 reader simulation、analysis、revision 公共接口。
- 不修改已发布的 MCP/IPC 契约。
- Anti-AI-flavor detector 必须保持独立，不扩展 `QualityDimension` 枚举。
- De-AI rewrite 必须通过 `IRevisionService` 协议接入，不在 reader endpoint 直接调用 LLM writer。
- Phase 1 计划必须以修复 `/reader/analyze` 空文本 TODO 作为前置任务。
- 新增功能测试覆盖率 ≥80%。

### Free
- 自定义画像持久化方案：`.niko-studio/reader-personas.json` 或 SQLite，由 implementer 根据现有存储模式选择。
- A/B 测试返回结构：可复用 `RevisionComparison` 或新建 `ReaderABComparison`，由 planner 根据 UI 需求选择。
- Anti-AI-flavor detector 规则层具体关键词列表与 LLM prompt 模板，由 implementer 迭代调优。
- 前端 reader API 层命名（`reader.ts` / `readerSimulation.ts`）由 implementer 决定。

### Deferred
- Web/Obsidian/移动端版本（M27+）。
- 作家 + 编辑 + AI 三方协作（M27+）。
- MCP 多 Agent 协作工作流（M27+）。
- 插件市场（M27+）。
- 商业模式/许可证变更（仅调研，不实施）。

## Code Context

- `src-ts/reader/PersonaDefinition.ts:13-27` — `ReaderPersona` 接口，扩展字段位置。
- `src-ts/reader/PersonaDefinition.ts:203-207` — `PRESET_PERSONAS` 工厂注册表。
- `src-ts/reader/DualEngine.ts:93-110` — Promise.all 双引擎编排，便于新增 anti-AI-flavor 字段。
- `src-ts/reader/ConsensusEngine.ts:23-31` — 后端 `ConsensusItem` 定义。
- `src-ts/reader/OverlayBridge.ts:54-62` — 前端 `ConsensusItem` 定义，存在漂移。
- `src-ts/reader/mcp/reader-endpoints.ts:49-50` — 内存 `customPersonaStore` / `analysisResultCache`。
- `src-ts/reader/mcp/reader-endpoints.ts:165-167` — 空文本 TODO。
- `src-ts/protocols/revision.ts:59-127` — `IRevisionService` 协议。
- `src-ts/services/revision-service.ts:69-174` — `RevisionServiceImpl` 实现，`writerFn` 待实现。
- `desktop/src/components/reader/PersonaSelector.tsx:373-446` — 前端 persona 选择器，当前仅本地 state。
- `desktop/src/components/reader/ReportGenerator.tsx:213-301` — 前端重复实现 consensus 聚合。
- `desktop/src/api/writing-craft.ts:168-199` — `callApi` + `ApiResponse<T>` 封装模式，reader API 层应复用。

## Open Questions

- 9 维度分析权重反馈的具体交互位置：是在 ReaderOverlay 标记上、DetailPanel 中、还是 ReportGenerator 的维度卡片上？
- A/B 测试视图是否复用现有 ReaderOverlay，还是新建独立面板？
- 中文术语标准化：anti-AI-flavor 是否译为「反 AI 味」或「去 AI 感」？

## Interview Decisions

- 范围：完整 Phase 1（R-M26-001~006）。
- 深度：Standard。
- 分析方向：architecture, implementation, performance, security, concept, comparison。
- 分析视角：Technical, Architectural。

## Related
- [[spec:project:architecture-constraints-032]]
