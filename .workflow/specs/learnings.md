---
title: Learnings
readMode: optional
priority: medium
category: learning
keywords:
  - bug
  - lesson
  - gotcha
  - learning
related:
  - knowhow-doc-harvest-other-bookworld-ablation
---


# Learnings

## Entries

<spec-entry category="learning" keywords="writing-craft,knowledge-integration,Record-pattern,enum-driven" date="2026-05-07" source="milestone-complete">

### 写作知识引擎的数据驱动架构模式

M13 成功将 54 本写作书籍 + 4 条悬疑路径 + 5 卷网文研究的结构化知识整合到 niko-studio 分析引擎中。

核心模式：每个知识模块使用 `enum + interface + Record<Enum, Interface> + 检测函数` 的四层结构。这确保了：
- 类型安全（enum 驱动所有 key）
- 可扩展（新增知识只需添加枚举值 + record entry）
- 可测试（每个检测函数可独立验证）
- 与 LLM 分析器解耦（关键词检测作为第一层，LLM 作为增强层）

此模式已在 `plot-templates.ts`（20 种情节模式）、`archetype-catalog.ts`（45 种原型）、`craft-catalog.ts`（SUBGENRE_RULES + SATISFACTION_PATTERNS）中验证。
Milestone: M13

</spec-entry>

<spec-entry category="learning" keywords="Chinese-web-novel,reader-satisfaction,satisfaction-density,hook-detection" date="2026-05-07" source="milestone-complete">

### 中文网络文学的读者满意度量化分析

基于《中国网络文学阅读潮流研究》（5 卷）实现的 `reader-satisfaction-analyzer.ts` 提供了：
- 4 层爽点模型（生理/心理/社交/成就）
- 章节钩子检测（5 种类型：悬念/问题/预告/威胁/承诺）
- 期待-延迟-释放节奏分析
- 爽点密度（每千字）量化

关键发现：中文网文的读者留存与爽点密度高度相关（黄金三章法则），这与西方创意写作教学中强调的 "tension curve" 有本质差异。两种传统互补使用效果最佳。
Milestone: M13

</spec-entry>

<spec-entry category="learning" keywords="suspense-subgenre,本格推理,社会派,公平线索,detective-fiction" date="2026-05-07" source="milestone-complete">

### 悬疑流派的规则化检测

4 种悬疑流派的规则检测（本格推理/社会派/硬汉派/惊悚悬疑）通过 `SuspenseSubgenre` + `SUBGENRE_RULES` 实现。

每种流派定义：
- `coreRules`（必须遵守的创作规则）
- `requiredElements`（必须出现的元素）
- `forbiddenElements`（禁止出现的内容）
- `keywords`（典型/非典型信号词）

检测通过 `typical keyword 命中率 + required elements 覆盖率 - atypical 惩罚分` 计算置信度。第一版使用关键词匹配，后续可接入 LLM 进行深度语义分析。
Milestone: M13

</spec-entry>

<spec-entry category="learning" keywords="release,evidence-refresh,dependency-order" date="2026-06-13" title="先修 gate 再刷 evidence — 否则产生无效 NO_GO 证据" description="若先刷新 retained evidence 再修脚本，会产生更新但仍无效的 NO_GO 证据。不可 blanket disable triage blocker">
### 先修 gate 再刷 evidence — 否则产生无效 NO_GO 证据
若先刷新 retained evidence 再修脚本，会产生更新但仍无效的 NO_GO 证据。不可 blanket disable triage blocker。
</spec-entry>

<spec-entry category="learning" keywords="BookWorld,ablation,environment-response,scene-mode" date="2026-06-13" title="BookWorld ablation：移除环境响应损害沉浸感；移除场景模式损害所有维度" description="验证 win rate 75.36%，环境响应和场景模式是核心贡献因子">
### BookWorld ablation：移除环境响应损害沉浸感；移除场景模式损害所有维度
验证 win rate 75.36%，环境响应和场景模式是核心贡献因子。
</spec-entry>

<spec-entry category="learning" keywords="decision-threshold,writing,critic,quality,alignment" date="2026-06-18" title="决策阈值不一致已修复" description="writing.ts 与 critic.ts 的 totalScore 阈值统一为 APPROVED>=80, REVISE>=60, REWRITE<60">
### 决策阈值不一致已修复
writing.ts 使用 totalScore >= 40 判定 REWRITE 但 critic.ts 使用 >= 60。修复后统一为：APPROVED >= 80, REVISE >= 60, REWRITE < 60。移除了未文档化的 HUMAN_REVIEW 层级。
</spec-entry>

<spec-entry category="learning" keywords="autonovel,competitor-analysis,AI-novel-pipeline,quality-control" date="2026-06-18" title="autonovel 竞品分析：端到端 AI 小说生成管道的关键洞察" description="NousResearch/autonovel 展示了完整的 AI 小说生成管道，其双层质量控制系统和反 slop 机制值得借鉴">

### autonovel 竞品分析：端到端 AI 小说生成管道的关键洞察

**项目**: https://github.com/NousResearch/autonovel (1.2k stars, 229 forks)

**核心架构**:
- 5 层协同演化文档：voice.md → world.md → characters.md → outline.md → chapters/
- 4 阶段管道：Foundation → First Draft → Revision → Export
- 双层质量控制系统：
  - 机械层：regex 禁用词 + 结构反模式检测（OVER-EXPLAIN, TRIADIC LISTING 等）
  - LLM 层：Claude Opus 双角色评审（文学评论家 + 小说教授）
- 读者模拟：4 人格评审面板（编辑/类型读者/作家/初读者）

**与 niko-studio 的差异与启示**:
1. **autonovel 优势**: 完整的出版级输出（LaTeX PDF + ePub + 有声书 + 封面），niko-studio 目前缺少排版和导出能力
2. **niko-studio 优势**: 更丰富的中文写作知识库（54 本书 + 网文研究），更精细的读者满意度分析（爽点密度/钩子检测）
3. **可借鉴点**: 反 slop 检测机制（ANTI-SLOP.md + ANTI-PATTERNS.md）可补充到 writing-craft 分析器中；Elo 章节对比可用于 niko-studio 的章节质量排序
4. **关键差距**: autonovel 已实现端到端自动化，niko-studio 的 AI 共创引擎仍需人工介入较多

**Why**: 了解竞品技术路线有助于定位 niko-studio 的独特价值和改进方向。
**How to apply**: 将 autonovel 的反 slop 检测和双层质量控制思想整合到 niko-studio 的写作分析引擎中，同时保持中文写作知识库的优势壁垒。

</spec-entry>

<spec-entry category="learning" keywords="listen,eaddrinuse,promise,hang,nodejs,静默挂起" date="2026-06-21" title="Node.js listen() 不监听 error 导致静默挂起" description="server.listen() 不监听 error 事件时，端口占用导致 Promise 永远不 resolve/reject">
### Node.js listen() 不监听 error 导致静默挂起
`server.listen(port, host, callback)` 不监听 `error` 事件时，端口占用（EADDRINUSE）导致 Promise 永远不 resolve/reject，进程挂起无日志。修复：在 listen 前注册 `server.on('error', reject)` 事件。适用范围：所有 Node.js `http.Server.listen()` 包装为 Promise 的场景。
来源：odyssey-debug EG-17/H1, gateway-bootstrap.ts:46-50
</spec-entry>

<spec-entry category="learning" keywords="di,gateway,refactor,set-methods,全局可变状态,历史渐进" date="2026-06-21" title="C4 set*() DI 重构 deferred — 历史渐进导致全局可变状态" description="手动 DI 模式 set*() 替代构造器注入，需重构为 GatewayContext">
### C4 set*() DI 重构 deferred — 历史渐进导致全局可变状态
Gateway 控制面板使用 7 个 `set*()` 全局状态注入替代 proper DI（构造器注入），导致运行时状态不可预测、测试困难。根因：初始单模块 → 拆分时用 set* 保持兼容。修复方案：重构为 `GatewayContext` DI 容器，但成本高、影响面大，defer 到架构专项。
来源：odyssey-improve C4, health/config/mcp-admin/workflow 多处
</spec-entry>

<spec-entry category="learning" keywords="god-module,gateway-state,拆分,架构决策" date="2026-06-21" title="gateway-state.ts god module 拆分 deferred" description="跨 4 层的 god module 需架构决策后拆分">
### gateway-state.ts god module 拆分 deferred
`gateway-state.ts` 跨 4 层（HTTP/RPC/WebSocket/控制面板），包含 `as unknown as` 类型绕过，违反单一职责。拆分需架构决策：按功能边界（请求状态/连接管理/配置管理）拆分，避免循环依赖。defer 到架构专项。
来源：odyssey-improve H12/H13, gateway-state.ts
</spec-entry>

<spec-entry category="technique" keywords="wiki,knowledge-graph,orphan,type-bridge,knowhow,harvest" date="2026-06-21" title="Knowhow ↔ Spec type bridge 是知识图谱最高价值连接" description="harvest 产出的 knowhow 条目必须回链到对应 spec，否则成为孤立重灾区" source="wiki-connect">
### Knowhow ↔ Spec type bridge 是知识图谱最高价值连接
wiki-connect 2026-06-21 分析：knowhow 类条目原孤立率 62%（15/24），全部通过同概念 type bridge 连接到 spec 后孤立率降至 0%。brainstorm harvest 条目（7 个）原与架构决策完全断链，是知识沉淀关键断点。修复模式：harvest 产出 knowhow 时应自动建立 `related` 到对应 spec 条目。issue 条目（73+）天然孤立，建议按 category 聚合建立 issue-hub。健康分 28→51（+23），孤立 48→25（-23）。
</spec-entry>

<spec-entry category="technique" keywords="detector,independent-layer,enum-extension,shared-constants,minimal-invasion" date="2026-06-21" title="新增分析轴作为独立 detector 层而非 enum 扩展，并显式指定共享常量模块" description="跨切分析关注点应建独立模块+可选字段挂载，避免扩散到既有 enum；同时显式指定共享常量模块防双写" source="retrospective">
### 新增分析轴作为独立 detector 层而非 enum 扩展，并显式指定共享常量模块
新增跨切分析关注点（AI-flavor/sentiment 等）时，建独立模块（自有 indicator 类型+纯函数入口+Optional<T> 挂载），而非扩展核心 enum（QualityDimension）。保持核心 enum 稳定，新 detector 可独立演进或跳过。关键补充：独立 detector 层决策必须同时指定共享常量模块路径，否则自然演化为双写并漂移（M26 MAINT-002：detector/revision-service 各定义 60+/40+ 模板词并已 diverged）。
INS-67dcee40 · M26-P1 retrospective · 路由: spec(architecture-constraints)
</spec-entry>

<spec-entry category="pattern" keywords="reuse,transformation-service,config-injection,strategy-pattern,revision" date="2026-06-21" title="复用 transformation service 通过 config 注入意图而非 fork" description="新功能需文本重写时扩展既有 RevisionConfig 注入 intent 字段，而非建并行 rewrite 管线" source="retrospective">
### 复用 transformation service 通过 config 注入意图而非 fork
新功能需文本重写（de-AI/style-shift）时，扩展 RevisionConfig 增可选 intent 字段（quality_goals/target_style/revision_mode）注入新目标，而非建并行 rewrite 管线。服务内部策略梯（LLM→规则→identity fallback）免费服务新用例，避免重复模板字典，保持单一代码路径。M26 验证：De-AI 复用 revise 注入 qualityGoals，零额外管线，31 tests passed。
INS-e7dac8cc · M26-P1 retrospective · 路由: spec(architecture-constraints)
</spec-entry>

<spec-entry category="antipattern" keywords="frontend-backend,import-boundary,shared-types,module-separation,contract" date="2026-06-21" title="前端模块只从 desktop/src/api 导入领域类型，禁止跨 desktop/src-ts 边界" description="frontend 跨边界 import backend 类型破坏模块分离并制造构建耦合，应从 api 层单一来源导入" source="retrospective">
### 前端模块只从 desktop/src/api 导入领域类型，禁止跨 desktop/src-ts 边界
前端组件 `from '../../../../src-ts/reader/ConsensusEngine'` 跨 desktop/src-ts 边界，用脆弱相对路径把后端实现类型拉入 bundle。当 api 层已重定义同一 interface 时，应提取共享 types 包或让 api 层成为前端唯一导入源。规则：前端组件只从 desktop/src/api/* 导入领域类型，禁止从 ../src-ts/* 导入。验收门槛应增加 grep 跨边界 import 检查项。M26 DEC-3 契约统一意图被 ARCH-001 实现期 import 捷径绕过。
INS-d5187f08 · M26-P1 retrospective · 路由: spec(architecture-constraints) + issue ISS-20260621-014
</spec-entry>

<spec-entry category="pattern" keywords="wave-planning,depends_on,collision-notes,file-contention,parallel-edit" date="2026-06-21" title="共享文件多任务编辑通过 depends_on 串行化" description="单文件被 3+ 任务编辑时显式 depends_on 串行化而非仅依赖 wave 分组，并在 collision_notes 标注热点" source="retrospective">
### 共享文件多任务编辑通过 depends_on 串行化
单文件被 3+ 任务编辑时，仅靠 wave 分组不足以防止并行编辑冲突，需显式 depends_on 边串行化。M26 reader-endpoints.ts 被 6/10 任务编辑，规划时 collision_notes 标注 TASK-007 depends_on TASK-006，W3 三任务串行完成无合并冲突，0 rework。规则：任何被 3+ 任务编辑的文件，在 plan collision_notes 显式声明串行顺序，并在 task JSON depends_on 建立边，即使同 wave 内也串行。
INS-1f83f679 · M26-P1 retrospective · 路由: spec(coding-conventions)
</spec-entry>

<spec-entry category="antipattern" keywords="mcp-endpoint,input-validation,security-contract,max-length,path-traversal,finite-range" date="2026-06-21" title="MCP endpoint 强制输入校验三件套（长度/路径/数值范围）" description="任何接收文本/env-derived 路径/数值权重的 endpoint 都应内置 max-length + path containment + finite-in-range 三道校验" source="retrospective">
### MCP endpoint 强制输入校验三件套（长度/路径/数值范围）
MCP endpoint 接收外部输入必须强制三道校验（M26 SEC-001/002/004 同源缺失）：① 长度上限（文本输入 max-length 防内存耗尽）② 路径收容（env-derived 路径 path.resolve 后检查在允许根目录内，防 traversal）③ 数值范围（Number.isFinite + min/max，防 NaN/Infinity 污染计算，与 CORR-003 除零同类）。规则：新建 endpoint 验收清单必须含这三道校验，作为可复用 endpoint 安全契约。
INS-5e45e297 · M26-P1 retrospective · 路由: spec(coding-conventions)
</spec-entry>

<spec-entry category="antipattern" keywords="duplication,single-source-of-truth,ai-templates,maintainability" date="2026-06-21" title="提取 ai-templates 共享模块消除 detector/revision-service 模板词双写" description="AI 模板词库在两处独立维护并已 diverged，需提取共享模块并加 Set 去重" source="retrospective">
### 提取 ai-templates 共享模块消除 detector/revision-service 模板词双写
AI 模板词库在 ai-flavor-detector.ts 的 AI_TEMPLATE_PATTERNS 与 revision-service.ts 的 AI_TEMPLATE_REPLACEMENTS 两处独立维护并已 diverged；detector 单文件内还有重复 entries（值得注意的是/更有甚者等各出现 2-3 次），重复 entries 虚增匹配计数（CORR-002）。修复：提取 src-ts/reader/ai-templates.ts 共享模块导出 canonical pattern/replacement pairs，两处各自导入；对 AI_TEMPLATE_PATTERNS 加 Set 去重使重复条目 fail loudly。
INS-1f9cb386 · M26-P1 retrospective · 路由: issue ISS-20260621-010 [high]
</spec-entry>

<spec-entry category="gotcha" keywords="accepted-risk,division-by-zero,consensus-engine,NaN-propagation" date="2026-06-21" title="ConsensusEngine 除零 NaN 传播 (CORR-003 高危 deferred)" description="avgScore=scores.reduce/length 无空数组保护，除零产生 NaN 传播下游" source="retrospective">
### ConsensusEngine 除零 NaN 传播 (CORR-003 高危 deferred)
ConsensusEngine.ts:371 avgScore=scores.reduce(...)/scores.length 无空数组保护，某维度无 consensus 项时除以 0 产生 NaN，传播到下游聚合与前端展示。review 标记 high (CORR-003)，UAT 接受为风险但未在阶段内修复。修复方向：添加空数组保护 if (scores.length===0) return 0 并对 NaN 结果做 finite 校验。教训：high accepted_risk 必须开 issue 而非仅记 uat.md，否则跨 milestone 漂移。
INS-d1289883 · M26-P1 retrospective · 路由: issue ISS-20260621-011 [high]
</spec-entry>

<spec-entry category="gotcha" keywords="accepted-risk,llm-security,https,timeout,api-key" date="2026-06-21" title="RevisionService LLM fetch 缺 HTTPS/超时 (SEC-003 高危 deferred)" description="fetch 无 HTTPS 校验、无 AbortSignal/timeout、apiKey 明文 header" source="retrospective">
### RevisionService LLM fetch 缺 HTTPS/超时 (SEC-003 高危 deferred)
revision-service.ts:204 fetch(`${baseUrl}/chat/completions`) 无 HTTPS 协议校验（明文 HTTP 下 Bearer apiKey 泄露）、无 AbortSignal/timeout（挂起风险）、apiKey 在 header 明文。review 标记 high (SEC-003)，UAT 接受为风险但未在阶段内修复。修复方向：强制 baseUrl HTTPS 校验 + 添加 AbortSignal/timeout（默认 30s）+ apiKey 走安全配置。教训：high accepted_risk 必须开 issue 并纳入下一阶段 must_haves，不再 drift。
INS-76ba7cb1 · M26-P1 retrospective · 路由: issue ISS-20260621-012 [high]
</spec-entry>

<spec-entry category="antipattern" keywords="god-file,module-boundary,refactor-target,testability,DI" date="2026-06-21" title="reader-endpoints.ts 跨 8 维度 findings 拆分为路由/校验/服务/类型导出" description="单文件承载 8 个跨维度 findings 成 god module，含多 lazy singleton 阻碍测试隔离" source="retrospective">
### reader-endpoints.ts 跨 8 维度 findings 拆分为路由/校验/服务/类型导出
reader-endpoints.ts 单文件承载 8 个跨 correctness/security/architecture/maintainability/best-practices 的 findings（CORR-001, SEC-001/002/004, ARCH-002, MAINT-001, BP-001 等），已成 700+ 行 god module。含多个 module-level lazy singleton（ARCH-002）阻碍测试隔离与 DI。修复方向：按功能边界拆分为 endpoint 路由 / 输入校验 / 服务实例（singleton）/ 类型导出 分离。教训：新增 endpoint 文件天然吸引多种关注，应在任务拆分阶段即规划模块边界而非让单文件膨胀。
INS-19806c80 · M26-P1 retrospective · 路由: issue ISS-20260621-013 [medium]
</spec-entry>

<spec-entry category="antipattern" keywords="frontend-backend,import-boundary,contract,build-coupling" date="2026-06-21" title="修复 ReportGenerator.tsx 跨边界 import 后端 ConsensusEngine 类型 (ARCH-001)" description="前端跨边界 import 后端类型破坏 DEC-3 契约统一意图" source="retrospective">
### 修复 ReportGenerator.tsx 跨边界 import 后端 ConsensusEngine 类型 (ARCH-001)
ReportGenerator.tsx:3 import type { ConsensusReport, ConsensusItem } from '../../../../src-ts/reader/ConsensusEngine' 跨 desktop/src-ts 边界，用脆弱相对路径把后端实现类型拉入前端 bundle。desktop/src/api/reader.ts 已重定义同一 interface，应从 api 层唯一导入。review 标记 medium (ARCH-001)，与 DEC-3 契约统一意图冲突。修复方向：提取共享 types 包或让 api 层成为唯一类型源，删除跨边界 import；验收加 grep 跨边界 import 检查。
INS-d73c23ee · M26-P1 retrospective · 路由: issue ISS-20260621-014 [medium]
</spec-entry>

<spec-entry category="technique" keywords="rule-based,graceful-degradation,observability,llm-fallback" date="2026-06-21" title="分析功能规则优先 + LLM 增强分层，降级记录可观测日志" description="规则可枚举的分析功能应 rules-first + LLM 作增强层，外部依赖缺失时优雅降级并记录当前路径" source="retrospective">
### 分析功能规则优先 + LLM 增强分层，降级记录可观测日志
分析功能规则可枚举时（AI-flavor/可读性统计等），采用 rules-first + LLM 作增强层：Layer1 纯规则（regex+统计，零 LLM 依赖，微秒级，确定性可测），Layer2 可选 LLM 增强（仅规则不足处），外部依赖缺失时优雅降级不崩溃，并记录当前执行路径（rules-only/LLM-enhanced）便于 UAT 识别。M26 验证：85% coverage + 12 确定性测试 + LLM 未配置时降级规则重写。详见 knowhow KNW-retro-rule-first-llm-enhancement-2026-06-21。
INS-8ab166cd · M26-P1 retrospective · 路由: note
</spec-entry>

<spec-entry category="gotcha" keywords="verification,must-have-truths,review-gap,boundary-check" date="2026-06-21" title="结构验证 0-gap 不代表代码健康，must-have truths 纳入边界与安全约束" description="verification 6/6 passed + 0 gaps 但同批代码 review 发现 21 findings 含 2 high" source="retrospective">
### 结构验证 0-gap 不代表代码健康，must-have truths 纳入边界与安全约束
verification.json 检查 truth/artifact/key_link 存在性，M26 6/6 passed 且 0 gaps 给出绿色信号，但同批代码 review 发现 21 问题含 2 high（除零、LLM HTTPS）。结构验证的 0-gap 绿色掩盖了真实风险，因 must-have truths 未纳入边界与安全约束。规划 must_have.truths 时应包含：空数组/除零保护、协议强制（HTTPS）、超时/abort、输入范围校验。dimensional review 即使 verification 绿色也不可省略——两层测量不同事物：verification=结构是否存在并接线，review=代码跨维度是否行为正确。详见 knowhow KNW-retro-verification-green-not-healthy-2026-06-21。
INS-f54a8bff · M26-P1 retrospective · 路由: note
</spec-entry>

<spec-entry category="gotcha" keywords="scope-creep-down,deferred-scope,todo-leak,definition-of-done" date="2026-06-21" title="执行期收窄 definition_of_done 必须记入 plan deferred 列表" description="TASK-001 范围静默收窄仅记 Deviations，遗留 TODO 被 review 标记 CORR-001" source="retrospective">
### 执行期收窄 definition_of_done 必须记入 plan deferred 列表
M26 TASK-001 规划 action 为接入真实稿件文本，definition_of_done=read real novel content，执行期被静默收窄为空报告 fallback（用户直接指示），仅记在 task summary Deviations。review 后将遗留 TODO 标记为 CORR-001（稿件文本硬编码空、真实分析路径不可达）。原始 scope 成为隐藏 gap 因仅存于 summary note。规则：执行期收窄 task 的 definition_of_done 时，必须记入 plan 的 deferred 列表并附后续 task ID，而非仅记 summary Deviations——summary note 是临时的、对未来规划不可见。详见 knowhow KNW-retro-scope-deviation-deferred-record-2026-06-21。
INS-0f0144a2 · M26-P1 retrospective · 路由: note
</spec-entry>

<spec-entry category="pattern" keywords="api-layer,convention,callApi,frontend" date="2026-06-21" title="新 endpoint 前端 API 层复用 callApi/ApiResponse 包装" description="新功能前端 API 层应复制既有 writing-craft.ts 的 callApi 约定而非新造 fetch wrapper" source="retrospective">
### 新 endpoint 前端 API 层复用 callApi/ApiResponse 包装
新功能前端 API 层在 desktop/src/api/ 添加时，应复制既有 writing-craft.ts 约定而非新造 fetch wrapper：每 endpoint 一个薄函数、直接 callApi 返回（无内层信封解包）、params as unknown as Record<string,unknown> 满足 callApi body 签名、import { type ApiResponse, callApi } from './core'。body cast 是项目级公认取舍而非逐文件决定，应精确匹配。M26 reader.ts 即按此约定，TASK-002-summary 确认与 writing-craft.ts 一致。详见 knowhow KNW-retro-reuse-callapi-wrapper-2026-06-21。
INS-31c776c2 · M26-P1 retrospective · 路由: note
</spec-entry>