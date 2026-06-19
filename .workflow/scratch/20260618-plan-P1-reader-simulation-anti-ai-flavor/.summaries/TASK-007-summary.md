# TASK-007: 实现分析权重反馈 /reader/feedback endpoint

## Changes
- `src-ts/reader/mcp/reader-endpoints.ts`: 新增 rsFeedbackEndpoint 函数，处理 POST /reader/feedback；定义 FeedbackRequest / FeedbackAggregate / FeedbackResponse 类型；新增 feedbackAggregateStore 缓存；实现权重回写逻辑（accept>reject +0.05，reject>accept -0.05，限制在 [0,1]）；新增 getFeedbackAggregateStore / clearFeedbackAggregateStore 导出函数；clearReaderStores 现在也清除 feedback 聚合缓存
- `desktop/src/components/reader/DetailPanel.tsx`: 新增 onFeedback prop；在 SelectedItemView 的 ConsensusStrengthBar 下方新增 有用/无用 反馈按钮组；添加 React import 以支持 useState
- `desktop/src/api/reader.ts`: 新增 SubmitFeedbackParams / SubmitFeedbackResult 类型；新增 submitFeedback API 函数；更新 readerApi barrel export
- `src-ts/tests/reader/reader-feedback-endpoint.test.ts`: 新增 12 个测试覆盖验证、聚合、权重增加、权重减少、不变、边界限制、默认维度、未知维度、预设 persona 不持久化、缓存清除

## Verification
- [x] reader-endpoints.ts 中新增 rsFeedbackEndpoint 函数，处理 POST /reader/feedback：通过 12 个新测试验证
- [x] 反馈聚合缓存维护每个 persona 的 dimension 接受/拒绝计数：通过聚合测试验证（accept/reject/modify 计数正确）
- [x] DetailPanel.tsx 的 SelectedItemView 中新增 有用/无用 反馈按钮：代码审查确认按钮在 Consensus strength bar 下方

## Tests
- [x] `npm run test -- tests/reader/reader-feedback-endpoint.test.ts`: 12 passed (12) - 全部通过
- [x] `npm run test -- tests/reader/reader-endpoints.test.ts`: 10 passed (10) - 向后兼容，无破坏
- [x] TypeScript typecheck: 无关于修改文件的新类型错误

## Deviations
- None

## Notes
- 反馈阈值 FEEDBACK_THRESHOLD = 5，步长 WEIGHT_STEP = 0.05
- 预设 persona 的权重只在响应中返回，不会持久化修改；只有 custom persona 会被更新到 customPersonaStore
- DIMENSION_TO_PARAM 映射支持多种 dimension 命名格式（camelCase、Title Case、单字缩写）
- 无 dimension 参数时回退到 'general' 维度
- 权重调整仅在 accept != reject 时触发，相等时不调整
