# Cross-Cutting Concerns: M24 System Architecture

## Dependency Graph

```
F-001 (console-logger) ─────────────────────────────────────┐
    │                                                        │
    v                                                        │
F-003 (type-safety) ──────────────────────────┐              │
    │                                          │              │
    v                                          v              v
F-004 (translations) ──> F-002 (component-split) ──> F-007 (visualization)
    │                         │                              │
    v                         v                              v
F-005 (craft-catalog) ──> F-006 (workflow-engine) ──> F-008 (revision-workflow)
```

**关键依赖关系**:
- F-002 MUST 在 F-001 完成后执行（拆分后的子组件需使用新 logger）
- F-006 SHOULD 在 F-003 完成后执行（类型加固为重构提供安全网）
- F-007/F-008 MUST 在 F-006 完成后执行（依赖重构后的 workflow 接口）
- F-005 MAY 与 F-004 并行执行（无直接依赖）

## Recommended Execution Order

| Phase | Features | Duration Estimate | Gate |
|-------|----------|-------------------|------|
| Phase 1 | F-001, F-003 | 2-3 days | 全部测试通过 + 零 console 泄露 |
| Phase 2 | F-004, F-005 (parallel) | 3-4 days | i18n 功能验证 + catalog 加载测试 |
| Phase 3 | F-002 | 4-5 days | 快照测试 + 交互测试通过 |
| Phase 4 | F-006 | 5-7 days | 现有 workflow 集成测试全部通过 |
| Phase 5 | F-007 or F-008 | 5-7 days | 功能验收 + 性能基线 |

## Shared Infrastructure Needs

### 1. LogService (F-001 产出，全局复用)

```typescript
interface LogService {
  debug(tag: string, message: string, meta?: Record<string, unknown>): void;
  info(tag: string, message: string, meta?: Record<string, unknown>): void;
  warn(tag: string, message: string, meta?: Record<string, unknown>): void;
  error(tag: string, message: string, error?: Error, meta?: Record<string, unknown>): void;
}
```

- MUST 支持运行时 level 切换（development vs production）
- MUST 支持结构化输出（JSON 格式，便于后续接入远程日志）
- SHOULD 提供 React Context 注入，避免全局单例

### 2. Module Loader Pattern (F-004, F-005 共用)

```typescript
interface ModuleLoader<T> {
  load(moduleId: string): Promise<T>;
  preload(moduleIds: string[]): Promise<void>;
  invalidate(moduleId: string): void;
}
```

- 用于 translations 按需加载和 craft-catalog JSON 加载
- MUST 支持缓存 + 失效机制
- SHOULD 支持 bundle-time 静态分析（tree-shaking 友好）

### 3. JSON Schema Validator (F-005 核心，F-007/F-008 复用)

- craft-catalog 外置后 MUST 有运行时 schema 校验
- SHOULD 使用 Zod 或 AJV（项目已有依赖优先）
- 校验失败 MUST 提供明确错误路径和期望类型

## Observability Requirements

| # | Metric | Type | Source | Threshold |
|---|--------|------|--------|-----------|
| 1 | `frontend.log.volume` | Counter | LogService | < 100 entries/min (production) |
| 2 | `component.render.duration` | Histogram | EvaluationPanel, StoryBiblePanel | P95 < 50ms |
| 3 | `workflow.engine.step.duration` | Histogram | WorkflowEngine | P95 < 5s |
| 4 | `workflow.engine.error.rate` | Rate | WorkflowEngine | < 1% |
| 5 | `catalog.load.duration` | Histogram | CraftCatalog loader | P95 < 200ms |
| 6 | `translation.module.load` | Counter + Duration | i18n ModuleLoader | P95 < 50ms |
| 7 | `revision.session.completion_rate` | Gauge | RevisionOrchestrator | > 80% |

**Log Events** (结构化):
- `log.level_change` — logger 级别运行时切换
- `component.split.fallback` — 拆分组件降级到整体渲染
- `workflow.step.retry` — 工作流步骤重试
- `catalog.schema.validation_fail` — catalog 数据校验失败
- `revision.session.abandon` — 修订会话中途放弃

**Health Checks**:
- LogService 可写性（buffer 未溢出）
- Catalog 数据完整性（schema 校验通过）
- Workflow engine 状态一致性（无 orphan sessions）

## Configuration Model

| Parameter | Default | Validation | Scope |
|-----------|---------|-----------|-------|
| `log.level` | `'info'` | enum: debug/info/warn/error | Runtime |
| `log.structured` | `true` | boolean | Build-time |
| `catalog.source` | `'bundled'` | enum: bundled/external/remote | Build-time |
| `catalog.path` | `'./data/craft-catalog.json'` | valid file path | Build-time |
| `translation.lazy` | `true` | boolean | Build-time |
| `translation.fallback` | `'zh'` | enum: zh/en | Runtime |
| `workflow.maxConcurrent` | `3` | integer 1-10 | Runtime |
| `workflow.stepTimeout` | `30000` | integer > 0 (ms) | Runtime |
| `visualization.maxNodes` | `500` | integer 50-2000 | Runtime |
| `revision.maxIterations` | `5` | integer 1-20 | Runtime |

所有 runtime 参数 MUST 支持热更新（通过 settings store），build-time 参数 MUST 在编译期确定。

## Error Handling Strategy

### Classification

| Category | Examples | Recovery |
|----------|----------|----------|
| Transient | Network timeout, LLM rate limit | Exponential backoff, max 3 retries |
| Data | Schema validation fail, corrupt JSON | Fallback to bundled default + alert |
| Logic | Invalid state transition, null reference | Log + graceful degradation |
| Fatal | OOM, unrecoverable corruption | Crash report + restart prompt |

### Cross-Feature Error Propagation

- F-005 catalog 加载失败 MUST NOT 阻塞应用启动（fallback to empty catalog）
- F-006 workflow step 失败 MUST 触发 checkpoint save（已有机制）
- F-007 可视化渲染错误 MUST 隔离在 ErrorBoundary 内，不影响编辑器
- F-004 翻译模块加载失败 MUST fallback 到 key 本身显示

## Backward Compatibility Contract

以下接口在 M24 期间 MUST NOT 变更签名：

1. `WorkflowEngine` 的所有 public methods（route, plan, execute, run, stream）
2. `useI18n()` hook 的返回类型 `Translations`
3. `EvaluationPanel` 和 `StoryBiblePanel` 的 props 接口
4. `craft-catalog.ts` 的所有 export types（SatisfactionPattern, etc.）
5. Backend API endpoints（`/api/workflow/*`, `/api/narrative/*`）

内部实现 MAY 自由重构，但所有 consumer 代码 MUST NOT 需要修改。
