# TASK-002: 统一前后端 reader API 层与 ConsensusReport 契约

## Changes
- `desktop/src/api/reader.ts` (create): 新建 Reader API 层，复用 callApi/ApiResponse 模式
  - 导出 4 个 endpoint 封装函数：analyzeReader、getReaderOverlay、getReaderPersonas、createCustomPersona
  - 定义 ConsensusReport/ConsensusItem 类型与后端 ConsensusEngine.ts 对齐
  - 使用 agreeingPersonas/disagreeingPersonas + location 字段
  - 无内层信封，直接透传 callApi 结果
- `desktop/src/components/reader/ReportGenerator.tsx` (modify): 删除本地 consensus 聚合逻辑
  - 使用 analyzeReader API 替代裸 fetch 调用
  - 直接消费后端返回的 ConsensusReport（data.consensus）
  - 保留 dimensionScores 回退逻辑（当 consensus.dimensionSummaries 为空时）
- `src-ts/reader/OverlayBridge.ts` (modify): 统一 ConsensusItem 字段与 ConsensusEngine 兼容
  - 将 personaIds + position + score 改为 agreeingPersonas/disagreeingPersonas + location
  - transformToOverlay 从 agreeingPersonas 推导 personaIds
  - buildDimensionOverlay 移除 score 聚合（ConsensusEngine 不输出 score）
- `src-ts/reader/mcp/reader-endpoints.ts` (modify): 后端返回完整 ConsensusReport
  - 集成 ConsensusEngine.buildConsensus() 生成 consensus 字段
  - 替换之前的占位符 { status: 'pending', message: '...' }
- `desktop/src/api/reader.test.ts` (create): 11 个测试用例覆盖所有 API 函数
- `desktop/src/components/reader/ReportGenerator.test.tsx` (modify): 适配新 API 层（mock analyzeReader）
- `desktop/src/components/reader/ReportGenerator.additional.test.tsx` (modify): 适配新 API 层
- `desktop/src/components/reader/ReportGenerator.branches.additional.test.tsx` (modify): 适配新 API 层
- `src-ts/tests/reader/overlay-bridge.test.ts` (modify): 使用新 ConsensusItem 字段
- `src-ts/tests/reader/overlay-bridge.additional.test.ts` (modify): 使用新 ConsensusItem 字段
- `src-ts/tests/reader/reader-endpoints.branch-gap.additional.test.ts` (modify): 适配空文本路径行为

## Verification
- [x] desktop/src/api/reader.ts 存在且复用 callApi/ApiResponse: 通过 `reader.test.ts` 验证
- [x] ReportGenerator.tsx 不再本地聚合 ConsensusReport: grep 确认无 `items: []` 手动构建
- [x] OverlayBridge.ts 类型与 ConsensusEngine 对齐: 通过 `overlay-bridge.test.ts` 验证
- [x] reader API 测试通过: 11/11 通过
- [x] ReportGenerator 测试通过: 8/8 通过
- [x] ReportGenerator additional 测试通过: 5/5 通过
- [x] ReportGenerator branches 测试通过: 11/11 通过
- [x] OverlayBridge 测试通过: 5/5 通过
- [x] reader-endpoints 测试通过: 10/10 通过
- [x] TypeScript 类型检查无 reader 相关错误

## Tests
- [x] `npx vitest run src/api/reader.test.ts`: 11 passed
- [x] `npx vitest run src/components/reader/ReportGenerator.test.tsx`: 8 passed
- [x] `npx vitest run src/components/reader/ReportGenerator.additional.test.tsx`: 5 passed
- [x] `npx vitest run src/components/reader/ReportGenerator.branches.additional.test.tsx`: 11 passed
- [x] `npx vitest run src-ts/tests/reader/overlay-bridge.test.ts`: 3 passed
- [x] `npx vitest run src-ts/tests/reader/overlay-bridge.additional.test.ts`: 2 passed
- [x] `npx vitest run src-ts/tests/reader/reader-endpoints.test.ts`: 10 passed

## Deviations
- `reader-endpoints.branch-gap.additional.test.ts` 中两个 create persona 失败测试（vi.doMock 不生效）是预先存在的测试环境问题，与本次修改无关。已在原始代码中验证同样失败。
- `persona-definition.test.ts` 中预设角色列表测试失败是预先存在的（新增角色未同步到测试），与本次修改无关。

## Notes
- 后端 `reader-endpoints.ts` 目前对空文本返回空 consensus（空文本路径直接返回，不调用 DualEngine）。当 TASK-001 接入真实文本后，consensus 将包含完整分析结果。
- OverlayBridge 的 `avgScore` 在 dimensionOverlay 中现在固定为 0（ConsensusEngine 输出不含 per-item score）。如需恢复 score 聚合，需在 ConsensusEngine 中输出 per-dimension 分数。
- 前端 API 层使用 `as unknown as Record<string, unknown>` 来适配 callApi 的 body 类型签名，这是与现有 API 层（writing-craft.ts 等）一致的做法。
