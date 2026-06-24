---
related:
  - project-project
  - roadmap-roadmap
  - scratch-20260622-analyze-p1-reader-endpoints-split-context
  - scratch-20260622-analyze-p1-reader-endpoints-split-discussion
---

# Analysis: M28 Phase 1 — Reader Endpoints Split + Remaining Input Validation

## Executive Summary

M28 Phase 1 的目标是将 `src-ts/reader/mcp/reader-endpoints.ts` 这个 1147 行的 god module 按职责拆分为 4 个子模块，并补齐 M27 遗留的 6 个输入校验缺口。基于代码探索（cli-explore-agent）和独立 CLI 评估（maestro delegate / claude），本分析认为该 phase **技术上可行、维护价值高、风险可控**，建议 **GO**，整体置信度 **84%**。

核心约束：

1. 保留 `reader-endpoints.ts` 作为 re-export shim，避免 8 个测试文件和多处 barrel import 断裂。
2. 新增校验优先复用并扩展 `src-ts/mcp/input-validation.ts`，而非在每个 endpoint 内联。
3. 拆分后必须保持 `loadCustomPersonas()` 的模块初始化顺序，防止 custom persona store race。

## Dimension Summary

| Dimension | Score | Confidence | Key Evidence |
|-----------|-------|------------|--------------|
| Feasibility | 4/5 | 85% | 8 个 handler、10+ 类型、5 个 singleton、3 个 store 的职责边界清晰；已有 barrel 模式可复用 |
| Impact | 4/5 | 85% | 降低 1147 行 god module 维护成本；关闭 ISS-20260622-006 的 6+ 校验缺口 |
| Risk | 3/5 | 80% | 测试 import 路径、singleton 状态隔离、模块初始化 race 需在执行阶段验证 |
| Complexity | 3/5 | 80% | 无新算法，复杂度来自 import 重连、barrel 维护、校验 helper 设计 |
| Dependencies | 2/5 (favorable) | 85% | 仅内部模块；`input-validation.ts` 已提供基础 helper；无外部库变更 |
| Alternatives | 3 options evaluated | 90% | 校验优先 / 拆分优先 / 混合 + shim 已对比 |

**Overall: GO — 84% confidence**

## Per-Dimension Scoring

### Feasibility (4/5)

- 拆分对象是机械性的：handler 函数、类型接口、校验 helper、singleton getter/store、文件持久化 helper 都有明确边界。
- `exploration-codebase.json` 的 `split_recommendation` 已给出每段代码应迁入的文件与 export 列表。
- 主要可行性质疑点：8 个测试文件直接 import `reader-endpoints.ts`，通过 shim 可零成本解决。

### Impact (4/5)

- 维护性：将 1147 行文件拆成 4 个 200-400 行模块，降低认知负荷。
- 安全：补齐 `focusAreas`/`biases` 元素长度、数组长度、`dimension`、`targetStyle`、`personaIds` 元素、`version.label` 等边界。
- 可测试性：集中 store/singleton 到 `reader-services.ts` 后，`clearReaderStores` 等测试钩子更稳定。

### Risk (3/5)

| Risk | Severity | Mitigation |
|------|----------|------------|
| 测试 import 断裂 | medium | 保留 shim，测试迁移后移除 |
| singleton 状态隔离 | medium | store 与 `clearReaderStores` 集中在 `reader-services.ts` |
| custom persona load race | medium | ready guard / getter 链式调用 |
| 校验过度（dimension enum） | low | 仅限制长度，未知值仍回退 `general` |
| barrel 漂移 | low | 执行前后对比 public API |

### Complexity (3/5)

- 集成点：4 个新文件 + 2 个 barrel + 1 个 shim + 7+ 测试文件。
- 学习曲线：低，团队已熟悉 M27 的 `input-validation.ts` 模式。
- 测试：需要新增数组/枚举/标签的校验测试，并验证拆分后无回归。

### Dependencies (2/5)

- 内部依赖：`content.ts`、`endpoints/index.ts`、`reader/mcp/index.ts`。
- 无外部服务、无新库、无基础设施变更。

### Alternatives

1. **校验优先，拆分后续** — 风险低，但同一文件要改两次，浪费。
2. **拆分优先，校验后续** — 零行为变更的拆分安全，但推迟安全缺口关闭。
3. **混合 + 兼容性 shim（推荐）** — 一次 phase 内同时收敛两个 issue，shim 保护既有调用方。

## Risk Matrix

| Risk | Probability | Impact | Score |
|------|-------------|--------|-------|
| 测试 import 断裂 | medium | medium | ⚠️ |
| singleton 状态隔离失效 | low | medium | ⚠️ |
| custom persona load race | medium | low | ⚠️ |
| 校验过度导致兼容问题 | low | low | ✅ |
| barrel 漂移 | low | low | ✅ |

## Go / No-Go Recommendation

**Verdict: GO (conditional)**

- 所有 intent 已覆盖，无未解决的 ❌ 项。
- 6 维度评分均 >= 3，整体置信 84%。
- 条件：执行阶段必须保留兼容性 shim 直至测试迁移完成；`loadCustomPersonas()` 必须有 ready guard 或等效机制。

## Confidence Summary

- Feasibility: 85%
- Impact: 85%
- Risk: 80%
- Complexity: 80%
- Dependencies: 85%
- Alternatives: 90%
- **Overall: 84%**
- Pressure pass: passed on compatibility-shim finding
- Residual risks: custom persona init race（ mitigation 已确定）
