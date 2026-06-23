# Discussion: Phase 2 — Frontend Integration Completion

**Session ID**: ANL-P2-frontend-integration-2026-06-22
**Phase**: 2 / M27
**Mode**: micro (phase-scoped)
**Started**: 2026-06-22T12:15:00Z

## Table of Contents

- [User Intent](#user-intent)
- [Current Understanding](#current-understanding)
- [Round 1: Exploration Findings](#round-1-exploration-findings)
- [Intent Coverage Check](#intent-coverage-check)
- [Baseline Confidence](#baseline-confidence)
- [Round 2: Pure Function Call Strategy Deep-Dive](#round-2-pure-function-call-strategy-deep-dive)
- [Re-scored Confidence](#re-scored-confidence)

## User Intent

清除 desktop/src/ 中所有跨边界 import（从 src-ts/ 直接导入），通过 api/ 或 types/ 层重新导出，确保前端-后端类型契约一致。同时为 reader-endpoints.ts 拆分做方案准备。

## Current Understanding

4 个生产文件存在跨边界 import，严重程度从 P0 到 P2 不等。核心问题是 DocumentEditor.tsx 直接调用后端纯函数 `buildPersonalizedCraftProfile`，这是最严重的架构违规。其他 3 个是桥接层或 API 层直接导入，风险较低但需规范化。

---

## Round 1: Exploration Findings

**Sources**: cli-explore-agent (codebase 3-layer exploration)

### Key Findings

1. **P0 — DocumentEditor.tsx:22-24**: 直接 import `buildPersonalizedCraftProfile` + `PersonalizedCraftRecommendation` 从 `src-ts/analysis/personalized-craft-profile`。组件在 3 秒防抖后直接调用此纯计算函数生成写作建议。这是唯一组件层直接跨边界调用后端函数的情况。

2. **P1 — api/narrative-visualization.ts:6+16**: API 层自身从 `src-ts/narrative/types/visualization-types` 直接导入 7 个类型并重新导出。下游 9 个文件通过此 API 层导入，模式正确但 API 层不应直接依赖 src-ts。

3. **P2 — utils/writingSessionTelemetry.ts:5+7**: 封装 `analyzeWritingSessionIntelligenceCore`（纯计算函数）为 `summarizeWritingSessionTelemetry`。桥接模式有效，但桥接文件本身直接 import src-ts。

4. **P2 — types/workspace.ts:12+35**: 导入 6 个值 + 12 个类型，提供 3 个 wrapper 函数。23+ 下游消费者通过 `@/types/workspace` 导入。桥接模式成熟，风险低。

5. **reader-endpoints.ts**: 1146 行，13 个导出函数，8 个接口。建议按功能分组为 4 个文件。

### Discussion Points

- `buildPersonalizedCraftProfile` 是纯计算函数，无 I/O — 它应该通过 API 层 re-export 还是通过新的 MCP endpoint 暴露？
- 2 个测试文件也 import src-ts，需要同步修改 mock 路径
- workspace.ts 的桥接模式是否应该保留还是改用其他方式？

---

## Intent Coverage Check

| # | Intent Item | Status |
|---|-------------|--------|
| 1 | 清除 DocumentEditor.tsx 跨边界 import | ✅ addressed (anchor-1) |
| 2 | 清除 api/narrative-visualization.ts 跨边界 import | ✅ addressed (anchor-2) |
| 3 | 清除 writingSessionTelemetry.ts 跨边界 import | 🔄 in-progress (桥接模式评估) |
| 4 | 清除 types/workspace.ts 跨边界 import | 🔄 in-progress (桥接模式评估) |
| 5 | reader-endpoints.ts 拆分方案 | ✅ addressed (anchor-5) |
| 6 | grep 验收：零个 from.*src-ts | ❌ not yet touched (执行时验证) |

---

## Baseline Confidence

| Dimension | findings_depth | evidence_strength | coverage_breadth | user_validation | consistency | Score |
|-----------|---------------|-------------------|-----------------|----------------|-------------|-------|
| Feasibility | 0.85 | 0.80 | 0.90 | 0.60 | 0.85 | **0.80** |
| Impact | 0.70 | 0.75 | 0.80 | 0.50 | 0.80 | **0.71** |
| Risk | 0.80 | 0.75 | 0.85 | 0.50 | 0.80 | **0.74** |
| Complexity | 0.85 | 0.80 | 0.90 | 0.60 | 0.85 | **0.80** |
| Dependencies | 0.75 | 0.70 | 0.80 | 0.50 | 0.80 | **0.71** |
| Alternatives | 0.60 | 0.65 | 0.70 | 0.40 | 0.70 | **0.61** |

**Overall confidence**: 73% — 需用户确认收敛方向

**Weakest dimension**: Alternatives (61%) — 需讨论纯函数 re-export vs API endpoint 策略

---

## Round 2: Pure Function Call Strategy Deep-Dive

**起点**: 用户选择深入纯函数调用策略（Alternatives 维度最弱 61%）。

### 关键进展

深入分析 `buildPersonalizedCraftProfile` 跨边界调用策略，评估 3 个选项：

1. **Option A: api/analysis.ts re-export + 注释块** — ✅ 推荐
2. **Option B: types/ + api/ 拆分** — ⚠️ 次优（仅 1 个类型被组件用，收益小于复杂度）
3. **Option C: MCP endpoint + Tauri invoke** — ❌ 过度工程化（但基础设施已存在）

### 证据发现

- **api/analysis.ts 当前是纯 HTTP 封装**（`detectPatterns`、`clusterSessions` 走 `callApi`）— 加入 re-export 需注释块明确语义边界
- **桥接先例已存在**：`writingSessionTelemetry.ts:68` 用同模式处理 `analyzeWritingSessionIntelligenceCore`，但封装为 wrapper；profile 是裸 import
- **后端已有 protocol**：`IPersonalizationService.buildProfile()` + `PersonalizationServiceImpl` + DI 绑定已就绪（`protocols/personalization.ts:42`）— Option C 的后端基础设施大部分已存在，但没有对应 HTTP 路由
- **关键不对称**：前端只传 `sessionIntelligence`，缺失后端持有的 `preferenceProfile`（`recordPreferenceSignal` 累积信号）— 这是未来 Option C 的真实场景，但本次只做 import 边界清理
- **测试 mock 迁移**：4 个测试文件 `vi.mock('../../../src-ts/analysis/personalized-craft-profile')` 需改为新路径

### 决策影响

用户选择继续深入，导致纯函数调用策略从模糊（61%）提升到明确方案（Option A + 注释块）。

### 当前理解

buildPersonalizedCraftProfile 跨边界 import 的修复策略已明确：api/analysis.ts re-export + 语义边界注释。Option C（MCP endpoint）的基础设施已存在但本次不实施，作为未来 feature 锚点。

### 遗留问题

- workspace.ts 和 writingSessionTelemetry.ts 的桥接模式是否保留现状？（倾向：是，文档化为已知模式）
- reader-endpoints.ts 拆分方案细节？（倾向：仅文档化，执行 deferred 到 M28+）

---

## Re-scored Confidence

| Dimension | Score | Delta |
|-----------|-------|-------|
| Feasibility | 0.90 | +0.10 |
| Impact | 0.82 | +0.11 |
| Risk | 0.85 | +0.11 |
| Complexity | 0.85 | +0.05 |
| Dependencies | 0.80 | +0.09 |
| Alternatives | 0.85 | +0.24 ← 最大提升 |

**Overall confidence**: 73% → **85%** (+12%)

**最弱维度**: Dependencies (80%) — workspace.ts 23+ 消费者，但桥接模式成熟，风险可控

### 压力测试

对核心发现"Option A 是最佳方案"施加压力：

1. **证据要求**: api/analysis.ts 当前内容是否支持 re-export？✅ 已验证：当前仅 2 个 HTTP API，re-export 可附加在末尾
2. **假设探测**: "纯函数不需要 IPC"是否成立？✅ 是 — 前端输入 `sessionIntelligence` 本地生成，无后端状态依赖
3. **边界/权衡**: Option A 的"api/ lying" 顾虑如何缓解？✅ 注释块明确标注"纯计算函数直通，非网络 API"
4. **根因检查**: 为什么会有跨边界 import？— Phase 2 起因是前端直接调用后端纯函数，而非通过 API 层

压力测试通过 — Option A 方案稳固。
