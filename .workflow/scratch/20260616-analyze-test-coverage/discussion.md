# Discussion: 全仓测试覆盖率深度分析

**Session ID**: ANL-test-coverage-2026-06-16
**Topic**: 全仓测试覆盖率分析 — 8 维度覆盖率统计 + 风险评估 + 补测试路线图
**Date**: 2026-06-16
**Dimensions**: coverage, unit, integration, e2e, business, risk
**Mode**: standalone (macro)

---

## Table of Contents

- [User Intent](#user-intent)
- [Current Understanding](#current-understanding)
- [Round 1: Codebase Exploration](#round-1-codebase-exploration)
- [Intent Coverage Matrix](#intent-coverage-matrix)
- [Confidence Scoring](#confidence-scoring)
- [Conclusions](#conclusions)

---

## User Intent

1. 前端测试覆盖率统计
2. 后端测试覆盖率统计
3. 单元测试覆盖率统计
4. 接口测试覆盖率统计
5. 集成测试覆盖率统计
6. E2E 测试覆盖率统计
7. 核心业务模块覆盖率统计
8. 未覆盖文件和高风险模块识别
9. 哪些核心模块没有测试
10. 哪些测试只是浅层测试
11. 哪些业务流程没有自动化验证
12. 当前测试覆盖率是否达到 MVP / 上线 / 生产可用标准
13. 应该优先补哪些测试
14. 总体测试覆盖率评分
15. 风险等级
16. P0/P1/P2 测试缺口
17. 建议补测试路线图

---

## Current Understanding

全仓测试覆盖率为 **MEDIUM-HIGH 风险等级**（评分 72/100）。前端测试文件比 1.10:1 看似充分，但后端仅 0.84:1 且多个关键模块零覆盖。5 个 store slices 完全无测试、7 个 MCP endpoints 无测试、hooks 覆盖率仅 27%。集成测试和 E2E 测试严重不足（分别仅 13 和 6 个）。当前覆盖率勉强通过 MVP 标准（60%），但未达上线标准（75%）和生产标准（80%）。浅层测试问题集中在 store 层（9/20 happy-path only），核心业务流程均缺乏端到端验证。

---

## Round 1: Codebase Exploration

**Sources**: cli-explore-agent (3-layer), Glob/Bash 文件统计, orchestrator inline analysis
**Date**: 2026-06-16

### Key Findings

#### 1. 文件级覆盖率分布

| 目录 | 源文件 | 测试文件 | 覆盖率% | 风险 |
|------|--------|----------|---------|------|
| desktop/src/api/ | 34 | 48 | 85% | medium |
| desktop/src/stores/ | 19 | 20 | 68% | **high** |
| desktop/src/components/ | 155 | 185 | 89% | low |
| desktop/src/hooks/ | 37 | 10 | 27% | **high** |
| src-ts/mcp/endpoints/ | 23 | 31 | 70% | **high** |
| src-ts/mcp/services/ | 9 | 30 | 100% | low |
| src-ts/graph/ | 3 | 4 | 100% | low |
| src-ts/workflow/ | 54 | 109 | 96% | low |
| src-ts/narrative/ | 54 | 118 | 93% | low |
| src-ts/memory/ | 17 | 18 | 100% | low |
| src-ts/container/ | 8 | 9 | 100% | low |

#### 2. 未覆盖关键文件

**前端（6 个未覆盖 store slices）**:
- `app/backendSlice.ts` — 后端连接状态
- `app/conversationSlice.ts` — 对话核心状态
- `app/loadingSlice.ts` — 全局加载状态
- `app/skillsSlice.ts` — 技能状态（近期修复过一致性 bug，无回归保护）
- `app/workspaceSlice.ts` — 工作区状态
- `settings/state.ts` — 设置状态

**后端（7 个未覆盖 endpoints）**:
- `learning.ts` — 自学习数据流
- `workspace.ts` — 工作区上下文
- `m10-revision.ts` — 修订核心功能
- `m10-style.ts` — 风格分析
- `m11-worldview.ts` — 世界观提取
- `plugins.ts` — 插件管理
- `analysis.ts` — 分析功能

#### 3. 测试类型分布

| 类型 | 前端 | 后端 | 总计 |
|------|------|------|------|
| 单元测试 | 324 | 656 | 980 |
| 集成测试 | 4 | 9 | 13 |
| E2E 测试 | 1 | 5 | 6 |
| Contract 测试 | 6 | 0 | 6 |
| 压力测试 | 0 | 2 | 2 |
| Companion 附加 | 66 | 355 | 421 |

#### 4. 浅层测试识别

**9 个浅层 store 测试**（仅 happy-path，无错误/边界覆盖）:
- `projectSlice.test.ts`, `projectSlice.additional.test.ts`, `projectSlice.branches.additional.test.ts`
- `shared.test.ts`, `selectors.test.ts`
- `settings/state.branches.additional.test.ts`, `settingsStore.additional.test.ts`
- `uiSlice.test.ts`, `writingContextStore.test.ts`

**2 个浅层 endpoint 测试**:
- `chat-endpoints.test.ts`, `config-endpoints.test.ts`

#### 5. 业务流程覆盖缺口

| 业务流程 | 有集成测试 | 有 E2E | 缺口 |
|----------|-----------|--------|------|
| 伏笔 CRUD | ✅ | ❌ | 无 plant→stats→list→harvest 端到端流程 |
| 角色分析 | ✅ | ❌ | 无 create→depth→evaluate 端到端流程 |
| 写作工作流 | ✅ | ✅(部分) | E2E 仅覆盖创作周期，不覆盖修订循环 |
| 图谱 CRUD | ✅ | ❌ | 无实体生命周期端到端测试 |
| 记忆搜索 | ✅ | ❌ | 无 add→search→retrieve 端到端流程 |
| 小说质量评估 | ✅ | ❌ | 无 content→score→decision→fix 端到端流程 |
| API 桥接 | ✅(部分) | ❌ | 6 个 contract 测试验证形状但非运行时兼容 |

#### 6. 标准达标评估

| 标准 | 要求行覆盖率 | 当前估算 | 判定 | 差距 |
|------|-------------|----------|------|------|
| MVP | 60% | ~68% | ✅ PASS | 临界 — 关键模块 < 70% |
| 上线 | 75% | ~68% | ❌ FAIL | 7% 差距 |
| 生产可用 | 80% | ~68% | ❌ FAIL | 12% 差距 |

### Discussion Points

1. **Store 层是最薄弱环节** — 5 个 slice 完全无测试，近期一致性 bug 修复后无回归保护
2. **MCP endpoints 30% 无测试** — 7/23 endpoints 完全无覆盖，包含 M25 核心功能
3. **Hooks 严重不足** — 37 个源文件仅 10 个测试文件，27% 覆盖率
4. **E2E 测试几乎空白** — 6 个 E2E 测试无法覆盖 7 个核心业务流程
5. **Companion 测试模式有效** — `.additional.test.*` 模式使 workflow/narrative 达到 >90%

### Open Questions

- 是否需要引入 Playwright/Cypress 进行桌面端 E2E？
- 优先补充 P0 回归保护还是 P2 E2E 覆盖？
- Contract 测试是否需要扩展到后端？

### Warnings

- **W001**: maestro delegate CLI 分析被数据安全策略阻断（不可将私有仓库源码发送到外部 Gemini 服务），多视角验证降级为单模型内联分析。部分发现标记为 LOW CONFIDENCE。

---

## Intent Coverage Matrix

| # | Original Intent | Status | Where Addressed | Notes |
|---|----------------|--------|-----------------|-------|
| 1 | 前端测试覆盖率 | ✅ | Round 1, exploration-codebase.json | 304 源文件 / 334 测试，1.10:1 |
| 2 | 后端测试覆盖率 | ✅ | Round 1, exploration-codebase.json | 862 源文件 / 722 测试，0.84:1 |
| 3 | 单元测试覆盖率 | ✅ | Round 1, exploration-codebase.json | 980 个单元测试（93% of total） |
| 4 | 接口测试覆盖率 | ✅ | Round 1, exploration-codebase.json | 6 contract + 7 untested endpoints |
| 5 | 集成测试覆盖率 | ✅ | Round 1, exploration-codebase.json | 13 个集成测试，严重不足 |
| 6 | E2E 测试覆盖率 | ✅ | Round 1, exploration-codebase.json | 6 个 E2E 测试，几乎空白 |
| 7 | 核心业务模块覆盖率 | ✅ | Round 1, exploration-codebase.json | 7 个核心流程均有缺口 |
| 8 | 未覆盖文件和高风险模块 | ✅ | Round 1, exploration-codebase.json | 5 stores + 7 endpoints + 27 hooks |
| 9 | 核心模块没有测试 | ✅ | Round 1, exploration-codebase.json | skillsSlice, conversationSlice, 7 endpoints |
| 10 | 浅层测试 | ✅ | Round 1, exploration-codebase.json | 9 store + 2 endpoint tests |
| 11 | 缺失业务流程验证 | ✅ | Round 1, exploration-codebase.json | 7 个核心流程缺 E2E |
| 12 | 达标评估 | ✅ | Round 1, exploration-codebase.json | MVP PASS / 上线 FAIL / 生产 FAIL |
| 13 | 优先补充 | ✅ | Round 1, exploration-codebase.json | P0: 4 items, P1: 7 items |
| 14 | 总体评分 | ✅ | Round 1, exploration-codebase.json | 72/100, MEDIUM-HIGH |
| 15 | 风险等级 | ✅ | Round 1, exploration-codebase.json | MEDIUM-HIGH |
| 16 | P0/P1/P2 缺口 | ✅ | Round 1, exploration-codebase.json | P0×4, P1×7, P2×5 |
| 17 | 路线图 | ✅ | Round 1, exploration-codebase.json | 4 阶段路线图 |

---

## Confidence Scoring

### Baseline (Round 1)

| Dimension | Findings Depth (.30) | Evidence Strength (.25) | Coverage Breadth (.20) | User Validation (.15) | Consistency (.10) | **Overall** |
|-----------|---------------------|------------------------|----------------------|----------------------|-------------------|-------------|
| Coverage | 80 | 85 | 90 | 50 | 85 | **78%** |
| Unit | 85 | 90 | 95 | 50 | 90 | **83%** |
| Integration | 70 | 75 | 80 | 50 | 75 | **70%** |
| E2E | 65 | 70 | 70 | 50 | 70 | **65%** |
| Business | 80 | 75 | 85 | 50 | 80 | **76%** |
| Risk | 85 | 80 | 90 | 50 | 85 | **79%** |

**Overall Confidence: 75%** — 需用户确认收敛

> **Note**: CLI 多视角验证因安全策略被阻断（W001），User Validation 和 Evidence Strength 部分降权。关键发现基于 cli-explore-agent（独立证据源）+ orchestrator 内联分析。

---

## Conclusions

### 总体评分: 72/100 — MEDIUM-HIGH 风险

### 关键结论

1. **Store 层是最大风险点** — 5 个 slice 无测试 + 9 个浅层测试，一致性 bug 修复后无回归保护
2. **后端 endpoints 30% 空白** — 包含 M25 核心功能的 7 个 endpoints 无任何测试
3. **E2E/集成测试严重不足** — 6 个 E2E + 13 个集成测试无法支撑生产标准
4. **MVP 勉强通过，生产标准差 12%** — 当前 ~68% 行覆盖率，需达 80%
5. **Companion 测试模式证明有效** — workflow/narrative 模块 >90% 得益于 `.additional.test.*` 模式

### 优先补充路线图

| Phase | Priority | 工期 | 内容 |
|-------|----------|------|------|
| Phase 1 | P0 | 2-3 天 | skillsSlice + conversationSlice + learning + workspace endpoint |
| Phase 2 | P1 | 3-4 天 | m10-revision/style/worldview + plugins + writing API |
| Phase 3 | P1-P2 | 3-4 天 | 剩余 store slices + 深化浅层测试 + top 10 hooks |
| Phase 4 | P2 | 5-7 天 | 业务流程 E2E + API bridge 集成 + Playwright 评估 |

## Related
- [[spec:project:test-conventions]]
