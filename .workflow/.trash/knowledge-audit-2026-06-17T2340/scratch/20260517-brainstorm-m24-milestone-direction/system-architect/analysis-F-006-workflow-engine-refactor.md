# F-006: Workflow Engine Refactor — System Architect Analysis

## Architecture Approach

将 1970 行的 `workflow-engine.ts` 按职责分层，将业务规则从编排逻辑中提取为独立的策略模块。核心约束：所有 public API 签名 MUST NOT 变更，现有集成测试 MUST 全部通过。

### Design Rationale

- 当前文件混合了 5 种关注点：路由决策、计划生成、执行编排、状态管理、业务规则
- 已有 `engine/` 子目录（authority, observability, persistence 等），证明分层方向正确
- 但 `workflow-engine.ts` 本身仍是"上帝对象"，持有过多直接逻辑
- 重构目标：workflow-engine.ts 降至 < 500 行，仅保留 facade + delegation

## Data Model

### Current Architecture (Before)

```
workflow-engine.ts (1970 lines) — 直接实现所有方法
├── route() — 路由决策 + 复杂度评估
├── plan() — 计划生成 + LLM 调用
├── execute() — 步骤执行 + 错误处理
├── run() — 完整生命周期
├── stream() — SSE 流式执行
└── (内部) — checkpoint, state, budget, quality 逻辑
```

### Target Architecture (After)

```
workflow-engine.ts (< 500 lines) — Facade, delegates to:
├── engine/router.ts          — 路由决策 + 复杂度评估
├── engine/planner.ts         — 计划生成 + LLM 交互
├── engine/executor.ts        — 步骤执行 + 错误恢复
├── engine/streamer.ts        — SSE 流式编排
├── engine/flow-control.ts    — (已存在) 流程控制
├── engine/lifecycle.ts       — (已存在) 生命周期
├── engine/observability.ts   — (已存在) 可观测性
├── engine/persistence.ts     — (已存在) 持久化
├── engine/risk.ts            — (已存在) 风险评估
└── engine/runtime-state.ts   — (已存在) 运行时状态
```

### Entity: WorkflowEngine (Refactored)

```typescript
class WorkflowEngine {
  // Dependencies (injected)
  private router: WorkflowRouter;
  private planner: WorkflowPlanner;
  private executor: WorkflowExecutor;
  private streamer: WorkflowStreamer;
  private sessionManager: SessionManager;

  // Public API — signatures UNCHANGED
  async route(request: WorkflowRouteRequest): Promise<WorkflowRouteResult> {
    return this.router.route(request);
  }
  async plan(request: WorkflowPlanRequest): Promise<WorkflowPlanResult> {
    return this.planner.plan(request);
  }
  async execute(request: WorkflowExecuteRequest): Promise<WorkflowExecuteResult> {
    return this.executor.execute(request);
  }
  // ... etc
}
```

## State Machine: Workflow Execution (Unchanged)

```
[idle] ──(route)──> [routing]
                        │
                        ├──(level determined)──> [planning]
                        │                            │
                        │                            ├──(plan ready)──> [executing]
                        │                            │                      │
                        │                            │    ┌──(step done)────┤
                        │                            │    │                  │
                        │                            │    └──(all done)──> [completed]
                        │                            │
                        │                            └──(plan error)──> [failed]
                        │
                        └──(route error)──> [failed]
```

状态机本身 MUST NOT 变更——仅将状态转换的实现从单文件分散到对应的策略模块。

## Error Handling Strategy

### 分层错误边界

| Layer | Error Scope | Recovery |
|-------|-------------|----------|
| Router | 路由决策失败 | Fallback to L1-rapid |
| Planner | LLM 调用失败 | Retry with secondary model |
| Executor | 步骤执行失败 | Checkpoint + retry/skip |
| Streamer | SSE 连接断开 | Resume from last event |
| Facade | 跨层错误 | Unified error response |

### Error Propagation Rule

- 每层 MUST 将错误转换为该层的错误类型（不泄露内部实现）
- Facade 层 MUST 将所有错误统一为 `WorkflowOperationErrorResult`
- 已有的 `buildWorkflowOperationError()` 工厂函数 MUST 继续使用

## Integration Points

### 现有 Engine 子模块（已分离）

已存在的 `engine/` 子模块（authority, flow-control, lifecycle, observability, persistence, preflight, recommendations, responses, risk, runtime-state, session-io）MUST 保持不变。新增的 router/planner/executor/streamer 是对 workflow-engine.ts 中剩余逻辑的提取。

### 外部 Consumer

- `src-ts/workflow/index.ts` — 导出 WorkflowEngine（接口不变）
- `src-ts/mcp/` — MCP handler 调用 workflow API（接口不变）
- `desktop/src/api/workflow.ts` — 前端 API 调用（HTTP 接口不变）
- 集成测试 `tests/workflow/workflow-engine.integration.test.ts` — MUST 全部通过

### 依赖注入策略

```typescript
// 构造函数注入，保持现有初始化方式兼容
class WorkflowEngine {
  constructor(config: WorkflowEngineConfig) {
    this.router = new WorkflowRouter(config);
    this.planner = new WorkflowPlanner(config, this.llmProvider);
    this.executor = new WorkflowExecutor(config, this.sessionManager);
    this.streamer = new WorkflowStreamer(config, this.executor);
  }
}
```

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| 重构范围蔓延（改着改着改太多） | High | High | 严格限定：只提取，不重写逻辑 |
| 隐式依赖（方法间共享 this 状态） | Medium | High | 先画依赖图，再决定切割点 |
| 集成测试不够覆盖边界 | Medium | Medium | 重构前先补充关键路径测试 |
| 性能回归（多层调用开销） | Low | Low | 直接方法调用，无反射/动态分发 |

**总体风险**: HIGH — 这是 M24 中风险最高的特性。MUST 采用增量策略：每次提取一个方法组，确保测试通过后再继续。

### Mitigation: Incremental Extraction Plan

1. 提取 `route()` 相关逻辑 → `engine/router.ts` (测试通过)
2. 提取 `plan()` 相关逻辑 → `engine/planner.ts` (测试通过)
3. 提取 `execute()` 相关逻辑 → `engine/executor.ts` (测试通过)
4. 提取 `stream()` 相关逻辑 → `engine/streamer.ts` (测试通过)
5. 清理 workflow-engine.ts 为纯 facade (最终验证)

每步之间 MUST 有独立 commit，确保可回滚。
