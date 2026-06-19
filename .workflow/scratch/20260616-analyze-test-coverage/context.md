# Context: 全仓测试覆盖率深度分析

**Date**: 2026-06-16
**Artifact ID**: ANL-test-coverage-2026-06-16
**Areas discussed**: Store 覆盖率, Endpoint 覆盖率, E2E/集成覆盖, 标准达标, 补测试策略

---

## Decisions

### Decision 1: 补测试优先级按风险分层
- **Context**: 全仓有多个测试缺口，需确定修复顺序
- **Options**:
  1. 按模块分（前端优先/后端优先）
  2. 按风险分（P0/P1/P2 基于回归保护需求）
  3. 按层级分（单元→集成→E2E）
- **Chosen**: 按风险分（P0→P1→P2） — **Reason**: 近期一致性 bug 修复无回归保护是最紧迫的风险；先保核心再扩面
- **Rejected**: 按模块分忽略了跨层风险；按层级分无法优先处理回归保护
- **Evidence Source**: cli-explore-agent (F-001: skillsSlice 近期修过 CORR-001/007 无回归保护)
- **Impact**: Phase 1 聚焦 P0 回归保护（4 项），Phase 2-3 逐步扩展

### Decision 2: 采用 Companion Pattern 扩展测试
- **Context**: Store 和 endpoint 需要补测试，选择何种模式
- **Options**:
  1. Companion pattern (.additional.test.*, .branches.additional.test.*)
  2. 重写测试目录结构
  3. 独立 __tests__/ 目录
- **Chosen**: Companion pattern — **Reason**: workflow/ 和 narrative/ 模块（>90% 覆盖率）验证该模式有效；与现有代码风格一致
- **Rejected**: 重写结构成本高且破坏一致性；独立目录不符合现有惯例
- **Evidence Source**: cli-explore-agent (F-008: companion pattern 在 workflow 96% / narrative 93% 验证)
- **Impact**: 降低新测试编写成本，保持代码风格统一

### Decision 3: 行覆盖率估算值需实际数据验证
- **Context**: 当前 68% 为基于文件比率的估算，非 vitest --coverage 实际数据
- **Options**:
  1. 直接使用估算值
  2. 运行 vitest --coverage 获取实际数据
- **Chosen**: 运行实际覆盖率 — **Reason**: 估算与实际可能偏差显著；实际数据是补测试效果追踪的基础
- **Rejected**: 估算值不可用于标准达标判定
- **Evidence Source**: orchestrator-inline (F-007: 当前为估算，需验证)
- **Impact**: 优先执行 vitest --coverage 获取基线数据

---

## Constraints

### Locked

- **补测试策略**: 使用 companion pattern（.additional.test.*, .branches.additional.test.*）扩展，不重写测试结构
- **P0 优先级**: skillsSlice + conversationSlice + learning endpoint + workspace endpoint 必须先于其他补测试
- **测试框架**: 继续使用 vitest 3.2.4 + @vitest/coverage-v8，不引入新测试框架
- **不追求覆盖率数字**: 不为达标而写测试，测试必须验证有意义的场景

### Free

- **Playwright/Cypress 选型**: Phase 4 评估时由实施者决定是否引入桌面端 E2E 框架
- **hooks 测试优先顺序**: top 10 高频 hooks 由实施者根据实际使用频率排列
- **集成测试 vs E2E 比例**: Phase 4 中 API bridge 验证方式由实施者决定（集成 or E2E）
- **浅层测试深化顺序**: 由实施者根据模块变更频率决定优先级

### Deferred

- **Playwright/Cypress 全量 E2E 框架搭建**: 需评估桌面端限制和搭建成本，推迟到 Phase 4
- **后端 Contract 测试**: 当前 6 个前端 contract 测试验证 API 形状，后端 contract 测试推迟
- **压力测试扩展**: 当前仅 2 个压力测试（后端），扩展推迟到基础覆盖达标后
- **测试覆盖率 CI 门槛**: 设置 CI 硬门槛推迟到实际覆盖率数据获取后

---

## Code Context

### 高风险文件（P0 — 零覆盖）
- `desktop/src/stores/app/skillsSlice.ts` — 技能状态管理
- `desktop/src/stores/app/conversationSlice.ts` — 对话核心状态
- `src-ts/mcp/endpoints/learning.ts` — 自学习数据流
- `src-ts/mcp/endpoints/workspace.ts` — 工作区上下文

### P1 需补充文件
- `desktop/src/stores/app/backendSlice.ts`, `workspaceSlice.ts`
- `src-ts/mcp/endpoints/m10-revision.ts`, `m10-style.ts`, `m11-worldview.ts`
- `desktop/src/api/writing.ts`
- `desktop/src/hooks/`（27 个缺测试 hooks）

### 现有高覆盖参考模块（companion pattern 示例）
- `src-ts/workflow/` — 96% 覆盖率，companion pattern 重度使用
- `src-ts/narrative/` — 93% 覆盖率，companion pattern 重度使用
- `src-ts/mcp/services/` — 100% 覆盖率

### 浅层测试文件（需深化）
- `desktop/src/stores/projectSlice.test.ts` + `.additional.test.ts` + `.branches.additional.test.ts`
- `desktop/src/stores/shared.test.ts`, `selectors.test.ts`
- `desktop/src/stores/settings/` — 2 个 branches 测试
- `desktop/src/stores/uiSlice.test.ts`, `writingContextStore.test.ts`

### 总体评分与风险
- **评分**: 72/100
- **风险等级**: MEDIUM-HIGH
- **当前标准**: MVP ✅ | 上线 ❌ (差 7%) | 生产 ❌ (差 12%)
