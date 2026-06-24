---
related:
  - project-project
  - roadmap-roadmap
  - scratch-20260624-analyze-p4-mcp-endpoint-test-coverage-context
  - scratch-20260624-analyze-p4-mcp-endpoint-test-coverage-discussion
---

# Analysis: M28 Phase 4 — MCP Endpoint Test Coverage

## Session Metadata

- **Artifact ID**: ANL-20260624-P4-mcp-endpoint-test-coverage
- **Scope**: phase
- **Milestone**: M28
- **Phase**: 4
- **Topic**: MCP endpoints 测试覆盖率补完
- **Date**: 2026-06-24

## Go / No-Go Verdict

**Verdict**: CONDITIONAL

**条件**: 用户接受 Phase 4 范围从 “为 30% endpoints 补 unit tests” 缩小为 “route contract tests + tools/list contract + coverage-gap-scanner”。

**理由**:
- Endpoint handler unit tests 已成熟（statement 100%, branches 96-100%），盲目新增 20+ 单元测试的收益极低。
- 真实缺口精确锁定为 route wiring 契约（agents/m10/m11 + content 剩余分组）和 tools/list 响应体契约。
- Coverage-gap-scanner 作为一次性投资，可持续防止扫描口径偏差。
- 端到端 HTTP/MCP SDK 集成测试收益/成本比不足，建议 deferred。

## 6 维度评分

| 维度 | 分数 | 证据摘要 |
|------|------|----------|
| Technical Correctness | 88 | 基于 `coverage-final.json` 的 handler 覆盖率数据准确；route contract 缺口定位与代码锚点一致（`agents.ts:20-36`、`m10.ts:11-18`、`m11.ts:7-10`、`content.ts:70-159`）；scanner 设计基于现有 AST 工具链（ts-morph / regex） |
| Completeness | 82 | 三类缺口全部识别（route contract、tools/list contract、scanner）；但缺少用户确认是否接受缩小范围；external_research 维度未引入行业 MCP 测试最佳实践 |
| Feasibility | 90 | Route contract tests 可直接复用 `admin-routes.test.ts:1-159` 和 `workflow-routes.test.ts:1-200` 的成熟模式；tools/list 可扩展 `all-tools.test.ts`；scanner 为零依赖或单依赖脚本，实现成本低 |
| Risk | 75 | ESM vi.doMock 不可靠（R01）、模块级 singleton 状态泄漏（R02）为已知风险；新增 contract tests 不会引入新风险；scanner 若接入 CI 可能因解析误差产生误报 |
| Alignment | 85 | 与 roadmap Phase 4 目标 “建立 endpoint contract tests” 一致；但缩小范围与 “30% 无测试” 的字面目标有偏差，需用户确认 |
| Maintainability | 88 | Route contract tests 为纯数据断言，维护成本低；scanner 为一次性脚本，后续仅需随 route 模块结构变更同步更新；tools/list contract 与 all-tools 模块同生命周期 |

**平均分**: (88 + 82 + 90 + 75 + 85 + 88) / 6 = **84.7**

## 置信度分解

| 维度 | 分数 | 因子评分 |
|------|------|----------|
| Findings Depth | 83.3 | 高 — 三轮分析逐步收敛，scanner 设计已细化到算法步骤 |
| Evidence Strength | 86.0 | 高 — 覆盖率 JSON、route 模块源码、现有测试文件三重交叉验证 |
| Coverage Breadth | 77.3 | 中高 — 覆盖 route contract、tools/list、scanner 三类缺口；external_research 较薄 |
| User Validation | 0 | 无 — 三轮分析均未收集用户确认 |
| Consistency | 83.7 | 高 — 各来源数据一致，无矛盾发现 |
| **Overall Confidence** | **66.1** | 受 user validation 为 0 拖累，否则约 82 |

## 关键发现总结

| ID | 类别 | 标题 | 置信度 | 证据 |
|----|------|------|--------|------|
| F01 | coverage-calibration | 探索摘要范围偏差：多数被标记为无测试的 endpoint 实际已覆盖 | high | `tests/knowledge/story-bible-endpoints.test.ts:47`、`tests/cowriting/cowriting-endpoints.test.ts:46`、`tests/mcp/workflow-endpoints.additional.test.ts:542` |
| F02 | contract-gap | 路由注册契约测试不完整：agents/m10/m11 无测试，content 剩余分组缺断言 | high | `mcp/routes/agents.ts:20-36`、`mcp/routes/m10.ts:11-18`、`mcp/routes/m11.ts:7-10`、`mcp/routes/content.ts:70-159` |
| F03 | contract-gap | 缺少 tools/list schema / JSON-RPC contract 测试 | medium | `mcp/all-tools.ts`、`tests/mcp/all-tools.test.ts` |
| F04 | integration-gap | 缺少端到端 HTTP/MCP SDK 集成测试 | medium | `mcp/gateway-http-adapter.ts`、`mcp/gateway-request-handler.ts` |
| F05 | process-gap | 缺少自动化覆盖率盘点脚本 | medium | `exploration-codebase.json` 因仅扫描 `tests/mcp/` 而误判 |
| F06 | test-pattern | 现有测试模式已成熟，可直接复用 | high | `tests/mcp/routes/admin-routes.test.ts:1-159`、`tests/mcp/routes/workflow-routes.test.ts:1-200` |
| F07 | scanner-design | Coverage-gap-scanner 设计完成：零依赖正则解析，输出 JSON + 表格，可 CI 集成 | high | 算法 6 步骤、输入输出、验收标准已定义 |

## 压力测试（Pressure Pass）

**问题**: Route contract tests 是否真的能低成本防止 wiring drift？

**验证**:
1. **成本验证**：`admin-routes.test.ts:1-159` 仅 159 行覆盖 5 条 route 的 pattern/method/handler/param 提取；按此密度，agents（3 条）、m10（2 条）、m11（1 条）合计约 200-300 行即可覆盖。Content 剩余 50 条按分组循环断言约 300-400 行。总新增代码量 < 700 行。
2. **防御价值**：若某开发者误删 `content.ts` 中的一条 route 或改错 handler 导入，route contract test 的 `toHaveLength` 和 `handler` 引用断言会立即失败。此类错误在 endpoint unit test 中不会暴露（unit test 直接调用 handler，不经过 route 注册）。
3. **历史类比**：M27 Phase 1 的 `platform-routes.test.ts` 和 `admin-routes.test.ts` 在 SEC-001 rollout 期间曾捕获 2 次 route pattern 拼写错误（`workspaces` 误写为 `workspace`），证明其实际防御价值。

**结论**: Route contract tests 是低成本、高防御价值的交付物，Phase 4 应优先投入。

## Implementation Scope

1. **Route contract tests**
   - 新增 `src-ts/tests/mcp/routes/agents-routes.test.ts` — 覆盖 `agents.ts:20-36`
   - 新增 `src-ts/tests/mcp/routes/m10-routes.test.ts` — 覆盖 `m10.ts:11-18`
   - 新增 `src-ts/tests/mcp/routes/m11-routes.test.ts` — 覆盖 `m11.ts:7-10`
   - 扩展 `src-ts/tests/mcp/routes/content-routes-additional.test.ts` — 覆盖 `content.ts:70-159` 中 story-bible/qc/cowriting/reader/learning/analysis/plugins/sync/foreshadow/character 分组

2. **Tools/list contract test**
   - 扩展 `src-ts/tests/mcp/all-tools.test.ts` 或新增 `tools-list-contract.test.ts`
   - 断言 `GET /tools` 返回数组包含关键工具的 name、method、path、inputSchema
   - 覆盖八大工具分类（memory、graph、search、workflow、critic、agent、skills、writing_helper）

3. **Coverage-gap-scanner 脚本**
   - 新建 `src-ts/scripts/coverage-gap-scanner.ts`（零依赖正则解析）
   - 新增 npm script `coverage:gap`
   - 输出 JSON + 终端表格：未引用 handler 列表、缺少 route contract test 的模块
   - 验收：正确识别 agents/m10/m11 为 uncovered，正确识别 story-bible/qc/cowriting 为 covered

4. **Deferred（不在 Phase 4）**
   - 端到端 HTTP/MCP SDK 集成测试
   - 占位 endpoint 显式 contract 集中文件（可选）

## Recommendations

1. 不要按探索摘要盲目新增 20+ endpoint handler 单元测试。
2. 优先补 route contract tests + `tools/list` contract test。
3. 将 coverage-gap-scanner 脚本作为 Phase 4 的可交付工程工具。
4. 端到端 HTTP/MCP SDK 集成测试 deferred 到后续 milestone。
5. 验收标准以“契约稳定性 + scanner 正确性 + 测试通过”为主，不以覆盖率数字提升为唯一指标。

## Next Step

`/maestro-plan 4`
