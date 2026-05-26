# Maestro-Flow vs NIKO-Studio: Phase 2 对比分析

## 1. Dashboard Architecture

### maestro-flow 实现
- React 19 + Hono (cloudflare workers) + WebSocket
- `src/dashboard/` 目录：client (React SPA) + server (Hono routes)
- 实时通信：WebSocket push（非 SSE），客户端订阅 engine events
- 状态管理：Zustand store，WebSocket message → store mutation → UI re-render
- 数据流：engine events → WebSocket broadcast → Zustand → React components

### niko-studio 现状
- MCP Gateway (`mcp/`)：HTTP REST，无 WebSocket/SSE（writing 端点有 SSE）
- 无前端 dashboard
- 实时状态只能通过轮询 HTTP 端点获取

### 迁移建议
- **P2 | 2-3 天**：给 MCP Gateway 添加 WebSocket 升级，广播 workflow/engine 状态变更
- 不需要完整 React dashboard——MCP 协议本身就是"API-first"的接口层
- 关键价值：实时状态推送，替代轮询

## 2. Delegate Broker

### maestro-flow 实现
- `src/async/delegate-broker.ts`：任务 broker，管理 delegate 生命周期
- `src/async/delegate-control.ts`：control plane，处理 pause/resume/cancel
- 核心模式：
  - **Broker**：中央调度器，接收 delegate 请求 → 分配 worker → 追踪状态
  - **Lifecycle**：queued → running → completed/failed/cancelled
  - **Message Injection**：支持向运行中的 delegate 注入消息（course correction）
  - **Chaining**：delegate A 完成后自动启动 delegate B（afterComplete）
- 持久化：内存 Map + 可选 JSONL 日志

### niko-studio 现状
- `WorkflowEngine` 有 7 级 workflow（Level 1-7）
- 无 delegate broker——workflow step 直接在进程内执行
- Agent system (`AgentFactory`) 是简单工厂模式，无生命周期管理

### 迁移建议
- **P1 | 3-5 天**：为 WorkflowEngine 添加 DelegateBroker
  - 每个 workflow step 包装为 delegate
  - 支持 pause/resume/cancel
  - 消息注入用于人工干预
  - 完成后链式触发下一步（替代硬编码循环）
- 代码示例：
  ```typescript
  class DelegateBroker {
    private delegates: Map<string, Delegate> = new Map();
    async submit(task: string, options: DelegateOptions): Promise<string>
    async pause(id: string): Promise<void>
    async resume(id: string): Promise<void>
    async inject(id: string, message: string): Promise<void>
    async chain(fromId: string, next: DelegateSpec): void
  }
  ```

## 3. Team Pipeline (PhaseOrchestrator)

### maestro-flow 实现
- `src/team/phase-orchestrator.ts`：phase 编排器
- Gate 模式：每个 phase 有 entry gate + exit gate
- Fix-retry：gate 检查失败 → 自动修复 → 重试（最多 N 次）
- JSONL 持久化：每个 phase 的输入/输出写入 JSONL 文件
- Phase 间数据流：前 phase 的输出 = 后 phase 的输入

### niko-studio 现状
- `workflow/levels/` 有 7 级（Level 1-7），但无 gate 检查
- WorkflowEngine 有 checkpoint 但无 fix-retry
- 状态持久化：`IWorkflowStateStore` 接口 + SQLite/InMemory 实现

### 迁移建议
- **P1 | 2-3 天**：为 workflow levels 添加 gate 检查
  - 每个 Level 的 execute 方法后自动运行 exit gate
  - Gate 失败 → fix-retry 循环（最多 3 次）
  - JSONL 追加日志记录每次 gate 检查结果
- **P0 | 1 天**：给 WorkflowEngine 添加 `_checkExitGate()` 方法
  ```typescript
  interface LevelGate {
    check(plan: WorkflowPlan): Promise<GateResult>
    fix(plan: WorkflowPlan, result: GateResult): Promise<WorkflowPlan>
  }
  ```

## 优先级汇总

| 项 | 优先级 | 工期 | 价值 |
|----|--------|------|------|
| Workflow Gate + Fix-Retry | P0 | 1 天 | 防止低质量 plan 通过 |
| Delegate Broker | P1 | 3-5 天 | workflow 生命周期管理 |
| WebSocket 状态推送 | P2 | 2-3 天 | 实时 dashboard 前置条件 |
