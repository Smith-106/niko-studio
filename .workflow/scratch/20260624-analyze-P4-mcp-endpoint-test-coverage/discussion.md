---
related:
  - project-project
  - roadmap-roadmap
  - scratch-20260624-analyze-p4-mcp-endpoint-test-coverage-analysis
  - scratch-20260624-analyze-p4-mcp-endpoint-test-coverage-context
---

# Discussion: M28 Phase 4 — MCP Endpoint Test Coverage

## Session Metadata

- **Session ID**: ANL-20260624-P4-mcp-endpoint-test-coverage
- **Scope**: phase
- **Milestone**: M28
- **Phase**: 4
- **Topic**: MCP endpoints 测试覆盖率补完
- **Date**: 2026-06-24

## Analysis Configuration

| Dimension | Selected |
|-----------|----------|
| Focus | implementation, decision, external_research |
| Perspectives | Technical, Domain Expert |
| Depth | Standard |

## User Intent

原始意图（来自 roadmap / 用户指令）：
1. 识别当前无测试覆盖的 MCP endpoints（目标约 30%）。
2. 为后端 MCP endpoints 补充 unit / integration / contract 测试。
3. 建立 endpoint contract tests，保证前后端契约稳定。

## Current Understanding

经过 cli-explore-agent 初探、Claude delegate 交叉验证与覆盖率 JSON 扫描，当前认知如下：

- **Endpoint handler 单元测试已较完整**：story-bible（7）、qc（2）、cowriting（4）、ui-bridge（10 wrapper）、analysis/sessions、learning placeholder 等被探索摘要误判为“无测试”的 endpoint，实际在 `tests/knowledge/`、`tests/cowriting/`、`tests/analysis/`、`tests/mcp/*additional.test.ts` 中已有覆盖。
- **真实缺口在路由注册契约**：agents、m10、m11 路由模块完全没有 route contract 测试；content 路由中除 chat/memory/graph/wiki/writing 外，story-bible/qc/cowriting/reader/learning/analysis/plugins/sync/foreshadow/character 等 route 注册缺少契约断言。
- **更高阶缺口**：缺少 `tools/list` schema/JSON-RPC contract 测试，以及端到端 HTTP/MCP SDK 集成测试；缺少自动化覆盖率盘点脚本导致扫描口径偏差。
- **Phase 4 建议范围**：以 route contract tests 为主（P1），辅以 tools/list contract（P2），可选 coverage-gap-scanner 脚本与占位 endpoint 显式契约测试（P3/P4）。不建议盲目新增 20+ endpoint 单元测试。

## Table of Contents

- [Session Metadata](#session-metadata)
- [Analysis Configuration](#analysis-configuration)
- [User Intent](#user-intent)
- [Current Understanding](#current-understanding)
- [Discussion Timeline](#discussion-timeline)
- [Technical Solutions](#technical-solutions)
- [Confidence Scoring](#confidence-scoring)

## Discussion Timeline

### Round 0: Scoping

**Decision**: 分析方向 = implementation + decision + external_research；视角 = Technical + Domain Expert；深度 = Standard。

**Rationale**: Phase 4 的核心是“补测试并制定可执行计划”。implementation 帮助复用现有测试模式；decision 用于确定 endpoint 优先级与验收标准；external_research 引入 MCP endpoint 测试的行业做法作为参考。

### Round 1: Exploration & Cross-Validation

**Sources used**: `exploration-codebase.json` (cli-explore-agent), `maestro delegate --to claude` (cld-135611-d4c0), `src-ts/coverage/coverage-final.json` (coverage scan via Node script).

**Key findings with code anchors**:

1. **探索摘要存在范围偏差** — 将被标记为“无测试”的 story-bible/qc/cowriting/ui-bridge/analysis/sessions 误判为 uncovered，实际已有成熟测试：
   - `src-ts/tests/knowledge/story-bible-endpoints.test.ts:47` 覆盖 CRUD + extract + completeness
   - `src-ts/tests/knowledge/qc-endpoints.test.ts:36` 覆盖 validate/creativity-config + 缓存
   - `src-ts/tests/cowriting/cowriting-endpoints.test.ts:46` 覆盖 auto/guided/modes/presets
   - `src-ts/tests/mcp/workflow-endpoints.additional.test.ts:542` 覆盖全部 UI Bridge wrapper 的 403/转发行为
   - `src-ts/tests/analysis/analysis-endpoints.test.ts:93` 覆盖 `/analysis/sessions`
2. **真实缺口是路由注册契约测试** — 未覆盖的 route 模块：
   - `src-ts/mcp/routes/agents.ts:20-36`
   - `src-ts/mcp/routes/m10.ts:11-18`
   - `src-ts/mcp/routes/m11.ts:7-10`
   - `src-ts/mcp/routes/content.ts:131-158`（story-bible/qc/cowriting/reader 等）缺少 match/param extraction 断言
3. **覆盖率扫描证实 handler 文件语句覆盖接近 100%** — `knowledge/mcp/story-bible-endpoints.ts`、`knowledge/mcp/qc-endpoints.ts`、`cowriting/mcp/cowriting-endpoints.ts`、`mcp/endpoints/workflow.ts` 均为 100/100/100；`mcp/endpoints/analysis.ts` 分支 96.6、`mcp/endpoints/graph.ts` 分支 98.6、`reader/mcp/reader-endpoints.ts` 分支 97.4。
4. **更高阶缺口**：缺少 `tools/list` schema/JSON-RPC contract 测试、端到端 HTTP/MCP SDK 集成测试、自动化覆盖率盘点脚本。

**Discussion points**:
- 既然 endpoint 单元测试已较厚，Phase 4 是否还应把重点放在 route contract + tools/list contract，而非新增 endpoint handler 单元测试？
- 是否需要新增一个 coverage-gap-scanner 脚本来防止未来扫描口径偏差？

**Open questions**:
- 用户是否接受“真实缺口远小于 roadmap 预估”这一结论？
- 是否要在 Phase 4 内补 2-3 个端到端 HTTP 集成测试，还是将其 deferred？

### Round 1: Narrative Synthesis

**起点**: Round 0 假设需要为 30% 无测试 MCP endpoints 补大量单元/集成测试。
**关键进展**: 交叉验证发现探索代理的扫描范围过窄，多数“无测试”endpoint 实际已覆盖；当前主要缺口是 route registration contract、tools/list contract 和覆盖盘点口径。
**决策影响**: 本轮尚未引入用户反馈；分析方向维持 implementation + decision + external_research，但结论从“补 endpoint 单元测试”转向“补 route contract + 校准扫描口径”。
**当前理解**: Phase 4 的核心价值不在于堆叠 endpoint handler 单元测试，而在于用低成本 contract tests 锁住 endpoint 与 route 注册之间的 wiring 契约，并建立可持续的覆盖率盘点机制。
**遗留问题**: 用户是否接受缩小范围、重点转向 contract tests；是否允许 deferred 端到端 HTTP 集成测试。

## Intent Coverage Check

| # | Original Intent | Status | Where Addressed | Notes |
|---|----------------|--------|-----------------|-------|
| 1 | 识别当前无测试覆盖的 MCP endpoints（目标约 30%） | ✅ Addressed | Round 1, Findings 1-3 | 探索摘要误判，实际缺口主要在 route contract 与 tools/list contract，endpoint handler 覆盖率高 |
| 2 | 为后端 MCP endpoints 补充 unit/integration/contract 测试 | 🔄 In-progress | Round 1, Technical Solutions | 推荐重点补 route contract + tools/list contract；endpoint unit 已较完整 |
| 3 | 建立 endpoint contract tests，保证前后端契约稳定 | 🔄 In-progress | Round 1, Technical Solutions | route contract tests 与 tools/list contract test 为 concrete 交付物 |

## Technical Solutions

> **Solution**: 新增/扩展 route contract tests（agents-routes.test.ts、m10-routes.test.ts、m11-routes.test.ts，并扩展 content-routes-additional.test.ts）。
> - **Status**: Proposed
> - **Problem**: 路由注册契约测试不完整，无法防止 wiring drift。
> - **Rationale**: Route 模块是纯数据数组，测试成本低但防御价值高；可直接复用 platform/admin/workflow route tests 的 pattern/handler/param extraction 模式。
> - **Alternatives**: 为每个 endpoint 补端到端 HTTP 测试（成本高，收益有限）。
> - **Evidence**: `src-ts/tests/mcp/routes/admin-routes.test.ts:1-159`、`src-ts/tests/mcp/routes/workflow-routes.test.ts:1-200`
> - **Next Action**: 在 maestro-plan 中拆分为具体 TASK。

> **Solution**: 修正覆盖率扫描口径或新增 coverage-gap-scanner 脚本，扫描 `src-ts/tests/**/*.test.ts` 中 endpoint handler 的导入/调用。
> - **Status**: Proposed
> - **Problem**: 探索摘要因扫描范围过窄而误判大量 endpoint 为无测试。
> - **Rationale**: 一次性脚本投资可避免后续阶段重复误判；扫描可基于 AST 或简单 regex 匹配 handler 函数名。
> - **Alternatives**: 手工维护 endpoint 到测试的映射表（易过期）。
> - **Evidence**: `.workflow/scratch/20260624-analyze-P4-mcp-endpoint-test-coverage/exploration-codebase.json`
> - **Next Action**: 可选任务，优先级低于 route contract tests。

> **Solution**: 新增 `tools/list` contract test，断言关键 endpoint 的 name、method、path 与 route 注册一致。
> - **Status**: Proposed
> - **Problem**: MCP client 视角的契约稳定性未验证。
> - **Rationale**: 低成本、高兼容性保障；可复用 `all-tools.test.ts` 的现有结构。
> - **Alternatives**: 端到端 MCP SDK Client 测试（ heavier，可作为 deferred）。
> - **Evidence**: `src-ts/mcp/all-tools.ts`、`src-ts/tests/mcp/all-tools.test.ts`
> - **Next Action**: 作为 P2 任务纳入 plan。

> **Solution**: 为 `/analysis/sessions` 等占位 endpoint 补显式 contract 测试，断言 placeholder 语义（空数组、status 200、Content-Type）。
> - **Status**: Proposed
> - **Problem**: 占位实现易被误改，缺少显式契约守卫。
> - **Rationale**: 已有单元测试，但可集中到一个 contract 文件中明确占位语义。
> - **Alternatives**: 不新增测试，依赖现有单元测试。
> - **Evidence**: `src-ts/tests/analysis/analysis-endpoints.test.ts:93`
> - **Next Action**: 可选低优先级任务。

### Round 2: Deep Dive — Scanner Design & Route Contract Details

**Decision**: Continue deepening on coverage-gap-scanner and route contract test scope.

**Sources used**: `src-ts/mcp/routes/agents.ts`, `src-ts/mcp/routes/m10.ts`, `src-ts/mcp/routes/m11.ts`, `src-ts/mcp/routes/content.ts`; existing route contract tests `src-ts/tests/mcp/routes/admin-routes.test.ts`, `src-ts/tests/mcp/routes/workflow-routes.test.ts`, `src-ts/tests/mcp/routes/platform-routes.test.ts`, `src-ts/tests/mcp/routes/content-routes-chat.test.ts`; `src-ts/mcp/endpoints/health.ts`, `src-ts/tests/mcp/health-endpoints.test.ts`.

**Key findings**:

1. **`GET /tools`（`listTools`）契约缺口具体化**：该 route 在 `platformRoutes` 中已注册（`src-ts/mcp/routes/platform.ts:17`），且 `platform-routes.test.ts:35` 断言了 `GET /tools` 能匹配到 route，但没有任何测试验证 `listTools` 返回的工具分类数组结构（`src-ts/tests/mcp/health-endpoints.test.ts` 未覆盖 `listTools`）。这是 `tools/list` contract test 的最小可交付形态。

2. **agents / m10 / m11 路由模块高度规则化**：三者均为纯数据数组，除 `m10.ts:14` 和 `m11.ts:9` 的 `projectId` 参数外，其余均为固定路径。可直接复用 `admin-routes.test.ts` 和 `workflow-routes.test.ts` 的 pattern：断言 route 数量、method、handler 类型、正/负匹配、参数提取、handler 引用唯一性。

3. **content.ts 剩余分组可分组断言**：`contentRoutes` 当前共 68 条（`src-ts/mcp/routes/content.ts:70-159`）。`content-routes-chat.test.ts` 已覆盖 chat/memory/graph/wiki/writing/workspace 共 18 条；剩余 50 条可按功能分组（writing-craft / plugins / sync / foreshadow / character / analysis / learning / story-bible / qc / cowriting / reader）做正/负匹配循环断言，避免 50 个重复 it 块。

4. **覆盖率数字不会显著上升**：route 模块语句覆盖在 import 时即 100%，但 branches/functions 为 0（静态数组无运行时分支）。新增 contract tests 的覆盖价值在于防止 wiring drift，而非提升覆盖率数字。

**Coverage-gap-scanner 设计方案**:

> **目标**: 自动对比 `src-ts/mcp/routes/*.ts` 注册的 route 与 `src-ts/tests/**/*.test.ts` 中对 endpoint handler / route array 的引用，防止再次漏扫跨目录测试。
>
> **文件路径**: `src-ts/scripts/coverage-gap-scanner.ts`（ESM，零新增依赖，优先用正则轻量解析）。
>
> **运行方式**:
> - 手动：`cd src-ts && node --loader ts-node/esm scripts/coverage-gap-scanner.ts`
> - 建议新增 npm script：`"coverage:gap": "node --loader ts-node/esm scripts/coverage-gap-scanner.ts"`
> - 可选在 `test:coverage` 后执行，用于人工/CI 复核。
>
> **输入**:
> - `src-ts/mcp/routes/*.ts`（7 个模块：platform/admin/workflow/agents/m10/m11/content）。
> - `src-ts/tests/**/*.test.ts`（全目录）。
> - 可选 `src-ts/coverage/coverage-final.json` 做二次校验。
>
> **算法步骤**:
> 1. 读取每个 route 文件文本，用正则提取 `export const \w+Routes: GatewayRoute\[\] = \[(.*?)\];` 体。
> 2. 在体中逐条匹配 `{ method: '...', pattern: /^...$/, handler: <identifier>, paramNames?: [...] }`，记录 `module`、 `method`、 `pattern`、 `handlerName`、 `paramNames`。
> 3. 收集所有 `handlerName` 集合。
> 4. 扫描所有测试文件源码，若某 `handlerName` 出现（含 import alias），则认为该 handler 有测试引用。对于 wrapper 函数（如 `workflowEndpointWrapper`），同时检测 wrapper 调用。
> 5. 检查每个 route 模块是否存在对应 contract test：`tests/mcp/routes/{module}-routes.test.ts`。
> 6. 输出 JSON/表格：列出未引用 handler、缺少 route contract test 的模块、统计数字。
>
> **输出示例**:
> ```json
> {
>   "summary": {
>     "routeModules": 7,
>     "routeEntries": 68,
>     "handlersReferencedInTests": 55,
>     "handlersWithoutReference": 2,
>     "modulesWithoutRouteTest": ["agents", "m10", "m11"]
>   },
>   "untestedHandlers": [...],
>   "modulesWithoutRouteTest": [...]
> }
> ```
>
> **依赖建议**: 优先使用 Node 内置模块 + 正则，避免引入 ts-morph 等依赖；若未来 route 模块出现复杂动态生成，再迁移到 TypeScript compiler API。
>
> **验收标准**:
> - 脚本能正确识别 `agents.ts`、`m10.ts`、`m11.ts` 缺少 route contract test。
> - 脚本不会误报 `story-bible`、`qc`、`cowriting` 等已在 `tests/knowledge/` / `tests/cowriting/` 中测试的 handler。
> - 脚本对 `workflow.ts` UI Bridge wrapper 的覆盖判断合理（允许通过 wrapper 函数名或 wrapped handler 名匹配）。
> - 脚本返回非零退出码当且仅当发现缺口，便于 CI 集成。

**Discussion points**:
- 覆盖率盘点脚本是否应作为 Phase 4 的 P0 交付？它本身不直接补测试，但能防止后续阶段再次误判。
- 端到端 HTTP/MCP SDK 集成测试是否继续 deferred 到 M29？

**Round 2: Narrative Synthesis**

**起点**: Round 1 已将 Phase 4 重点从 endpoint handler unit tests 调整为 route contract + tools/list contract。
**关键进展**: Round 2 明确了 scanner 的具体实现路径（零依赖正则解析）、agents/m10/m11/content 剩余分组的测试策略，并定位到 `GET /tools` 是当前唯一未验证响应体的公共端点。
**决策影响**: 用户选择了“覆盖率盘点脚本方案”作为深入方向；本 round 产出的 scanner 设计可直接转化为 Phase 4 task。
**当前理解**: Phase 4 的真实工作量显著小于 roadmap 中“30% endpoints 无测试”的字面估计。核心交付是：3 个新 route contract test 文件 + 1 个 content route contract 扩展文件 + 1 个 `tools/list` contract test + 1 个 coverage-gap-scanner 脚本。端到端集成测试继续 deferred。
**遗留问题**: scanner 是否接入 `check:release`；是否需要在 Phase 4 内同步修复任何由 scanner 新发现的未被现有测试引用的 handler。

## Intent Coverage Check (Updated)

| # | Original Intent | Status | Where Addressed | Notes |
|---|----------------|--------|-----------------|-------|
| 1 | 识别当前无测试覆盖的 MCP endpoints（目标约 30%） | ✅ Addressed | Round 1-2 | 真正缺口是 route contract、tools/list contract、scanner；endpoint handler 覆盖率高 |
| 2 | 为后端 MCP endpoints 补充 unit/integration/contract 测试 | ✅ Addressed | Round 2 | 重点：route contract tests + tools/list contract；unit 已较完整 |
| 3 | 建立 endpoint contract tests，保证前后端契约稳定 | ✅ Addressed | Round 2 | 具体交付物已明确 |

## Confidence Scoring (Updated)

| Dimension | Findings Depth | Evidence Strength | Coverage Breadth | User Validation | Consistency | Overall |
|-----------|---------------|-------------------|------------------|-----------------|-------------|---------|
| implementation | 90 | 92 | 85 | 0 (pending) | 88 | 76.5 |
| decision | 85 | 88 | 82 | 0 (pending) | 85 | 71.0 |
| external_research | 75 | 78 | 65 | 0 (pending) | 78 | 62.3 |

*Updated after Round 2: scanner design and route contract scope are now concrete. User validation remains 0 because Round 2 has not collected additional user confirmation.*

## Synthesis

Phase 4 的 MCP endpoint 测试覆盖率问题可收敛为：**endpoint handler unit tests 已成熟，真正薄弱的是 route wiring 契约与覆盖率盘点口径**。建议以 route contract tests（agents/m10/m11/content 剩余分组）、`tools/list` contract test、以及 coverage-gap-scanner 脚本作为 Phase 4 核心交付；端到端 HTTP/MCP SDK 集成测试 deferred。最终建议：GO / CONDITIONAL（取决于用户是否接受缩小范围）。
