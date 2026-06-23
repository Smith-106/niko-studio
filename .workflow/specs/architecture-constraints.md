---
title: "Architecture Constraints"
readMode: required
priority: high
category: arch
keywords:
  - architecture
  - module
  - layer
  - boundary
  - dependency
  - structure
---

---
title: Architecture Constraints
readMode: required
priority: high
category: arch
keywords:
  - architecture
  - module
  - layer
  - boundary
  - dependency
  - nuxt
related:
  - "spec:project:harvest-brainstorm-error-propagation"
  - "spec:project:learnings"---








# Architecture Constraints

Auto-generated from project structure. Update manually as architecture evolves.

## Module Structure
- Type: Nuxt 3 monolith (full-stack)
- Key directories:
  - pages/ — 路由页面 (Nuxt 文件路由)
  - components/ — Vue 组件
  - composables/ — 共享组合式函数
  - server/ — Nitro API 路由 + 中间件
  - stores/ — Pinia 状态管理
  - layouts/ — 页面布局
  - plugins/ — Nuxt 插件
  - middleware/ — 路由守卫
  - assets/ + public/ — 静态资源
  - utils/ — 工具函数
  - types/ — TypeScript 类型定义
  - i18n/ — 国际化

## Layer Boundaries
- UI 层: pages/ → components/ → composables/ → stores/
- API 层: server/routes/ → server/utils/ → stores/
- 禁止 server/ 导入前端组件
- Composables 可导入 stores 和 utils
- Components 通过 composables 访问数据，不直接调用 API

## Dependency Rules
- Nuxt auto-imports: ref, computed, navigateTo 等 (无需显式导入)
- 优先用 composables 而非直接在组件中写逻辑
- 服务端路由使用 defineEventHandler + H3

## Technology Constraints
- Runtime: Node.js >= 18
- Framework: Nuxt 3 (Vue 3 + Nitro)
- Module system: ESM
- TypeScript: strict mode
- CSS: Tailwind CSS v3

## Entries

<spec-entry category="arch" keywords="m24,milestone-scope,tech-debt,priority" date="2026-06-13" title="M24 范围：技术债优先 F-001~F-006 + 仅一个新功能 F-007" description="技术债是特性质量基础，限 1 个新功能避免范围膨胀">
### M24 范围：技术债优先 F-001~F-006 + 仅一个新功能 F-007
三个角色一致：技术债是特性质量基础，限 1 个新功能避免范围膨胀。F-007 叙事可视化优先于 F-008 修订工作流（用户感知高、技术依赖少、MVP 可交付、市场差异化）。
</spec-entry>

<spec-entry category="arch" keywords="m24,execution-order,dependency-chain" date="2026-06-13" title="M24 执行顺序：5 阶段依赖链驱动" description="依赖链驱动的 5 阶段执行顺序">
### M24 执行顺序：5 阶段依赖链驱动
Phase 1: F-001+F-003(独立低风险); Phase 2: F-004+F-005 并行; Phase 3: F-002(依赖 F-001); Phase 4: F-006(最高风险); Phase 5: F-007(依赖 F-002+F-006)。
</spec-entry>

<spec-entry category="arch" keywords="version-authority,release,APP_VERSION" date="2026-06-13" title="版本权威已统一到 src-ts/config/index.ts APP_VERSION" description="单一 release authority 在 APP_VERSION，所有版本源统一">
### 版本权威已统一到 src-ts/config/index.ts APP_VERSION
单一 release authority 在 APP_VERSION，所有版本源统一。
</spec-entry>

<spec-entry category="arch" keywords="desktop,capability-contract,sidecar" date="2026-06-13" title="Desktop capability contract 收束为单一前端权限真相" description="main-desktop 允许 core:default/process:default/updater:default + 显式 fs:* 权限">
### Desktop capability contract 收束为单一前端权限真相
main-desktop 允许 core:default/process:default/updater:default + 显式 fs:* 权限。
</spec-entry>

<spec-entry category="arch" keywords="triage,blocker-semantics,release" date="2026-06-13" title="Triage blocker 语义收窄：排除 legacy/stale noise" description="只计 current/parseable/triage_state 不在 {resolved,rejected} 的">
### Triage blocker 语义收窄：排除 legacy/stale noise
只计 current/parseable/triage_state 不在 {resolved,rejected} 的。
</spec-entry>

<spec-entry category="arch" keywords="architecture,revision-orchestrator,mcp,backend" date="2026-06-13" title="RevisionOrchestrator 作为独立服务而非 React Hook" description="自主 agent 必须脱离 UI 工作，所有新 MCP endpoint 遵循现有 /agent/* 和 /analysis/* 模式">
### RevisionOrchestrator 作为独立服务而非 React Hook
自主 agent 必须脱离 UI 工作，所有新 MCP endpoint 遵循现有 /agent/* 和 /analysis/* 模式。
</spec-entry>

<spec-entry category="arch" keywords="architecture,worldview,knowledge-service,separation" date="2026-06-13" title="Worldview extraction 独立于 knowledge-service" description="关注点分离：knowledge-service 处理通用 embedding/retrieval，worldview extractor 处理域特定叙事设定提取">
### Worldview extraction 独立于 knowledge-service
关注点分离：knowledge-service 处理通用 embedding/retrieval，worldview extractor 处理域特定叙事设定提取。
</spec-entry>

<spec-entry category="arch" keywords="architecture,lifecycle-hooks,backward-compatibility,opt-in" date="2026-06-13" title="Lifecycle hooks 作为可选中间件保证向后兼容" description="BaseAgent 上可选 middleware，现有 agent 不变，lifecycle 参与是 opt-in">
### Lifecycle hooks 作为可选中间件保证向后兼容
BaseAgent 上可选 middleware，现有 agent 不变，lifecycle 参与是 opt-in。
</spec-entry>

<spec-entry category="arch" keywords="architecture,memory,stm,ltm,reuse" date="2026-06-13" title="STM/LTM 复用现有六维记忆基础设施" description="复用已验证的 memory 系统而非构建并行机制">
### STM/LTM 复用现有六维记忆基础设施
复用已验证的 memory 系统而非构建并行机制。
</spec-entry>

<spec-entry category="arch" keywords="docs-site,architecture,navigation,guides" date="2026-06-13" title="Docs-site 添加 guides 分类而非重载 architecture" description="Mermaid 保持 copyable code block，不引入新渲染依赖">
### Docs-site 添加 guides 分类而非重载 architecture
Mermaid 保持 copyable code block，不引入新渲染依赖。
</spec-entry>

<spec-entry category="arch" keywords="docs-site,constraints,runtime-safety" date="2026-06-13" title="Docs-site 关键约束：不改运行时行为" description="不改 desktop 运行时、Gateway endpoint、sync 实现或 release pipeline">
### Docs-site 关键约束：不改运行时行为
不改 desktop 运行时、Gateway endpoint、sync 实现或 release pipeline。
</spec-entry>

<spec-entry category="arch" keywords="tech-debt,debug-strategy,test-environment" date="2026-06-13" title="Tech debt 修复优先级：先恢复测试环境再修 API 契约" description="避免把环境噪音误判为代码缺陷，优先最小修复">
### Tech debt 修复优先级：先恢复测试环境再修 API 契约
避免把环境噪音误判为代码缺陷，优先最小修复。
</spec-entry>

<spec-entry category="arch" keywords="architecture,visualization,enhance-not-rebuild" date="2026-06-13" title="可视化 MVP 增强而非重建策略" description="共享类型消除 desktop 与 src-ts 间重复">
### 可视化 MVP 增强而非重建策略
共享类型消除 desktop 与 src-ts 间重复。
</spec-entry>

<spec-entry category="arch" keywords="writing-tool,story-bible,knowledge-engine" date="2026-06-13" title="Story Bible 扩展现有 KnowledgeEngine 无并行存储" description="必须扩展现有引擎，避免数据同步问题。每个实体携带 confidence_score 和 source_chapters">
### Story Bible 扩展现有 KnowledgeEngine 无并行存储
必须扩展现有引擎，避免数据同步问题。每个实体携带 confidence_score 和 source_chapters。
</spec-entry>

<spec-entry category="arch" keywords="writing-tool,co-writing,context-pipeline" date="2026-06-13" title="Co-Writing Engine 三模式共享上下文管线" description="Auto/Guided/Directed 三模式共享 Context Scraper→Prompt Assembler→Model Router→Output Aggregator 管线">
### Co-Writing Engine 三模式共享上下文管线
Auto/Guided/Directed 三模式共享 Context Scraper→Prompt Assembler→Model Router→Output Aggregator 管线。
</spec-entry>

<spec-entry category="arch" keywords="writing-tool,reader-simulation,dual-engine" date="2026-06-13" title="Reader Simulation 并行双引擎架构" description="Persona Engine + Editorial Analysis Engine 并行运行，一个失败另一个继续">
### Reader Simulation 并行双引擎架构
Persona Engine + Editorial Analysis Engine 并行运行，一个失败另一个继续。
</spec-entry>

<spec-entry category="arch" keywords="writing-tool,mcp-endpoints,integration-surface" date="2026-06-13" title="所有新能力必须通过 MCP endpoint 暴露" description="无直接 service-to-frontend 调用">
### 所有新能力必须通过 MCP endpoint 暴露
无直接 service-to-frontend 调用。
</spec-entry>

<spec-entry category="arch" keywords="m26,milestone-scope,performance,llm" date="2026-06-13" title="M26 范围：Performance Optimization + Deep LLM Integration" description="F-013 是技术债优先(OOM/无缓存)，F-014 是功能核心(智能功能依赖 LLM)">
### M26 范围：Performance Optimization + Deep LLM Integration
F-013 是技术债优先(OOM/无缓存)，F-014 是功能核心(智能功能依赖 LLM)。
</spec-entry>

<spec-entry category="arch" keywords="m26,llm-integration,adapter-pattern" date="2026-06-13" title="LLM adapter 按提供者粒度而非统一抽象层" description="每个提供者 API 差异显著，统一抽象层成本过高。Ollama 因 OpenAI 兼容 API 纳入">
### LLM adapter 按提供者粒度而非统一抽象层
每个提供者 API 差异显著，统一抽象层成本过高。Ollama 因 OpenAI 兼容 API 纳入。
</spec-entry>

<spec-entry category="arch" keywords="obsidian-integration,optional-module" date="2026-06-13" title="Obsidian 集成为可选模块：应用无 vault 也能运行" description=".niko-studio/ 元数据目录与 .obsidian/ 并行，不侵入 vault">
### Obsidian 集成为可选模块：应用无 vault 也能运行
.niko-studio/ 元数据目录与 .obsidian/ 并行，不侵入 vault。
</spec-entry>

<spec-entry category="arch" keywords="convergence,narrative-authority,workspace-scoped" date="2026-06-13" title="收敛 graph/memory/wiki/retrieval/critic 到 workspace-scoped narrative authority" description="统一权威模型替代碎片化服务访问">
### 收敛 graph/memory/wiki/retrieval/critic 到 workspace-scoped narrative authority
统一权威模型替代碎片化服务访问。
</spec-entry>

<spec-entry category="arch" keywords="iterative-verification,re-planning,parallel-implementation" date="2026-06-13" title="支持 iterative verification + re-planning + parallel implementation" description="叙事权威架构必须支持迭代验证、失败重规划、安全并行">
### 支持 iterative verification + re-planning + parallel implementation
叙事权威架构必须支持迭代验证、失败重规划、安全并行。
</spec-entry>

<spec-entry category="arch" keywords="docs-site,state-authority,canon,wiki" date="2026-06-13" title="Wiki/canon authority 胜过 graph/memory projections" description="冲突时 Wiki/canon 赢，graph/memory 是投影/检索面">
### Wiki/canon authority 胜过 graph/memory projections
冲突时 Wiki/canon 赢，graph/memory 是投影/检索面。
</spec-entry>

<spec-entry category="arch" keywords="m24,schema-version,backward-compatibility" date="2026-06-13" title="统一 schema version header $schema_version 跨所有持久化 JSON" description="格式 YYYY-MM，additive 变更 bump minor，structural 变更 bump major，major 版本内不可删除字段">
### 统一 schema version header $schema_version 跨所有持久化 JSON
格式 YYYY-MM，additive 变更 bump minor，structural 变更 bump major，major 版本内不可删除字段。
</spec-entry>

<spec-entry category="arch" keywords="m24,data-contract,semver,typed-contracts" date="2026-06-13" title="Frontend-backend data contract registry with semver" description="DataContract<TReq,TRes> 带 $contract_id 和 $contract_version。后端支持当前+前一 major 版本">
### Frontend-backend data contract registry with semver
DataContract<TReq,TRes> 带 $contract_id 和 $contract_version。后端支持当前+前一 major 版本。
</spec-entry>

<spec-entry category="arch" keywords="m24,backward-compatibility,interface-contract" date="2026-06-13" title="5 接口签名 M24 不可变：WorkflowEngine/useI18n/EvaluationPanel-props/craft-catalog-types/API-endpoints" description="内部实现可自由重构，消费者代码不需修改">
### 5 接口签名 M24 不可变：WorkflowEngine/useI18n/EvaluationPanel-props/craft-catalog-types/API-endpoints
内部实现可自由重构，消费者代码不需修改。
</spec-entry>

<spec-entry category="arch" keywords="m24,error-handling,graceful-degradation" date="2026-06-13" title="Cross-feature error propagation: F-005 不阻启动, F-006 触发 checkpoint, F-007 隔离 ErrorBoundary, F-004 fallback to key" description="瞬态→指数退避, 数据→bundled default, 逻辑→降级, 致命→crash report">
### Cross-feature error propagation: F-005 不阻启动, F-006 触发 checkpoint, F-007 隔离 ErrorBoundary, F-004 fallback to key
瞬态→指数退避, 数据→bundled default, 逻辑→降级, 致命→crash report。
</spec-entry>

<spec-entry category="arch" keywords="writing-craft,architecture,M14,extend-not-create" date="2026-06-13" title="M14 新增知识扩展现有模块而非新建独立文件" description="避免 barrel export 膨胀和碎片化">
### M14 新增知识扩展现有模块而非新建独立文件
避免 barrel export 膨胀和碎片化。
</spec-entry>


<spec-entry category="arch" keywords="api-evolution,test-drift,mock-assertion,callapi,cypher" date="2026-06-16" title="api-evolution-test-drift" description="API 演进导致测试 drift 的根因模式和预防措施" source="main@caee8448">

### api-evolution-test-drift

当 API 接口签名变更（新增参数、参数重命名、header 变化、Cypher 格式演进）时，对应的测试 mock 断言必须同步更新。典型症状：callApi 新增 extraHeaders 参数、buildGraphMergeMutation Cypher 格式从 JSON 风格改为属性风格、API key 从 query param 改为 header。预防措施：每次 API 签名变更后立即 grep 相关测试文件的 mock 断言。

</spec-entry>

<spec-entry category="arch" keywords="open-decision,model-router,story-bible,reader-simulation" date="2026-06-18" title="写作工具新能力开放决策" description="三个关键开放决策：Model Router 默认 Claude API；SB 实体版本策略默认 Mutable + audit log；Reader Simulation 默认 Async with progress">
### 写作工具新能力开放决策
三个关键开放决策：Model Router 默认 Claude API；SB 实体版本策略默认 Mutable + audit log；Reader Simulation 默认 Async with progress。
</spec-entry>

<spec-entry category="arch" keywords="Anti-AI-flavor,独立检测器,QualityDimension,架构约束" date="2026-06-20" title="Anti-AI-flavor 采用独立 detector 层" description="不扩展 QualityDimension 枚举，保持独立 detector 避免破坏现有 9 维度分析契约">
### Anti-AI-flavor 采用独立 detector 层
M26 决定将 anti-AI-flavor 检测作为独立 detector 实现，而非扩展现有 QualityDimension 枚举。理由：最小侵入，避免扩散改动到既有分析管道。独立 detector 通过 DualEngine Promise.all 与 9 维度分析并行运行，结果合并到 ConsensusReport。
参考：src-ts/reader/ai-flavor-detector.ts, 决策来源 ANL-20260618
</spec-entry>

<spec-entry category="arch" keywords="De-AI,RevisionService,复用,注入" date="2026-06-20" title="De-AI rewrite 复用 IRevisionService.revise" description="通过 IRevisionService.revise 注入 anti-ai/style-shift qualityGoals，保持 reader 模块只读分析职责">
### De-AI rewrite 复用 IRevisionService.revise
M26 的 De-AI / 风格变换重写通过 IRevisionService.revise() 注入 qualityGoals（anti-ai, style-shift），复用 M25 建立的 revision 循环与 session tracking。reader 模块保持只读分析职责，/reader/de-ai endpoint 调用 RevisionService。
参考：src-ts/services/revision-service.ts, src-ts/protocols/revision.ts, 决策来源 ANL-20260618
</spec-entry>

<spec-entry category="arch" keywords="ConsensusReport,前后端契约,OverlayMarker,统一" date="2026-06-20" title="前后端 ConsensusReport 统一" description="前端删除本地聚合逻辑，统一消费后端 ConsensusReport">
### 前后端 ConsensusReport 统一
M26 统一了前后端 ConsensusReport / OverlayMarker 数据契约。前端 ReportGenerator 删除本地聚合逻辑，直接消费后端返回的 ConsensusReport。前端新建 desktop/src/api/reader.ts 统一 API 层。
参考：desktop/src/components/reader/ReportGenerator.tsx, desktop/src/api/reader.ts, 决策来源 PLN-20260618
</spec-entry>

<spec-entry category="arch" keywords="画像持久化,JSON,reader-personas" date="2026-06-20" title="自定义画像持久化 .niko-studio/reader-personas.json" description="自定义画像持久化到 JSON 文件，进程重启不丢失">
### 自定义画像持久化 .niko-studio/reader-personas.json
M26 实现自定义画像持久化：使用 .niko-studio/reader-personas.json 存储用户自定义 persona，/reader/personas/custom 保存，重启后可读取。
参考：src-ts/reader/mcp/reader-endpoints.ts, 决策来源 PLN-20260618
</spec-entry>

<spec-entry category="arch" keywords="shutdown,cleanup,lifecycle,no-op,反模式,资源泄漏" date="2026-06-21" title="shutdown-no-op 反模式 — shutdown 函数必须实际清理资源" description="shutdown/close 函数必须执行实际资源清理（flush state, close connections, stop timers），空实现是架构违规">
### shutdown-no-op 反模式 — shutdown 函数必须实际清理资源
接口承诺 shutdown 但实现仅 log 的反模式导致资源泄漏。修复：`shutdownGatewayControlPlane` 必须调用 `container.shutdown()` + WS relay close + rate limiter stop。检查方法：grep `shutdown` 函数体，确认非空实现。边界：shutdown 函数必须执行实际资源清理（flush state, close connections, stop timers），空实现是架构违规。
来源：odyssey-improve C5, gateway-control-plane.ts:21
</spec-entry>

<spec-entry category="arch" keywords="sigterm,handler,graceful-shutdown,协调,优雅关闭" date="2026-06-21" title="独立 SIGTERM handler 应统一到 shutdown 链" description="各服务独立注册 SIGTERM/SIGINT 导致关闭顺序不可控，应统一到 gateway-bootstrap shutdown 链">
### 独立 SIGTERM handler 应统一到 shutdown 链
`process.on('SIGTERM/SIGINT', () => { shutdown(); process.exit(0) })` 独立注册无协调，导致关闭顺序不可控、资源竞争。修复：统一到 gateway-bootstrap shutdown 链，各服务仅暴露 `shutdown()` 方法。例外：独立运行的服务（db pool, backup manager, token service）独立注册合理。
来源：odyssey-improve GP2, gateway-bootstrap.ts:119-120
</spec-entry>

<spec-entry category="arch" keywords="detector,independent-layer,enum-extension,shared-constants,minimal-invasion" date="2026-06-21" title="新增分析轴作为独立 detector 层而非 enum 扩展，并显式指定共享常量模块" description="跨切分析关注点（AI-flavor/sentiment）应建独立模块 + 可选字段挂载，避免扩散到既有 enum；同时显式指定共享常量模块位置防双写" source="retrospective">
### 新增分析轴作为独立 detector 层而非 enum 扩展，并显式指定共享常量模块
新增跨切分析关注点（AI-flavor、sentiment 等）时，建为独立模块（自有 indicator 类型 + 纯函数入口 + Optional<T> 挂载到既有结果对象），而非扩展核心 enum（如 QualityDimension）。这保持核心 enum 稳定，新 detector 可独立演进或跳过，不触碰 consensus 聚合，保留向后兼容。

**关键补充**：独立 detector 层决策必须同时指定共享常量模块路径。若新 detector 与既有服务共用同一组领域常量（如 AI 模板词库），未指定共享层会自然演化为双写并漂移（M26 的 MAINT-002：detector 与 revision-service 各定义 60+/40+ 模板词并已 diverged）。

**模式**：`enum + interface + Record<Enum, Interface> + 检测函数` 四层结构，新轴作为 `result.aiFlavor?: AIFlavorResult` 可选字段。
来源：quality-retrospective M26-P1 INS-67dcee40, ai-flavor-detector.ts:18, plan.json:58, review.json:182 MAINT-002
</spec-entry>

<spec-entry category="arch" keywords="reuse,transformation-service,config-injection,strategy-pattern,revision" date="2026-06-21" title="复用 transformation service 通过 config 注入意图而非 fork" description="新功能需要文本重写（de-AI/style-shift）时扩展既有 RevisionConfig 注入 intent 字段，而非建并行 rewrite 管线" source="retrospective">
### 复用 transformation service 通过 config 注入意图而非 fork
新功能需要文本重写（de-AI、style-shift）时，扩展现有 RevisionConfig 增加可选 intent 字段（quality_goals、target_style、revision_mode）并注入新目标，而非建并行 rewrite 管线。服务内部策略梯（LLM → 规则 → identity fallback）免费服务新用例，避免重复模板字典，保持单一代码路径维护。

**M26 验证**：De-AI rewrite 复用 `IRevisionService.revise`，将 De-AI 目标作为 qualityGoals 注入，零额外管线，复用 M25 session tracking，31 tests passed。
来源：quality-retrospective M26-P1 INS-e7dac8cc, revision-service.ts:192-237, plan.json:59, TASK-005-summary.md:5
</spec-entry>

<spec-entry category="arch" keywords="frontend-backend,import-boundary,shared-types,module-separation,contract" date="2026-06-21" title="前端模块只从 desktop/src/api 导入领域类型，禁止跨 desktop/src-ts 边界" description="frontend 跨边界 import backend 类型（../../../../src-ts）破坏模块分离并制造构建耦合，应从 api 层单一来源导入" source="retrospective">
### 前端模块只从 desktop/src/api 导入领域类型，禁止跨 desktop/src-ts 边界
前端组件 `from '../../../../src-ts/reader/ConsensusEngine'` 跨 desktop/src-ts 边界，用脆弱相对路径把后端实现类型拉入 bundle。当 api 层已重定义同一 interface（desktop/src/api/reader.ts）时，修复是提取共享 types 包或让 api 层成为前端唯一导入源。

**规则**：前端组件只从 `desktop/src/api/*` 导入领域类型，禁止从 `../src-ts/*` 导入。验收门槛应增加 grep 跨边界 import 检查项——M26 的 DEC-3 契约统一意图被 ARCH-001 实现期 import 捷径绕过。
来源：quality-retrospective M26-P1 INS-d5187f08, ReportGenerator.tsx:3, reader.ts:17, review.json:138 ARCH-001
</spec-entry>

<spec-entry category="arch" keywords="recovery,parallel,mutex,atomicity" date="2026-06-21" title="Recovery parallel fix strategy" description="WS1 (workspace-scoped mutex) + WS2 (quickRollback atomicity) can be implemented in parallel; WS3 (test matrix) depends o">
### Recovery parallel fix strategy
WS1 (workspace-scoped mutex) + WS2 (quickRollback atomicity) can be implemented in parallel; WS3 (test matrix) depends on both for behavioral stability. Lock domain limited to git-mutating critical sections only to avoid throughput regression.
</spec-entry>
