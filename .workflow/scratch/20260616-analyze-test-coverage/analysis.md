# Analysis: 全仓测试覆盖率深度分析

**Session ID**: ANL-test-coverage-2026-06-16
**Date**: 2026-06-16
**Scope**: standalone (macro)
**Mode**: full

---

## Executive Summary

全仓测试覆盖率评分 **72/100**，风险等级 **MEDIUM-HIGH**。前端测试文件比 1.10:1 表面充分，但后端仅 0.84:1。关键风险集中在 3 个层面：Store 层 5 个核心 slice 零覆盖 + 9 个浅层测试、7 个 MCP endpoints 无测试、E2E/集成测试严重不足。当前 ~68% 行覆盖率勉强通过 MVP 标准，但距生产标准差 12 个百分点。建议按 P0→P1→P2 优先级分 4 阶段补充，预估 14-18 个工作日达标。

**Recommendation**: **CONDITIONAL GO** — 当前测试覆盖不足以支撑生产部署，但核心业务模块的单元测试基本到位。需先完成 Phase 1-2（P0+P1 回归保护）再考虑上线。

---

## Six-Dimension Scoring

### Dimension 1: Feasibility — Score: 4/5 (Confidence: 85%)

| Factor | Score | Evidence |
|--------|-------|----------|
| Technical difficulty | 4/5 | Companion pattern 已在 workflow/narrative 验证有效；store/endpoint 测试编写难度低 |
| Team capability | 4/5 | vitest 框架已熟悉；现有测试覆盖高模块证明团队能力 |
| Time investment | 3/5 | Phase 1-2 需 5-7 天；Phase 3-4 需 8-11 天，总 13-18 天 |
| Tooling | 5/5 | vitest 3.2.4 + V8 coverage provider 就绪；companion pattern 有脚手架 |

**Evidence**: F-008（companion pattern 在 workflow/96% narrative/93% 验证有效）| F-001, F-002（store/endpoint 测试结构简单，无复杂 mock 需求）

### Dimension 2: Impact — Score: 5/5 (Confidence: 90%)

| Factor | Score | Evidence |
|--------|-------|----------|
| User value | 5/5 | 减少 bug 泄漏到用户；近期一致性 bug 无回归保护是实际痛点 |
| Business value | 5/5 | 测试覆盖是上线/生产的必要条件；差 7% 到 release standard |
| Tech debt reduction | 4/5 | 补测试是最有效的 tech debt 减少；消除 5 个零覆盖 slice |
| DX improvement | 4/5 | 回归保护让开发者敢于重构；companion pattern 降低编写成本 |

**Evidence**: F-001（skillsSlice 近期修过 CORR-001/007 一致性 bug，无回归保护）| F-007（距生产标准差 12%）

### Dimension 3: Risk — Score: 4/5 (Confidence: 80%)

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Store 状态回归 | High | High | Phase 1 补 P0 slice 测试 |
| Endpoint 请求解析错误 | High | Medium | Phase 2 补 endpoint 测试 |
| E2E 流程断裂 | Medium | High | Phase 4 补 E2E |
| 测试维护成本失控 | Low | Medium | 遵循 companion pattern 保持一致性 |
| Mock 过度导致假阳性 | Medium | Medium | 优先集成测试而非纯 mock 单元测试 |

**Evidence**: F-001, F-002（高风险文件列表）| F-005（E2E 空白 = 流程断裂无法自动发现）

### Dimension 4: Complexity — Score: 3/5 (Confidence: 85%)

| Factor | Score | Evidence |
|--------|-------|----------|
| Integration points | 3/5 | Store ↔ API ↔ Endpoint 3 层需协调；但各层可独立测试 |
| Dependencies | 3/5 | Store 依赖 RTK；endpoint 依赖 graph-engine；hooks 依赖 store |
| Learning curve | 2/5 | vitest + companion pattern 已熟悉；新成员上手成本低 |
| Testing complexity | 3/5 | Store 测试简单；endpoint 需 mock HTTP；E2E 需环境搭建 |

**Evidence**: F-008（companion pattern 降低学习成本）| F-006（集成测试少 = 跨层协调测试成本高）

### Dimension 5: Dependencies — Score: 3/5 (Confidence: 75%)

| Factor | Score | Evidence |
|--------|-------|----------|
| External services | 2/5 | vitest/V8 已在用；Playwright 可能需新增依赖 |
| Internal modules | 3/5 | Store 测试依赖 RTK 依赖少；endpoint 依赖 graph-engine |
| Data dependencies | 3/5 | 测试数据需要 mock graph entity 状态；已有 mock 模式 |
| Infrastructure | 4/5 | CI 已有 vitest 配置；coverage report 已集成 |

**Evidence**: exploration-codebase.json#test_framework（vitest 3.2.4 已就绪）| F-005（E2E 需 Playwright = 新依赖）

### Dimension 6: Alternatives — N/A (Comparative Analysis)

| Alternative | Pros | Cons | Verdict |
|------------|------|------|---------|
| **A: Companion pattern expansion** (推荐) | 遵循已有模式；低学习成本；workflow/narrative 验证有效 | 不适合 E2E/集成层 | **Accept** — P0/P1 首选 |
| **B: 集成测试优先** | 更真实的测试；跨层验证 | 需更多基础设施；编写成本高 | **Defer to Phase 4** |
| **C: Playwright E2E 全量** | 真实用户场景验证 | 搭建成本高；执行慢；桌面端限制 | **Evaluate in Phase 4** |
| **D: 代码覆盖率硬门槛** | 量化达标 | 可能导致为覆盖率写测试 | **Not recommended** |

---

## Dimension Summary

| Dimension | Score | Confidence | Key Evidence |
|-----------|-------|-----------|--------------|
| Feasibility | 4/5 | 85% | Companion pattern proven, tooling ready |
| Impact | 5/5 | 90% | Regression protection gap is real pain |
| Risk | 4/5 | 80% | 3 high-probability risks identified |
| Complexity | 3/5 | 85% | Moderate; existing patterns reduce effort |
| Dependencies | 3/5 | 75% | Minimal new deps; E2E tool undecided |
| **Overall** | **3.8/5** | **83%** | |

---

## Risk Matrix

```
IMPACT →
High  │ Store regression  │ E2E flow break    │
      │ [PROB:High]       │ [PROB:Medium]      │
──────┼───────────────────┼────────────────────┤
Med   │ Endpoint error    │ Mock false-positive│
      │ [PROB:High]      │ [PROB:Medium]      │
──────┼───────────────────┼────────────────────┤
Low   │ Test debt growth  │ Coverage gaming    │
      │ [PROB:Low]        │ [PROB:Low]         │
──────┴───────────────────┴────────────────────┘
       Medium             High           → PROBABILITY
```

---

## Go/No-Go Recommendation

**CONDITIONAL GO** (Confidence: 80%)

**Conditions for GO**:
1. ✅ Phase 1 完成：skillsSlice + conversationSlice + learning + workspace endpoint 测试就绪
2. ✅ Phase 2 完成：m10-revision/style + writing API 测试就绪
3. ⏳ Phase 3-4 可与功能开发并行

**Residual Risks**:
- E2E 覆盖在 Phase 4 之前仍为空白（接受为已知风险）
- 浅层测试深化非紧急但需追踪
- 无独立 CLI 视角验证（W001），单模型分析可能遗漏隐含问题

---

## Confidence Summary

| Factor | Weight | Score | Contribution |
|--------|--------|-------|-------------|
| Findings depth | 0.30 | 78% | 23.4% |
| Evidence strength | 0.25 | 75% | 18.8% |
| Coverage breadth | 0.20 | 88% | 17.6% |
| User validation | 0.15 | 50% | 7.5% |
| Consistency | 0.10 | 85% | 8.5% |
| **Overall** | | | **75.8%** |

**Pressure Pass Result**: 最高置信度发现 F-001/F-002（store + endpoint 零覆盖）经压力测试 — 证据来源为 cli-explore-agent 直接文件扫描，不受单模型偏差影响。最低置信度发现 F-004/F-007（浅层测试识别 + 标准差距估算）标记为 MEDIUM CONFIDENCE，需运行 `vitest run --coverage` 获取实际行覆盖率数据验证。
