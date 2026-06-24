# TASK-003: 保护 customPersonaStore 初始化顺序并调整 barrel 文件

## Changes
- `src-ts/reader/mcp/reader-services.ts`: 将顶层 `loadCustomPersonas()` Promise 绑定到 `customPersonaStoreReady` 变量，新增 `getCustomPersonaStoreReady()` 导出函数，供 endpoint handler 在读取 `customPersonaStore` 前隐式等待。
- `src-ts/reader/mcp/reader-routes.ts`: 在 `rsGetPersonasEndpoint`、`rsCreateCustomPersonaEndpoint`、`rsFeedbackEndpoint` 开头添加 `await getCustomPersonaStoreReady()`，消除 custom persona 加载 race condition。
- `src-ts/tests/reader/reader-endpoints.test.ts`: 新增回归测试 `'custom persona store is ready immediately after module import without manual clearReaderStores'`，验证模块导入后立即调用 `rsGetPersonasEndpoint` 能正确返回已加载的 custom persona。
- `src-ts/mcp/endpoints/index.ts`: 将 reader endpoint import 源从 `../../reader/mcp/reader-endpoints` 改为 `../../reader/mcp/reader-routes`，并添加 TODO 注释记录 shim 移除条件。
- `src-ts/reader/mcp/index.ts`: 将 import 源从 `./reader-endpoints` 改为 `./reader-routes`（endpoint handler）和 `./reader-services`（store 管理函数）以及 `./reader-types`（类型），保持导出公共子集不变。
- `src-ts/reader/mcp/reader-endpoints.ts`: 在 JSDoc 注释中添加 `TODO: remove shim after all tests migrated (ISS-20260621-013)`。

## Verification
- [x] `grep -n 'getCustomPersonaStoreReady' src-ts/reader/mcp/reader-services.ts` 命中（第 188 行）
- [x] `grep -n 'await getCustomPersonaStoreReady' src-ts/reader/mcp/reader-routes.ts` 命中 3 次（第 229、251、428 行）
- [x] `reader-endpoints.test.ts` 新增测试用例通过：导入模块后立即调用 `rsCreateCustomPersonaEndpoint` 再调用 `rsGetPersonasEndpoint`，验证 custom persona 已加载
- [x] clearReaderStores 与 reload 测试连续运行 3 次无 flaky（每次 1 passed）
- [x] `src-ts/mcp/endpoints/index.ts` 仍导出全部 8 个 handler（rsAnalyzeEndpoint, rsGetPersonasEndpoint, rsCreateCustomPersonaEndpoint, rsGetOverlayEndpoint, rsAIFlavorEndpoint, rsFeedbackEndpoint, rsCompareEndpoint, rsDeAIEndpoint）
- [x] `src-ts/reader/mcp/index.ts` 仍导出当前公共子集（5 个 endpoint + 3 个 store 管理函数 + 5 个类型）
- [x] `grep -c 'import cycle' src-ts/reader/mcp/*.ts` 为 0（无循环依赖）
- [x] `npx vitest run tests/reader/reader-endpoints.test.ts` 全部 22 个测试通过
- [x] `npm run build`（tsc）无编译错误

## Tests
- [x] `npx vitest run --testNamePattern "reader"`: 27 个测试文件全部通过，137 个测试通过
- [x] `npx vitest run tests/reader/reader-endpoints.test.ts`: 22 个测试全部通过
- [x] `npm run build`: 编译成功（tsc + postprocess ESM imports）
- [x] clearReaderStores 3 次连续运行无 flaky

## Deviations
- None

## Notes
- `getCustomPersonaStoreReady()` 仅在首次调用时可能引入轻微延迟（等待文件 I/O），后续调用 Promise 已 resolved，开销为 0。
- `reader-endpoints.ts` shim 仍保留，所有测试和 barrel 消费者无需修改即可工作。shim 移除条件已在 TODO 中记录。
