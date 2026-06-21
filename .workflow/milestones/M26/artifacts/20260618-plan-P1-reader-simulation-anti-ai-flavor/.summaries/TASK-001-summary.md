# TASK-001: 修复 /reader/analyze 空文本 TODO

## Changes
- `src-ts/reader/mcp/reader-endpoints.ts`: 在 `rsAnalyzeEndpoint` 中添加空文本处理路径，当 `manuscriptText` 为空时返回结构完整的空 ConsensusReport（HTTP 200），包含空的 readerReactions、editorialAnalysis、consensus 对象和维度分数为 0 的 dimensionScores。同时缓存空的 DualEngineResult 以支持 overlay endpoint。
- `src-ts/tests/reader/reader-endpoints.test.ts`: 新增空文本测试用例，验证空文本返回 200 + 空报告结构；更新现有测试以匹配空文本行为（preset personas 数量从 3 更新为 7）。

## Verification
- [x] rsAnalyzeEndpoint 对空 text 不再抛出 TODO 错误：代码中从未抛出 TODO 错误，现在空文本返回 200 空报告
- [x] 空 text 返回 200 与结构完整的 ConsensusReport：测试 `returns empty consensus report for empty manuscript text` 验证通过
- [x] reader-endpoints 测试通过：10/10 测试全部通过

## Tests
- [x] `npx vitest run src-ts/tests/reader/reader-endpoints.test.ts`: 10 passed (10)

## Deviations
- 任务 JSON 原始描述要求接入 workspace/manuscript 服务读取真实文本，但用户执行指令明确要求"将空文本 TODO 替换为合理的空输入处理：返回空的 ConsensusReport"。按照用户直接指令执行，保留 TODO 注释作为未来接入真实数据的标记。
- 现有测试中原先期望非空文本分析结果（3 个 readerReactions），由于当前 manuscriptText 始终为空字符串，这些测试已更新为期望空报告行为。
- preset personas 数量从 3 变为 7（代码库中已有变化），相应更新了测试断言。

## Notes
- 空文本路径中缓存了空的 DualEngineResult，确保 overlay endpoint 在空文本分析后仍能正常工作。
- 非空文本的 DualEngine 分析流程完全保留，未来接入真实 manuscript 服务时只需替换 `manuscriptText = ''` 即可。
