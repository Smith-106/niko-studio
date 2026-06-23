# Context: Phase 2 — Frontend Integration Completion

**Session ID**: ANL-P2-frontend-integration-2026-06-22
**Phase**: 2 / M27
**Mode**: micro (phase-scoped)
**Date**: 2026-06-22
**Upstream**: None (direct phase analysis from roadmap)

## Purpose

为 maestro-plan 提供消费就绪的决策上下文。所有决策已分类为 Locked（锁定）/ Free（自由）/ Deferred（延迟）。下游 planner agent 必须遵守 Locked 决策；Free 决策可在 plan 阶段调整；Deferred 决策在本次范围外，自动创建为 issue。

## Locked Decisions（锁定，不可更改）

| # | Decision | Rationale | Evidence |
|---|----------|-----------|----------|
| L-001 | buildPersonalizedCraftProfile 通过 api/analysis.ts re-export 修复（Option A） | 最轻量、有 writingSessionTelemetry.ts:68 桥接先例、与 roadmap 一致 | anchor-1, C-001 |
| L-002 | api/analysis.ts re-export 块必须带语义边界注释（标注"纯计算直通，非网络 API"） | 缓解 "api/ lying" 顾虑，明确语义边界 | Round 2 压力测试 #3 |
| L-003 | narrative-visualization 7 个类型迁移到 types/narrative-visualization.ts，api/ 从 types/ re-export | 遵循 types/ → api/ 层级关系，types/ 是类型真相源 | anchor-2, C-001 |
| L-004 | workspace.ts 和 writingSessionTelemetry.ts 桥接模式保留现状，不改代码 | 23+ 消费者依赖，模式成熟，改动收益小于风险 | anchor-4, C-003 |
| L-005 | reader-endpoints.ts 本次不拆分，仅文档化拆分方案 | 拆分是独立大动作，deferred 到 M28+ | anchor-5, C-004 |
| L-006 | Option C（MCP endpoint）本次不实施 | 基础设施已存在但属另一个 feature 范围（前端缺 preferenceProfile） | Round 2, C-002 |
| L-007 | 错误消息使用通用文案 `'Invalid workspace configuration'`（延续 ISS-007 安全修复） | 防止路径信息泄露，安全拒绝归类为 400 | ISS-007 先例 |

## Free Decisions（自由，可在 plan 阶段调整）

| # | Decision | Default | Options |
|---|----------|---------|---------|
| F-001 | api/analysis.ts re-export 块的具体注释措辞 | "// 纯计算函数直通：buildPersonalizedCraftProfile 为纯计算，非网络 API。前端通过 api 层 import 以维持边界。" | planner 可调整措辞，但必须包含"纯计算"和"非网络 API"语义 |
| F-002 | types/narrative-visualization.ts 是否包含额外类型 | 仅 re-export 7 个被消费的类型 | 如发现下游还需其他类型可扩展，但保持最小集 |
| F-003 | 测试 mock 路径迁移的验证方式 | 运行 DocumentEditor 相关测试套件 | 可增加 grep 验证 mock 路径一致 |
| F-004 | reader-endpoints.ts 拆分方案文档的存放位置 | `.workflow/scratch/20260622-analyze-P2-frontend-integration/reader-endpoints-split-plan.md` | planner 可决定是否迁移到 knowhow/ 或 M28 milestone 目录 |

## Deferred Decisions（延迟，本次范围外，自动创建为 issue）

| # | Decision | Why Deferred | Issue |
|---|----------|--------------|-------|
| D-001 | reader-endpoints.ts 实际拆分执行（1146 行 → 4 文件） | 独立大动作，需 M28 milestone 规划；本次仅文档化方案 | ISS-20260621-013 (既有) |
| D-002 | buildPersonalizedCraftProfile 升级为 MCP endpoint（Option C） | 后端 IPersonalizationService 已就绪，但前端缺 preferenceProfile 累积，属另一个 feature | ISS-20260622-011 (auto) |
| D-003 | workspace.ts 桥接模式重构为 types/ 真相源 + api/ wrapper | 23+ 消费者依赖，风险高，收益低；保持现状 | ISS-20260622-012 (auto) |

## Interview Decisions（交互式访谈决策，镜像自 discussion.md）

| Round | Decision Point | Choice | Rationale |
|-------|---------------|--------|-----------|
| 1 | 是否深入最弱维度（Alternatives 61%） | 继续深入 | Alternatives 维度最弱，需讨论纯函数 re-export vs API endpoint 策略 |
| 2 | 深入哪个方向 | 纯函数调用策略 | buildPersonalizedCraftProfile 跨边界调用策略是核心决策点 |

## Gray Areas（灰色地带，需 plan 阶段关注）

| # | Area | Guidance |
|---|------|----------|
| G-001 | api/analysis.ts 既是 HTTP 封装又是 re-export 点，语义边界模糊 | 通过注释块明确标注，避免后续开发者误以为 buildPersonalizedCraftProfile 是网络 API |
| G-002 | grep 验收模式需精确 | 使用 `from.*['\"]\.\..*src-ts/` 排除注释中的 src-ts 引用；排除 types/workspace.ts 和 utils/writingSessionTelemetry.ts 两个已批准桥接点 |
| G-003 | 4 个测试文件的 vi.mock 路径迁移 | 必须同步，否则 mock 失效导致测试假阳性 |

## Success Criteria（Phase 2 验收标准）

1. `grep -r 'from.*src-ts' desktop/src/` 返回仅包含 `types/workspace.ts` + `utils/writingSessionTelemetry.ts`（已批准桥接）
2. TypeScript 编译通过（`tsc --noEmit` 零错误）
3. 9 个 narrative-visualization 下游消费者 import 仍有效
4. 4 个测试文件 vi.mock 路径迁移完成，测试通过
5. reader-endpoints.ts 拆分方案文档存在

## Implementation Scope（消费就绪，直接传入 planner）

见 conclusions.json `implementation_scope`：5 个 objective，按 high/medium/low 优先级排序，每个含 target_files + acceptance_criteria + change_summary。

## Next Step

`/maestro-plan 2` — 从本 context.md 消费 Locked/Free 决策，生成 8 个 task / 3 个 wave 的执行计划。
