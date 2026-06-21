# Discussion Timeline: M26 Phase 1 Analysis

## Table of Contents

- [Session Metadata](#session-metadata)
- [User Intent](#user-intent)
- [Current Understanding](#current-understanding)
- [Dimension Selection Rationale](#dimension-selection-rationale)
- [Discussion Rounds](#discussion-rounds)
- [Decision Trail](#decision-trail)
- [Intent Coverage Matrix](#intent-coverage-matrix)
- [Session Statistics](#session-statistics)

## Session Metadata

- **Session ID**: ANL-m26-p1-reader-simulation-anti-ai-flavor-2026-06-18
- **Scope**: Phase 1 of Milestone M26
- **Phase Title**: Reader Simulation 2.0 + Anti-AI-Flavor Suite
- **Dimensions**: architecture, implementation, performance, security, concept, comparison
- **Perspectives**: Technical, Architectural
- **Depth**: Standard
- **Milestone**: M26
- **Roadmap Source**: `.workflow/.roadmap/RMAP-M26-competitive-differentiation-20260618.md`

## User Intent

开始 M26 全流程规划 → 对 M26 Phase 1 进行深度分析，明确 6 条需求（R-M26-001~006）的实现范围、依赖关系、关键决策与风险，为后续 plan → execute → review → test 提供输入。

## Current Understanding

M26 Phase 1 建立在已有 Reader Simulation Dual-Engine（Persona Engine + Editorial Analysis Engine）与 M25 RevisionService / Style Personalization 之上。五条核心能力（persona 扩展、A/B 测试、分析权重反馈、anti-AI-flavor 检测、De-AI rewrite）可通过扩展 `PersonaDefinition`、`DimensionAnalyzer`、`reader-endpoints.ts` 与复用 `RevisionService` 实现。当前关键缺口是 `/reader/analyze` endpoint 仍在 TODO 状态（分析空文本），且前后端 ConsensusReport/OverlayMarker 数据契约存在漂移，必须在 Phase 1 修复，否则上层功能无法可靠工作。

## Dimension Selection Rationale

基于 M26 Phase 1 目标（读者模拟 2.0 + 反 AI 味），选择以下分析维度：
- **architecture**: 多 persona 引擎、分析联动、De-AI 重写与现有 reader-simulation / analysis / revision 模块的集成架构。
- **implementation**: Persona 向量、反馈生成、A/B 测试 UI、风格检测器、重写策略的具体实现路径。
- **performance**: LLM 调用次数、缓存策略、前端响应性能。
- **security**: LLM 提示词安全、用户文本隐私、MCP 端点权限。
- **concept**: 反 AI 味检测的定义、风格指纹漂移、感官覆盖不足的判定标准。
- **comparison**: 与 QMAI De-AI、NovelForge 卡片工作流的差异化定位。

## Discussion Rounds

### Round 1: Initial Exploration

**Sources**: maestro delegate CLI analysis (cld-211121-57ac), roadmap RMAP-M26, state.json, arch specs, manual code review of `src-ts/reader/PersonaDefinition.ts`, `src-ts/protocols/revision.ts`, `desktop/src/api/writing-craft.ts`, `desktop/src/components/reader/*.tsx`.

**Key findings**:
1. **Persona 扩展成本最低** — `PersonaDefinition.ts:13-27` 的 `ReaderPersona` 接口已预留 `focusAreas`/`biases`，新增预设只需扩展 `PRESET_PERSONAS` 工厂。
2. **A/B 测试天然可复用 ConsensusEngine** — `DualEngine.analyze` 已支持多 persona 并行，`ConsensusEngine.buildConsensus` 可直接比较两个版本的反应差异。
3. **Anti-AI-flavor 检测应作为独立 detector 层插入** — 遵循 spec「关键词检测为第一层、LLM 为增强层」，宜新增 `src-ts/reader/ai-flavor-detector.ts`。
4. **De-AI rewrite 与 RevisionService 最适配** — `RevisionServiceImpl.revise` 的 `writerFn` 当前是 identity 函数，注入 De-AI 策略即可闭环。
5. **前后端类型/数据契约存在漂移** — `OverlayBridge.ts:54-62` 的 `ConsensusItem` 与 `ConsensusEngine.ts:23-31` 不同形，且 `ReportGenerator.tsx` 在前端重新拼装 `ConsensusReport`。
6. **reader endpoint 仍在 TODO 状态** — `reader-endpoints.ts:165-167` 把 manuscriptText 硬编码为空字符串，导致现有分析结果无意义。

**Top 3 Technical Risks**:
| 优先级 | 风险 | 严重度 | 位置 |
|---|---|---|---|
| 1 | Reader endpoint 分析空文本 | 🔴 高 | `src-ts/reader/mcp/reader-endpoints.ts:165-167` |
| 2 | 前后端 ConsensusReport / OverlayMarker 类型漂移 | 🟠 中 | `OverlayBridge.ts:54-62` vs `ConsensusEngine.ts:23-31` |
| 3 | 自定义画像与缓存仅存内存 | 🟠 中 | `src-ts/reader/mcp/reader-endpoints.ts:49-50` |

**Discussion points**:
- 是否在 Phase 1 修复空文本 TODO，还是仅作为已知约束让 plan 阶段处理？
- Anti-AI-flavor 检测器应作为独立 detector 还是新增 QualityDimension？
- De-AI rewrite 应接入 RevisionService 还是 Co-Writing 管线？
- 自定义画像持久化是否属于 Phase 1 必须，还是可降级为内存存储 + 后续迭代？

**Open questions**:
- 9 维度分析权重反馈的具体交互流程（用户在哪里点赞/踩？权重如何回写？）。
- A/B 测试视图与现有 ReaderOverlay 的渲染关系。
- 中文 i18n 与网文维度增强的具体 key 变更范围。

## Decision Trail

> **Decision 1**: Anti-AI-flavor 检测采用独立 detector 层，不扩展 QualityDimension 枚举。
> - **Context**: 避免破坏现有 9 维度分析契约，保持 detector 可独立演进。
> - **Options considered**: A) 新增 QualityDimension；B) 独立 detector 由 DualEngine 调用。
> - **Chosen**: B — 独立 detector `src-ts/reader/ai-flavor-detector.ts`。
> - **Reason**: 选项 A 需要改 `quality/types.ts:13-18` 并扩散到所有维度消费点，风险高；选项 B 通过 `DualEngine.runEditorEngine` 返回 `editorialAnalysis.aiFlavor` 字段，最小侵入。
> - **Evidence Source**: maestro delegate CLI analysis (cld-211121-57ac), `src-ts/reader/DualEngine.ts:93-110`。
> - **Impact**: Plan 阶段需新增 detector 文件与 MCP endpoint，但无需改动 analysis dimension 枚举。

> **Decision 2**: De-AI rewrite 复用 RevisionService 管线，而非在 reader 模块引入 LLM writer。
> - **Context**: M25 已建立 IRevisionService + RevisionServiceImpl，writerFn 当前为 identity， critic 循环已就绪。
> - **Options considered**: A) 在 reader-endpoints 直接调用 LLM writer；B) 复用 RevisionService 将 De-AI 作为 qualityGoals。
> - **Chosen**: B — 通过 RevisionService.revise 注入 De-AI 策略。
> - **Reason**: 保持 reader 模块只读分析职责，复用现有 revision 循环、session tracking、learning insights。
> - **Evidence Source**: maestro delegate CLI analysis, `src-ts/protocols/revision.ts:59-127`, `src-ts/services/revision-service.ts:69-174`。
> - **Impact**: Plan 阶段需实现真正的 writerFn 并新增 De-AI revision config。

> **Decision 3**: Phase 1 必须修复 `/reader/analyze` 空文本 TODO。
> - **Context**: 当前 endpoint 把 manuscriptText 硬编码为空字符串，所有上层功能依赖真实文本输入。
> - **Options considered**: A) Phase 1 修复；B) 延后到 plan/execute 阶段作为子任务。
> - **Chosen**: A — 在 analyze 阶段明确列为前置依赖，plan 阶段第一个 wave 修复。
> - **Reason**: 如果不修复，persona 扩展、A/B 测试、权重反馈都无法验证，功能建在虚假结果上。
> - **Evidence Source**: maestro delegate CLI analysis, `src-ts/reader/mcp/reader-endpoints.ts:165-167`。
> - **Impact**: Plan 阶段 Wave 1 必须包含 endpoint 真实文本接入，可能依赖 workspace/manuscript 服务。

## Intent Coverage Matrix

| # | Original Intent | Status | Where Addressed | Notes |
|---|----------------|--------|-----------------|-------|
| 1 | 明确 R-M26-001~006 实现范围 | ✅ addressed | Round 1 | 映射到 reader、analysis、revision、i18n 模块 |
| 2 | 识别与 M23/M25 的依赖关系 | ✅ addressed | Round 1 | reader-state (M23), RevisionService/style (M25) |
| 3 | 输出 Locked/Free/Deferred 决策 | ✅ addressed | Decision Trail + context.md | 3 个 Locked 决策已记录 |
| 4 | 为 plan 提供可验收的输入 | ✅ addressed | conclusions.json + context.md | implementation_scope 待写入 |

## Session Statistics

- **Rounds**: 1
- **Decisions**: 3
- **Sources**: roadmap RMAP-M26, state.json, arch specs, maestro delegate CLI analysis (cld-211121-57ac), manual code review
- **Artifacts**: discussion.md, analysis.md, conclusions.json, context.md, context-package.json

## Related
- [[spec:project:architecture-constraints-033]]
