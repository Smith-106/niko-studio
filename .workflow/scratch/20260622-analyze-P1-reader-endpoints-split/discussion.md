# Discussion: M28 Phase 1 — Reader Endpoints Split + Remaining Input Validation

## Session Metadata

| Field | Value |
|-------|-------|
| Session ID | ANL-20260622-P1-reader-endpoints-split |
| Scope | phase (M28 Phase 1) |
| Topic | 将 reader-endpoints.ts 拆分并补齐剩余输入校验 |
| Mode | full (auto-deepen, `-y` 等效) |
| Started | 2026-06-22 |
| Completed | 2026-06-24 |
| Sources | cli-explore-agent, maestro delegate (claude/analysis) |

## Table of Contents

- [User Intent](#user-intent)
- [Current Understanding](#current-understanding)
- [Round 1: Exploration & CLI Synthesis](#round-1-exploration--cli-synthesis)
- [Intent Coverage](#intent-coverage)
- [Confidence Scoring](#confidence-scoring)
- [Narrative Synthesis](#narrative-synthesis)
- [Technical Solutions](#technical-solutions)
- [Pressure Pass](#pressure-pass)
- [Decision Trail](#decision-trail)

## User Intent

1. 将 `src-ts/reader/mcp/reader-endpoints.ts`（1147 行 god module）按功能边界拆分为 `reader-routes.ts` / `reader-validation.ts` / `reader-services.ts` / `reader-types.ts`。
2. 补齐 ISS-20260622-006 中剩余的输入校验缺口：`personaId`、`dimension`、`focusAreas[]`、`biases[]`、`personaIds[]`、`targetStyle`、`versionA.label` / `versionB.label`。
3. 保持既有调用方（`content.ts`、`endpoints/index.ts`、`reader/mcp/index.ts`、7+ 测试文件）向后兼容。
4. 为后续 `/maestro-plan 1` 提供可直接消费的 implementation scope。

## Current Understanding

`reader-endpoints.ts` 同时承担 8 个 endpoint handler、10+ 类型定义、5 个 lazy singleton、3 个 mutable Map store、文件持久化、反馈权重调整等职责，已形成典型 god module。M27 已完成 `novelId`/`text`/`name`/weight 的基础共享校验，但仍有数组元素、维度、标签等字段无边界控制。本次分析确认：

- 拆分在技术上是机械性的，主要风险来自测试 import 路径和模块级 singleton 初始化顺序；
- 保留 `reader-endpoints.ts` 作为 re-export shim 是避免 CI 断裂的关键；
- 新增校验应优先复用 `src-ts/mcp/input-validation.ts` 的已有模式，避免 ad-hoc 内联；
- `DIMENSION_TO_PARAM`、`loadCustomPersonas()` 的初始化顺序需要在 `reader-services.ts` 中显式处理，防止 race。

## Round 1: Exploration & CLI Synthesis

### Sources Used

- `cli-explore-agent` 输出：`.workflow/scratch/20260622-analyze-P1-reader-endpoints-split/exploration-codebase.json`
- `maestro delegate --to claude --mode analysis`：基于 exploration 的独立多维度评估

### Key Findings (with Code Anchors)

1. **God module 现状**  
   `src-ts/reader/mcp/reader-endpoints.ts:379` 起定义了 8 个 exported endpoint handler；`:160` 起定义了 10+ request/response 类型；`:137` 起声明了 5 个 lazy singleton；`:254` 起持有 3 个 module-level mutable Map。  
   证据：`exploration-codebase.json` code_anchors for lines 137, 160, 254, 379.

2. **剩余输入校验缺口**  
   - `focusAreas`/`biases` 仅 `Array.isArray` 检查（`:578`），无元素类型/长度/数组长度上限。  
   - `dimension` 在 feedback 中无长度上限（`:785`）。  
   - `targetStyle` 在 de-ai 中无校验（`:1056`）。  
   - `personaIds` 元素仅校验 `typeof === 'string'`（`:397`），无长度上限。  
   - `feedbackId` 复用 `MAX_NOVEL_ID_LENGTH`（`:770`），缺少专用常量。  
   - `versionA.label` / `versionB.label` 无校验（`:1030-1031`）。  
   证据：`exploration-codebase.json` code_anchors for lines 397, 578, 770, 785, 1030, 1056.

3. **共享校验基础**  
   `src-ts/mcp/input-validation.ts` 已提供 `validateStringLength`、`validateWeight`、`MAX_NOVEL_ID_LENGTH`、`MAX_TEXT_LENGTH`、`MAX_NAME_LENGTH`，`reader-endpoints.ts:28` 已导入。扩展该模块比在每个 endpoint 内联更安全。  
   证据：`exploration-codebase.json` relevant_files `src-ts/mcp/input-validation.ts`.

4. **测试与调用方影响**  
   7+ 测试文件直接 import `reader-endpoints.ts`；`src-ts/mcp/routes/content.ts:151-158` 注册全部 8 个 endpoint；`src-ts/mcp/endpoints/index.ts:218-227` re-export；`src-ts/reader/mcp/index.ts` re-export 4 个 endpoint + 类型。  
   证据：`exploration-codebase.json` relevant_files for `content.ts`, `endpoints/index.ts`, `reader/mcp/index.ts`, 以及 7 个测试文件。

5. **模块初始化顺序风险**  
   `loadCustomPersonas()` 在模块顶层调用（`:258`），拆分后必须保证 `reader-services.ts` 的 promise 在 endpoint 读取 `customPersonaStore` 前 resolve。  
   证据：`exploration-codebase.json` data_flows `custom-persona-persistence-flow`, risks `File persistence path during module init`.

### Discussion Points

- 是否先校验再拆分，还是先拆分再校验？  
  CLI 评估推荐“hybrid with compatibility anchor”：在拆分的同时补齐校验，保留 shim，避免两次大规模 import 重写。
- `DIMENSION_TO_PARAM` 放在哪里？  
  推荐放入 `reader-validation.ts` 作为单一真相源，反馈权重逻辑从 validation 导入，避免 routes→services 的隐藏依赖。
- 测试迁移节奏  
  第一阶段保持测试从 `reader-endpoints.ts` shim 导入即可通过；第二阶段再逐步指向子模块，最后移除 shim。

### Open Questions Resolved in This Round

- 拆分后的文件职责边界 → 已按 `reader-routes.ts` / `reader-validation.ts` / `reader-services.ts` / `reader-types.ts` 确定。
- 向后兼容策略 → `reader-endpoints.ts` 作为 re-export shim。
- 校验缺口清单与实现位置 → 在 `input-validation.ts` 新增 `validateStringArray`、`validateEnum` 及 `MAX_*` 常量；在 endpoint 中调用。
- singleton/store 初始化 race → `reader-services.ts` 保留 `loadCustomPersonas()` 并提供 ready guard 或 getter 链式调用。

## Intent Coverage

| # | Original Intent | Status | Where Addressed |
|---|----------------|--------|-----------------|
| 1 | 拆分 reader-endpoints.ts | ✅ Addressed | Round 1, split_recommendation groups |
| 2 | 补齐剩余输入校验 | ✅ Addressed | Round 1, validation gaps code_anchors + delegate rec #1 |
| 3 | 保持向后兼容 | ✅ Addressed | Round 1, compatibility shim decision |
| 4 | 输出 implementation scope | ✅ Addressed | conclusions.json implementation_scope |

## Confidence Scoring

Dimensions = 6 analysis dimensions. Factors weighted: findings_depth 0.30, evidence_strength 0.25, coverage_breadth 0.20, user_validation 0.15, consistency 0.10.

| Dimension | Score (1-5) | Confidence % | Weakest Factor | Notes |
|-----------|-------------|--------------|----------------|-------|
| Feasibility | 4 | 85 | user_validation (auto-mode) | 机械拆分，已有 barrel 模式 |
| Impact | 4 | 85 | coverage_breadth | 维护性 + 关闭 6+ 校验缺口 |
| Risk | 3 | 80 | evidence_strength | 测试 import / singleton race 待执行验证 |
| Complexity | 3 | 80 | findings_depth | 仅组织复杂度，无新算法 |
| Dependencies | 2 (favorable) | 85 | consistency | 内部模块，无外部依赖 |
| Alternatives | N/A | 90 | — | 3 个选项已评估 |

**Overall Confidence: 84%**

> Auto-mode: no interactive re-score round; baseline accepted as final because all intent items were addressed in the first exploration pass and no contradictions remained.

## Narrative Synthesis

**起点**：本轮从 M27 遗留的两个 issue（ISS-20260621-013 文件拆分、ISS-20260622-006 未收敛字段校验）出发，结合 `cli-explore-agent` 的代码锚点和 delegate 的独立评估。  
**关键进展**：确认了 god module 的 4 个职责分组、6 个具体校验缺口、7+ 测试文件的 import 依赖，以及模块初始化 race 风险。delegate 将“hybrid with compatibility anchor”评为最优路径。  
**决策影响**：用户要求顺序执行且无进一步交互，因此采用 auto-deepen 模式，直接进入综合与决策提取。  
**当前理解**：Phase 1 具备 GO 条件，核心约束是保留兼容性 shim 并优先扩展 `input-validation.ts`。  
**遗留问题**：执行阶段需验证 `loadCustomPersonas()` 的 ready guard 是否足够稳健（已列为 implementation_scope 验收标准）。

## Technical Solutions

> **Solution**: 保留 `reader-endpoints.ts` 作为 re-export-only 兼容 shim，子模块承担实际实现。
> - **Status**: Validated
> - **Problem**: 7+ 测试文件和多个 barrel 直接依赖原文件路径，硬拆会立即破坏 CI。
> - **Rationale**: 符合项目已存在的 barrel/re-export 模式，允许测试和调用方渐进迁移。
> - **Alternatives**: A) 校验优先、后续拆分；B) 拆分优先、后续校验。两者都导致同一文件两次大规模改动。
> - **Evidence**: `src-ts/reader/mcp/index.ts:5`, `src-ts/mcp/endpoints/index.ts:218-227`, 7 个测试文件 import。
> - **Next Action**: 执行阶段创建 `reader-routes.ts` / `reader-validation.ts` / `reader-services.ts` / `reader-types.ts` 后，将 `reader-endpoints.ts` 改写为 re-export。

> **Solution**: 在 `src-ts/mcp/input-validation.ts` 新增 `validateStringArray` 和 `validateEnum`，并定义 Reader 专用 `MAX_*` 常量。
> - **Status**: Validated
> - **Problem**: 数组字段、维度、标签等缺少长度/基数边界，存在 DoS / Map key 膨胀风险。
> - **Rationale**: M27 已建立共享校验模块，扩展比内联更一致、可测试。
> - **Alternatives**: 每个 endpoint 单独写校验 — 重复代码且难以维护。
> - **Evidence**: `src-ts/mcp/input-validation.ts` 已有 `validateStringLength` / `validateWeight`；`reader-endpoints.ts:578` 仅 `Array.isArray`。
> - **Next Action**: 规划阶段将具体常量和 helper 签名写入 task acceptance criteria。

> **Solution**: `DIMENSION_TO_PARAM` 迁移至 `reader-validation.ts` 作为单一真相源。
> - **Status**: Proposed
> - **Problem**: 该映射被 feedback 权重调整逻辑使用，放在 services 会导致 routes/validation 隐藏依赖。
> - **Rationale**: 数据映射属于 validation 层，services 只消费结果。
> - **Evidence**: `reader-endpoints.ts:278` DIMENSION_TO_PARAM; `reader-endpoints.ts:816` adjustPersonaWeights。
> - **Next Action**: 拆分时先移动该常量，再调整 `reader-services.ts` 中的反馈逻辑 import。

## Pressure Pass

**Target finding**: “保留 `reader-endpoints.ts` 作为 re-export shim 即可避免测试 import 断裂。”

1. **Evidence demand**: 是否所有测试都从 `reader-endpoints.ts` 导入符号？  
   验证：`exploration-codebase.json` 列出 `reader-endpoints.test.ts`、`reader-feedback-endpoint.test.ts`、`reader-compare-endpoint.test.ts`、`reader-endpoints-de-ai.test.ts`、`reader-endpoints.test.ts`（custom persona persistence）、`reader-endpoints.branch-gap.additional.test.ts`、`reader-endpoints.coverage.test.ts`、`reader-endpoints.branch-gap.more.additional.test.ts` 共 8 个测试文件。结论：确实依赖原路径。
2. **Assumption probe**: 如果 shim 只是 re-export，TypeScript 编译器是否会因为循环依赖报错？  
   验证：shim 只 export from 子模块，不执行副作用；子模块不反向 import shim，循环风险低。
3. **Boundary/tradeoff**: shim 会不会隐藏真正的依赖方向，导致后续难以移除？  
   验证：可以在执行阶段新增“移除 shim”的 deferred task，并在测试迁移后执行；shim 存在期间不会影响运行时行为。
4. **Root cause check**: 测试 import 断裂是 symptom 还是 root cause？  
   验证：root cause 是单文件承担过多职责；shim 是过渡方案，拆分到子模块才是治本。

**Result**: finding 成立，但需在 implementation scope 中明确 shim 移除条件。

## Decision Trail

> **Decision**: 采用“拆分 + 补齐校验 + 兼容性 shim”的混合方案。
> - **Context**: M27 遗留 issue 要求同时完成文件拆分和字段校验；直接拆分或先校验都会增加回归面。
> - **Options considered**: A) 校验优先；B) 拆分优先；C) 混合 + shim。
> - **Chosen**: C — 混合 + shim。
> - **Reason**: 在一次 phase 内同时收敛两个 issue，减少重复改动；shim 保证既有测试和调用方零修改。
> - **Rejected**: A/B 会导致同一文件两次大规模重构。
> - **Evidence Source**: cli-explore-agent + maestro delegate (claude/analysis)
> - **Impact**: Phase 1 scope 确定，implementation_scope 可直接进入 `/maestro-plan 1`。

> **Decision**: 新增校验 helper 优先放入 `src-ts/mcp/input-validation.ts`，而非新建独立的 reader-only validation。
> - **Context**: 需要为数组、枚举、标签等新增校验。
> - **Options considered**: 1) 扩展 `input-validation.ts`；2) 新建 `reader-validation.ts` 并在其中放通用 helper。
> - **Chosen**: 1) 扩展 `input-validation.ts` 放通用 helper，`reader-validation.ts` 保留 Reader 领域校验（resolvePersonas、buildOverlayMarkers、adjustPersonaWeights）。
> - **Reason**: 避免通用校验逻辑散落；`validateStringArray`/`validateEnum` 可被其他 endpoint 复用。
> - **Evidence Source**: cli-explore-agent `src-ts/mcp/input-validation.ts` relevant_files
> - **Impact**: 校验实现位置明确，测试覆盖可在 `input-validation.test.ts` 统一补充。

> **Decision**: `loadCustomPersonas()` 的初始化 race 通过 `reader-services.ts` 内的 ready guard / getter 链式调用解决。
> - **Context**: 模块级 async init 在拆分后不能丢失顺序保证。
> - **Options considered**: 1) 顶层 promise + ready guard；2) 每个 endpoint 手动 await。
> - **Chosen**: 1) ready guard，endpoint 通过 getter 隐式等待。
> - **Reason**: 最小改动，保持现有调用语义；避免每个 endpoint 重复 await。
> - **Evidence Source**: cli-explore-agent risks `File persistence path during module init`
> - **Impact**: 需在执行阶段新增回归测试验证“模块导入后立即调用 endpoint”不丢 custom persona。
