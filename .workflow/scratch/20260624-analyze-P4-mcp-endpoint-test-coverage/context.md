---
related:
  - project-project
  - roadmap-roadmap
  - scratch-20260624-analyze-p4-mcp-endpoint-test-coverage-analysis
  - scratch-20260624-analyze-p4-mcp-endpoint-test-coverage-discussion
---

# Context: M28 Phase 4 — MCP Endpoint Test Coverage

## Session Metadata

- **Artifact ID**: ANL-20260624-P4-mcp-endpoint-test-coverage
- **Scope**: phase
- **Milestone**: M28
- **Phase**: 4
- **Topic**: MCP endpoints 测试覆盖率补完
- **Date**: 2026-06-24
- **Rounds**: 3 (Round 0 Scoping, Round 1 Exploration & Cross-Validation, Round 2 Deep Dive)

## Sources

- `src-ts/coverage/coverage-final.json` — Istanbul 覆盖率数据，用于验证 endpoint handler 文件覆盖接近 100%。
- `.workflow/scratch/20260624-analyze-P4-mcp-endpoint-test-coverage/exploration-codebase.json` — cli-explore-agent 初始探索摘要（存在范围偏差，仅扫描 `tests/mcp/*.test.ts`）。
- `maestro delegate --to claude`（exec_id: `cld-135611-d4c0`）—— 交叉验证 coverage 与 route contract gaps。
- `src-ts/mcp/routes/*.ts` — 7 个 route 模块源码
- `src-ts/tests/mcp/routes/*.test.ts` — 现有 route contract tests
- `src-ts/mcp/all-tools.ts` + `src-ts/tests/mcp/all-tools.test.ts` — tools/list 机制
- 代码锚点：
  - `src-ts/mcp/routes/agents.ts:20-36`
  - `src-ts/mcp/routes/m10.ts:11-18`
  - `src-ts/mcp/routes/m11.ts:7-10`
  - `src-ts/mcp/routes/content.ts:70-159`
  - `src-ts/mcp/routes/platform.ts:17`
  - `src-ts/tests/mcp/routes/admin-routes.test.ts:1-159`
  - `src-ts/tests/mcp/routes/workflow-routes.test.ts:1-200`
  - `src-ts/tests/mcp/routes/platform-routes.test.ts`
  - `src-ts/tests/mcp/routes/content-routes-chat.test.ts:29-184`
  - `src-ts/tests/mcp/all-tools.test.ts`

## Current Understanding

Phase 4 的真实缺口远小于 roadmap 中"约 30% MCP endpoints 无测试"的字面表述：

- **Endpoint handler unit tests 已成熟**：story-bible（7）、qc（2）、cowriting（4）、ui-bridge（10 wrapper）、analysis/sessions、writing-craft 独立端点均已有覆盖，且 handler 文件语句/函数覆盖接近 100%。
- **真实缺口**：
  1. route registration contract tests（agents、m10、m11 完全缺失；content 中大量分组未断言）。
  2. `GET /tools`（`listTools`）响应体契约未验证 — `platform-routes.test.ts:35` 仅断言 route 匹配，未覆盖返回数组结构。
  3. 缺少 coverage-gap-scanner 脚本，导致跨目录测试被漏扫。
- **建议 Phase 4 核心交付**：3 个新 route contract test 文件 + 1 个 content route contract 扩展 + 1 个 `tools/list` contract test + 1 个 coverage-gap-scanner 脚本。
- **Deferred**：端到端 HTTP/MCP SDK 集成测试、占位 endpoint 显式 contract 集中文件。

## Interview Decisions

- 分析方向：implementation + decision + external_research（Round 0 确定，未改变）。
- 深度：Standard。
- 视角：Technical + Domain Expert。
- 用户反馈：Round 1 选择"继续深入"；子方向选择"覆盖率盘点脚本方案"。Round 2 未收集新用户反馈。
- **由于本次为继续分析（Round 2），分析方向已在 Round 0 确定，未进行新的 interview。**

## Decision Classification

| 决策 | 分类 | 说明 |
|------|------|------|
| 以 route contract tests + tools/list contract + scanner 为 Phase 4 核心交付 | **Locked** | 交叉验证确认 endpoint handler unit 已成熟，盲目新增 unit tests 收益低。 |
| 不将端到端 HTTP/MCP SDK 集成测试纳入 Phase 4 | **Locked** | 成本高、收益相对低，显式 deferred。 |
| Scanner 具体实现技术选型（ts-morph vs 正则 vs compiler API） | **Free** | 当前 route 模块为静态数组，正则足够；未来可升级。 |
| 是否将 scanner 接入 CI（退出码阻断） | **Free** | 取决于维护策略，可先在本地/人工复核阶段运行。 |
| 是否扩展 content-routes-additional.test.ts 覆盖全部 50 条剩余 route 还是仅覆盖关键分组 | **Free** | 可基于时间预算调整分组粒度。 |
| 端到端 HTTP/MCP SDK 集成测试 | **Deferred** | 建议 M29 或后续 milestone 考虑。 |
| 占位 endpoint 显式 contract 集中文件 | **Deferred** | 已有单元测试，优先级低于 route contract + scanner。 |
| 覆盖率阈值是否上调 | **Deferred** | 当前阈值已满足，暂不动。 |
| 新增 endpoint handler 单元测试（story-bible/qc/cowriting 等） | **Deferred** | 已覆盖，无需重复投入。 |

## 灰色区域与风险

1. **范围缩小是否被接受**：roadmap 中 Phase 4 目标字面为 "为 30% 无测试覆盖的 MCP endpoints 补 unit/integration 测试"，实际缺口远小于此。若用户坚持字面目标，可能需要补充一些低价值的 endpoint handler 测试以满足数字。
2. **Scanner 正则解析的健壮性**：当前 route 模块为纯静态数组，正则解析足够；若未来引入动态 route 生成（如基于配置文件的 route 注册），正则将失效，需迁移到 AST 解析。
3. **Content route 分组断言的粒度**：content.ts 剩余 50 条 route 分组较多，全部覆盖可能产生冗长测试；需平衡"全面覆盖"与"维护简洁"。
4. **覆盖率数字不会显著提升**：route 模块 import 即 100% statements，新增 contract tests 对覆盖率报告增量有限，需以契约稳定性作为验收标准。
5. **模块级 singleton 状态**：新增测试若调用 handler 需沿用 clear/reset/set 模式；纯 contract tests 不触发 handler，风险较低。

## Implementation Scope for Plan

1. 新增 `src-ts/tests/mcp/routes/agents-routes.test.ts`
2. 新增 `src-ts/tests/mcp/routes/m10-routes.test.ts`
3. 新增 `src-ts/tests/mcp/routes/m11-routes.test.ts`
4. 扩展 content route contract tests（story-bible/qc/cowriting/reader/learning/analysis/plugins/sync/foreshadow/character）
5. 扩展 `src-ts/tests/mcp/all-tools.test.ts` 覆盖 `GET /tools` 返回体契约
6. 新增 `src-ts/scripts/coverage-gap-scanner.ts` 与 `coverage:gap` npm script

## Acceptance Criteria

- agents/m10/m11 三个路由模块均有 dedicated route contract test。
- content route contract tests 覆盖剩余功能分组。
- `GET /tools` 返回的关键工具分类被显式断言（name/method/path）。
- coverage-gap-scanner 能正确识别 route contract 缺口，不误报已有跨目录测试的 handler。
- `cd src-ts && npm run test:coverage` 通过且不降低现有覆盖率。

## Next Step

`/maestro-plan 4`

## Scope Verdict

phase — 本分析为 M28 Phase 4 的 phase-scoped analyze 会话。
