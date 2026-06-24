# TASK-002: GatewayDeps ISP 拆分 — 6 个角色接口 + 保留别名

## Changes
- `src-ts/mcp/endpoints/health.ts`: 重命名 5 个现有接口为 I* 前缀（IHealthEngineAccess、IServiceRegistryAccess、IRuntimeStateAccess、IObservabilityAccess、IConfigAccess），新增 IGatewayMetadata 接口，将 GatewayDeps 从 interface extends 改为 type alias（6 个接口的交集类型）
- `src-ts/mcp/gateway-state.ts`: 更新 import 从 health.ts 直接导入 GatewayDeps 类型，替换原有的 `export type GatewayDeps = Parameters<typeof setGatewayDeps>[0]` 为 `export type { GatewayDeps } from './endpoints/health'` 以维持 re-export 链
- `src-ts/mcp/index.ts`: 无需修改，re-export 链通过 gateway-state.ts 自动保留
- `src-ts/tests/mcp/health-endpoints.test.ts`: 无需修改，mock 对象形状与 GatewayDeps 别名完全一致，编译通过

## Verification
- [x] `interface IHealthEngineAccess` 存在于 health.ts 第 22 行
- [x] `interface IServiceRegistryAccess` 存在于 health.ts 第 26 行
- [x] `interface IRuntimeStateAccess` 存在于 health.ts 第 34 行
- [x] `interface IObservabilityAccess` 存在于 health.ts 第 45 行
- [x] `interface IConfigAccess` 存在于 health.ts 第 53 行
- [x] `interface IGatewayMetadata` 存在于 health.ts 第 58 行
- [x] `type GatewayDeps = ` 存在于 health.ts 第 64 行（包含 6 个接口交集）
- [x] `interface GatewayDeps` 在 health.ts 中已不存在
- [x] `export type GatewayDeps` 在 gateway-state.ts 第 24 行通过 re-export 保留
- [x] 修改的文件无 TypeScript 编译错误（`tsc --noEmit` 中 health.ts、gateway-state.ts、index.ts、health-endpoints.test.ts 均无错误）
- [x] health 测试全部通过（`vitest run tests/mcp/health-endpoints.test.ts`：5 tests passed）

## Tests
- [x] `npm run typecheck`（src-ts 目录下 `tsc --noEmit`）：修改的 4 个文件无错误；项目整体仅存在 1 个 pre-existing 错误（`container/adapters.ts:1309` IWorkflowEventRelay 缺少 broadcast 方法，与本次修改无关）
- [x] `npx vitest run tests/mcp/health-endpoints.test.ts`：5 passed

## Deviations
- 提交信息偏差：本次 TASK-002 的代码变更被捆绑进了 commit `d0eac93d`（消息为 TASK-001），原因是该提交为 harvest 批量提交。TASK-002 的变更内容（health.ts + gateway-state.ts）已正确包含在该提交中，但缺少独立的 TASK-002 提交记录。

## Notes
- GatewayDeps 别名保持 backward compatibility：所有现有消费者（包括测试 mock）无需修改即可继续工作
- 后续消费者可逐步迁移到更窄的 6 个角色接口（如仅需要 IConfigAccess + IGatewayMetadata 的组件）
- `src-ts/mcp/index.ts` 的 re-export 链完好：index.ts -> gateway-state.ts -> health.ts
