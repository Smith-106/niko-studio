# TASK-001: Container↔MCP 启动路径解耦 + IWorkflowEventRelay 接口抽象

## Changes
- `src-ts/mcp/gateway-bootstrap.ts`: 将 import 路径从 `../container/gateway-control-plane` 改为 `../composition-root/gateway-control-plane`，消除 mcp 层对 container 层的直接依赖。
- `src-ts/container/types.ts`: 新增 `export interface IWorkflowEventRelay`，包含 `initialize(server)`、`broadcast(event)` 和 `close()` 方法签名，与 `WorkflowEventRelay` 公有方法一致。
- `src-ts/container/adapters.ts`: 
  - 将 `import { WorkflowEventRelay } from '../mcp/gateway-ws'` 替换为 `import type { IWorkflowEventRelay } from './types'`。
  - 将 `WebSocketRelayServiceAdapter` 中的 `WorkflowEventRelay` 类型引用替换为 `IWorkflowEventRelay`。
  - 在 `initialize()` 方法中使用 `require('../mcp/gateway-ws')` 动态 import 保留运行时构造能力，消除静态跨层依赖。

## Verification
- [x] `grep -n 'from.*container/gateway-control-plane' src-ts/mcp/gateway-bootstrap.ts` 返回空（无匹配）
- [x] `grep -n 'from.*composition-root/gateway-control-plane' src-ts/mcp/gateway-bootstrap.ts` 返回非空（第 3 行）
- [x] `grep -n 'IWorkflowEventRelay' src-ts/container/types.ts` 返回非空（第 581 行）
- [x] `grep -n 'from.*mcp/gateway-ws' src-ts/container/adapters.ts` 返回空（无静态 import）
- [x] `npm run typecheck` 通过（tsc --noEmit 无错误）
- [x] `npx vitest run tests/mcp/gateway-state.test.ts tests/mcp/health-endpoints.test.ts tests/container/gateway-control-plane.test.ts` 全部通过（26 tests passed）

## Tests
- [x] `npm run typecheck`: 通过
- [x] `tests/mcp/gateway-state.test.ts`: 18 tests passed
- [x] `tests/mcp/health-endpoints.test.ts`: 5 tests passed
- [x] `tests/container/gateway-control-plane.test.ts`: 3 tests passed

## Deviations
- 任务原始要求 `IWorkflowEventRelay` 只包含 `initialize(server)` 和 `close()`，但编译时发现 `adapters.ts` 中 `WebSocketRelayServiceAdapter.broadcast()` 调用了 `this.relay.broadcast(...)`，因此必须将 `broadcast` 方法也加入接口。使用内联结构类型而非引用 `WorkflowEvent` 类型，避免 container/types.ts 对 mcp/gateway-ws.ts 的依赖。
- `adapters.ts` 中保留了 `require('../mcp/gateway-ws')` 动态 import 用于运行时构造 `WorkflowEventRelay`，这是消除静态依赖同时保留运行时行为的必要手段。

## Notes
- `engine.ts` 不在本次 task 范围内，其 `getContainer()` 调用需后续专门 task 处理。
- 动态 import 使用 `require()` 而非 `await import()`，因为 `initialize()` 是同步方法，无法使用 await。
- 额外修复：`tests/mcp/gateway-bootstrap.additional.test.ts` 与 `tests/mcp/gateway-bootstrap.test.ts` 中的 mock 路径从 `container/gateway-control-plane` 更新为 `composition-root/gateway-control-plane`，并为 server mock 补全 `on` 方法，使测试与新的 import 路径保持一致。
