# Roadmap: M27 — Security Hardening + Frontend Integration Completion

- [[spec:project:architecture-constraints]]
- [[spec:project:coding-conventions]]

## Overview

M27 聚焦两大目标：(1) 修复 3 个安全 HIGH issues（输入长度/路径遍历/数值范围）并通过共享校验模块将防护推广至全部 15+ endpoints，(2) 清除剩余 6 处前端跨边界 import 并对齐 frontend-backend 类型契约。

安全修复采用"输入校验三件套"模式（长度限制 + 路径收容 + 数值范围），与 learnings 中的 MCP endpoint 安全契约一致。前端修复延续 ISS-015/016 的 api/reader.ts 重导出模式，消除所有 `from '../../../../src-ts/'` 跨边界 import。

## Phases

- [ ] **Phase 1: Security Hardening** — 共享校验模块 + 3 个 HIGH fix + 全端点推广
- [ ] **Phase 2: Frontend Integration Completion** — 跨边界 import 清除 + 类型对齐 + reader-endpoints 拆分准备

## Phase Details

### Phase 1: Security Hardening

**Goal**: 创建共享输入校验模块，修复 3 个安全 HIGH，将防护推广至 reader 全部 7 个端点 + 其他模块 15 个端点。

**Depends on**: Nothing

**Requirements**: ISS-20260620-007 (文本长度), ISS-20260620-008 (路径遍历), ISS-20260620-009 (数值范围)

**Success Criteria** (what must be TRUE):
1. `src-ts/mcp/input-validation.ts` 导出三个共享校验函数：`validateStringLength()`, `safeResolveWorkspaceRoot()`, `validateWeight()`
2. reader 7 个 endpoint 全部添加 `validateStringLength` 长度守卫（novelId<=256, text<=100k, name<=200），超标返回 413
3. `NIKO_WORKFLOW_WORKSPACE` 在 8 个 endpoint + 3 个 service 文件共 11 处替换为 `safeResolveWorkspaceRoot()`，含路径遍历拦截
4. `rsCreateCustomPersonaEndpoint` 权重校验添加 `Number.isFinite()` + [0,1] 范围检查；`adjustPersonaWeights` NaN 安全回退
5. `chat.ts` 的 `validateChatMessagesLimits` 重构为调用共享模块（可选，保持向后兼容）
6. 至少 15 个新增单元测试覆盖三类校验的边界条件
7. TypeScript strict 无新增 error，现有测试无回归

**Wave DAG**:
- Wave 1: TASK-001 (创建 input-validation.ts 共享模块) → 无依赖
- Wave 2: TASK-002/003/004 (三个 HIGH fix) → depends_on TASK-001
- Wave 3: TASK-005 (其他端点推广) → depends_on TASK-002

### Phase 2: Frontend Integration Completion

**Goal**: 清除全部前端跨边界 import，对齐 frontend-backend 类型契约，为 reader-endpoints.ts 拆分做准备。

**Depends on**: Phase 1 (类型可能因 input-validation 改变)

**Requirements**: ISS-20260621-018 (跨边界 import), ISS-20260621-013 (reader-endpoints 拆分)

**Success Criteria** (what must be TRUE):
1. `desktop/src/` 零个 `from '../../../../src-ts/'` 或 `from '../../../src-ts/'` 跨边界 import（`grep -r "from.*src-ts" desktop/src/` 返回 0 结果）
2. `desktop/src/types/` 目录下所有类型均从 `api/` 层重导出，或定义在独立的 `types/` 文件中
3. `desktop/src/api/narrative-visualization.ts` 类型从 `api/` 层重导出而非直接 import src-ts
4. `desktop/src/utils/writingSessionTelemetry.ts` 类型改为本地声明或 api 层重导出
5. `desktop/src/components/DocumentEditor.tsx` 的 `buildPersonalizedCraftProfile` 调用通过 api 层间接
6. reader-endpoints.ts 拆分方案文档化（路由/校验/服务/类型导出），为后续 M 执行做准备
7. TypeScript strict 无新增 error，现有测试无回归

**Wave DAG**:
- Wave 1: TASK-006 (类型迁移到 api/types 层) → 无依赖
- Wave 2: TASK-007 (组件 import 重指向) → depends_on TASK-006
- Wave 3: TASK-008 (reader-endpoints 拆分方案 + grep 验收) → depends_on TASK-007

## Scope Decisions

- **In scope**:
  - S-001: 共享输入校验模块 (input-validation.ts)
  - S-002: Reader endpoints 文本长度限制 (ISS-20260620-007)
  - S-003: Workspace root 路径遍历拦截 (ISS-20260620-008)
  - S-004: Persona 权重数值范围校验 (ISS-20260620-009)
  - S-005: 其他端点输入校验推广（critic/wiki/graph/agent/workflow/memory）
  - F-001: narrative-visualization.ts 跨边界 import 清除
  - F-002: writingSessionTelemetry.ts 跨边界 import 清除
  - F-003: workspace.ts 跨边界 import 清除
  - F-004: DocumentEditor.tsx buildPersonalizedCraftProfile import 清除
  - F-005: reader-endpoints.ts 拆分方案文档化

- **Deferred (M28+)**:
  - reader-endpoints.ts 实际拆分执行（需架构决策 + 专项测试）
  - gateway-control-plane 双文件清理（container/ re-export 垫片保持向后兼容）
  - GatewayDeps ISP 拆分 (ISS-20260613-033)
  - 29 个 medium issues 逐个修复（分批 triage 到后续 M）

- **Out of scope**:
  - 破坏现有 API 接口向后兼容性
  - 引入新依赖
  - 前端新功能开发

## Implementation Strategies

| Strategy | Applies To | Description |
|----------|-----------|-------------|
| 共享校验模块 | S-001~S-005 | 创建 src-ts/mcp/input-validation.ts，导出三件套校验函数 |
| 输入校验三件套 | S-002~S-005 | 长度上限 + 路径收容 + 数值范围，每个 endpoint 必备 |
| API 层重导出 | F-001~F-004 | 类型在 api/ 层定义或重导出，前端组件只从 api/ 或 types/ 导入 |
| 方案先行 | F-005 | reader-endpoints 拆分先出方案，不直接执行 |
| 渐进替换 | S-003 | 11 处 resolveWorkspaceRoot 渐进替换为 safeResolveWorkspaceRoot，保持接口不变 |

## Task Breakdown

### Phase 1 Tasks (8 tasks)

| ID | Title | Wave | Effort | Depends On | Files |
|----|-------|------|--------|------------|-------|
| TASK-001 | 创建 src-ts/mcp/input-validation.ts 共享校验模块 | W1 | S | — | src-ts/mcp/input-validation.ts (new) |
| TASK-002 | Reader endpoints 添加文本长度限制 (ISS-007) | W2 | M | TASK-001 | src-ts/reader/mcp/reader-endpoints.ts |
| TASK-003 | safeResolveWorkspaceRoot 替换 11 处 resolveWorkspaceRoot (ISS-008) | W2 | M | TASK-001 | src-ts/mcp/endpoints/{workspace,workflow,wiki,graph,critic,chat,agent,memory}.ts, src-ts/mcp/services/workflow.ts, workflow-revision.ts, src-ts/services/revision-service.ts |
| TASK-004 | Persona 权重 Number.isFinite + [0,1] 范围校验 (ISS-009) | W2 | S | TASK-001 | src-ts/reader/mcp/reader-endpoints.ts, src-ts/reader/PersonaDefinition.ts |
| TASK-005 | 其他端点输入校验推广 | W3 | M | TASK-002 | src-ts/mcp/endpoints/{critic,wiki,graph,agent,workflow,memory}.ts |
| TASK-006 | 输入校验单元测试 (15+ cases) | W3 | M | TASK-004 | tests/mcp/input-validation.test.ts (new) |
| TASK-007 | reader-endpoints 集成测试补充 | W3 | S | TASK-002 | tests/reader/reader-endpoints.validation.test.ts (new) |
| TASK-008 | 回归验证 + TypeScript 严格检查 | W3 | S | TASK-005~007 | — |

### Phase 2 Tasks (4 tasks)

| ID | Title | Wave | Effort | Depends On | Files |
|----|-------|------|--------|------------|-------|
| TASK-009 | narrative-visualization + workspace + writingSession 类型迁移 | W1 | M | — | desktop/src/api/narrative-visualization.ts, desktop/src/types/workspace.ts, desktop/src/utils/writingSessionTelemetry.ts |
| TASK-010 | DocumentEditor.tsx buildPersonalizedCraftProfile import 清除 | W2 | S | TASK-009 | desktop/src/components/DocumentEditor.tsx, desktop/src/components/DocumentEditor.*.test.tsx |
| TASK-011 | reader-endpoints.ts 拆分方案文档化 | W2 | S | TASK-010 | .workflow/milestones/M27/reader-endpoints-split-plan.md |
| TASK-012 | grep 验收 + 回归测试 | W3 | S | TASK-010 | — |

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| safeResolveWorkspaceRoot 破坏现有 workspace 解析 | Low | High | 保持 resolveWorkspaceRoot() 签名不变，内部委托 safeResolveWorkspaceRoot()；添加 NIKO_WORKSPACE_ALLOW_OUTSIDE=true 逃生舱 |
| 文本长度限制过小影响正常使用 | Low | Medium | MAX_TEXT_LENGTH=100k > 24k chat 限制，覆盖 99% 稿件；可配置 |
| 类型迁移导致 test break | Medium | Low | 渐进替换，每步 tsc + vitest 验证 |
| reader-endpoints 拆分方案决策分歧 | Medium | Low | P2 只产出方案，不执行；留 M28 决策 |

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Security Hardening | Not started | — |
| 2. Frontend Integration Completion | Not started | — |
