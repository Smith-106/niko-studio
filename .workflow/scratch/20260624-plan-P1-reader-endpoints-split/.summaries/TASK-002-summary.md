# TASK-002: 拆分 reader-endpoints.ts 为 4 子模块并保留兼容性 shim

## Changes

- `src-ts/reader/mcp/reader-types.ts` (new): 提取所有类型定义 — AnalyzeRequest, CreatePersonaRequest, DeAIRequest, DeAIResponse, FeedbackRequest, FeedbackResponse, FeedbackAggregate, CompareRequest, CompareResult, CompareVersionInput, OverlayMarker, FeedbackAction，以及 ConsensusReport / ConsensusComparisonItem 的 re-export
- `src-ts/reader/mcp/reader-services.ts` (new): 提取 singleton getter（getRevisionService, getConsensusEngine, getDualEngine, getDimensionAnalyzer）、in-memory store（customPersonaStore, analysisResultCache, feedbackAggregateStore）、文件持久化（loadCustomPersonas, saveCustomPersonas, deletePersonasFile）、store 管理（clearReaderStores, getCustomPersonaStore, getAnalysisResultCache, getFeedbackAggregateStore, clearFeedbackAggregateStore）
- `src-ts/reader/mcp/reader-validation.ts` (new): 提取 resolvePersonas, buildOverlayMarkers, adjustPersonaWeights, extractCurrentWeights, DIMENSION_TO_PARAM
- `src-ts/reader/mcp/reader-routes.ts` (new): 提取 8 个 endpoint handler — rsAnalyzeEndpoint, rsGetPersonasEndpoint, rsCreateCustomPersonaEndpoint, rsGetOverlayEndpoint, rsAIFlavorEndpoint, rsFeedbackEndpoint, rsCompareEndpoint, rsDeAIEndpoint
- `src-ts/reader/mcp/reader-endpoints.ts` (modified): 删除全部实现代码，改为纯 re-export shim，从 reader-routes / reader-types / reader-services / reader-validation 重新导出所有公共 API

## Verification

- [x] reader-types.ts 存在且包含 export interface AnalyzeRequest: grep 命中第 16 行
- [x] reader-services.ts 存在且包含 export function getDualEngine: grep 命中第 155 行
- [x] reader-validation.ts 存在且包含 export const DIMENSION_TO_PARAM: grep 命中第 25 行
- [x] reader-routes.ts 存在且包含 export async function rsAnalyzeEndpoint: grep 命中第 77 行
- [x] reader-endpoints.ts 不包含 async function 实现体: grep -c 'async function' = 0
- [x] grep "from './reader-routes'" reader-endpoints.ts 命中（1 次）
- [x] grep "from './reader-types'" reader-endpoints.ts 命中（1 次）
- [x] grep "from './reader-services'" reader-endpoints.ts 命中（1 次）
- [x] grep "from './reader-validation'" reader-endpoints.ts 命中（1 次）
- [x] npm test -- --grep 'reader' 全部通过: 20 个测试文件全部通过，122 个测试通过
- [x] tsc 无编译错误: `cd src-ts && npm run build` 通过，`npx tsc --noEmit` 无输出（无错误）

## Tests

- [x] `npm run build` (src-ts): 通过，tsc 编译 + postprocess ESM imports 成功
- [x] `npx vitest run tests/reader/`: 20 个测试文件全部通过（122 tests passed）
- [x] `npx vitest run tests/reader/reader-endpoints.test.ts`: 21 个测试全部通过
- [x] Import cycle 检查: 无循环依赖（reader-types → none; reader-services → reader-types; reader-validation → reader-types + reader-services; reader-routes → reader-types + reader-services + reader-validation）

## Deviations

- None

## Notes

- 所有现有测试和 barrel 文件无需修改即可通过，shim 完全保持 backward compatibility
- reader-endpoints.ts 现在只有 re-export 语句，没有 async function 实现体
- 模块顶层 loadCustomPersonas() 调用保留在 reader-services.ts 中，ready 语义未丢失
- 所有 5 个 consumer 文件（2 个 barrel + 3 个测试文件）通过 shim 继续正常工作
