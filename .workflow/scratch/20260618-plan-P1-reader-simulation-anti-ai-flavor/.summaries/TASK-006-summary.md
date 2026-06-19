# TASK-006: 实现 A/B 测试 compare endpoint

## Changes
- `src-ts/reader/ConsensusEngine.ts`: 新增 `ConsensusComparisonItem` 接口（含 dimension, versionAScore, versionBScore, delta, winner, notes 字段）；新增 `compareConsensus(reportA, reportB)` 方法，逐维度对比 avgScore，计算 delta，标记 winner（'A'|'B'|'tie'），按 delta 绝对值降序排序
- `src-ts/reader/mcp/reader-endpoints.ts`: 新增 `CompareRequest` / `CompareResult` / `CompareVersionInput` 接口；新增 `rsCompareEndpoint` 函数处理 POST /reader/compare，流程：解析请求 -> resolvePersonas -> analyze A/B 并发 -> buildConsensus A/B -> compareConsensus -> 返回包含 versionAConsensus, versionBConsensus, comparison, overallWinner
- `src-ts/reader/mcp/index.ts`: 导出 `rsCompareEndpoint` 和 CompareRequest/CompareResult/CompareVersionInput 类型；修复预存在的 `OverlayRequest` 错误导出（该类型不存在于 reader-endpoints.ts）
- `src-ts/tests/reader/reader-compare-endpoint.test.ts`: 新增 7 个测试，覆盖请求体验证、正常 A/B 对比、维度结构检查、winner 判定、自定义 persona 支持、缺失 persona 错误处理

## Verification
- [x] reader-endpoints.ts 中新增 rsCompareEndpoint 函数，处理 POST /reader/compare：grep 确认存在，测试验证 7 个用例全部通过
- [x] 返回结果包含 versionAConsensus, versionBConsensus, comparison 三个字段：测试断言验证，jsonResponse 中显式包含这三个字段
- [x] comparison 中每个差异项包含 dimension, versionAScore, versionBScore, delta, winner: 'A'|'B'|'tie'：ConsensusComparisonItem 接口定义 + 测试循环断言每个 item 都有这些字段

## Tests
- [x] `npx vitest run tests/reader/reader-compare-endpoint.test.ts`: 7 passed (68ms)
- [x] `npx vitest run tests/reader/consensus-engine.test.ts`: 2 passed (2ms)
- [x] `npx vitest run tests/reader/reader-endpoints.test.ts`: 10 passed (7ms)
- [x] 合计 19/19 测试通过，0 个新引入的失败

## Deviations
- 移除了 index.ts 中预存在的 `OverlayRequest` 类型导出（该类型在 reader-endpoints.ts 中不存在，是之前代码遗留的错误导出）。这是一个修复而非偏差。
- TypeScript 全项目编译存在多个预存在错误（downlevelIteration、empty text never 类型等），均非本任务引入。

## Notes
- compareConsensus 方法使用 `dimensionSummaries` 中的 `avgScore` 进行维度对比，而非 `consensus` 值。这是合理的，因为 avgScore 反映质量水平，而 consensus 反映角色间一致性。
- overallWinner 基于 comparison 中各维度 winner 的多数投票决定（A 赢次数 > B 赢次数 -> A，反之 -> B，相等 -> tie）。
- 两个版本的分析（DualEngine.analyze）是并发执行的（Promise.all），提高效率。
- 下一个任务如需在前端调用此 endpoint，请求格式为：POST /reader/compare，body: { novelId, versionA: { text, label? }, versionB: { text, label? }, personaIds? }
