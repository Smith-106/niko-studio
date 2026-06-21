# TASK-004: 实现反 AI 味检测器与 /reader/ai-flavor endpoint

## Changes
- `src-ts/reader/ai-flavor-detector.ts` (新建): 实现规则层 AI 味检测器，覆盖 5 种子类型
  - `template_expression`: 检测中文/英文 AI 模板化表达（如"值得注意的是""in conclusion"等 60+ 个模式）
  - `style_drift`: 检测段落长度过于均匀、句式开头重复率高
  - `sensory_gap`: 检测感官覆盖不足（视觉占比过高，其他感官缺失）
  - `repetitive_structure`: 检测重复短语结构
  - `generic_transition`: 检测通用过渡词密度过高
  - 导出 `detectAIFlavor(text)` 和 `createAIFlavorDetector()` 工厂函数
- `src-ts/reader/DualEngine.ts` (修改): 
  - `EditorialAnalysis` 接口新增可选 `aiFlavor?: AIFlavorResult` 字段
  - `runEditorEngine` 中在返回前非阻塞调用 `detectAIFlavor`，不影响现有分析逻辑
- `src-ts/reader/mcp/reader-endpoints.ts` (修改):
  - 新增 `rsAIFlavorEndpoint` 处理 POST `/reader/ai-flavor`
  - 接收 `{ novelId, text? }`，返回 `{ score, indicators, confidence, evidence, suggestions }`
- `src-ts/reader/index.ts` (修改): 导出 `AIFlavorIndicator`、`AIFlavorResult`、`detectAIFlavor`、`createAIFlavorDetector`
- `src-ts/tests/reader/ai-flavor-detector.test.ts` (新建): 12 个测试用例

## Verification
- [x] `src-ts/reader/ai-flavor-detector.ts` 存在且导出 `detectAIFlavor` 函数
- [x] `detectAIFlavor` 返回的对象包含 `aiFlavorScore`(0-1)、`indicators`(数组,长度>=3)、`confidence`(0-1)、`evidence`(数组)、`suggestions`(数组)
- [x] `DualEngine.runEditorEngine` 返回的 `EditorialAnalysis` 包含 `aiFlavor` 字段（可选）
- [x] `reader-endpoints.ts` 中新增 `rsAIFlavorEndpoint` 函数，处理 POST `/reader/ai-flavor`
- [x] 未扩展 `QualityDimension` 枚举
- [x] DualEngine 可选调用 detector，不影响现有分析逻辑

## Tests
- [x] `ai-flavor-detector.test.ts`: 12 tests passed
  - 空文本返回零值结果
  - 中文 AI 模板检测（score > 0.4）
  - 英文 AI 模板检测（score > 0.5）
  - 自然文本返回低 score（< 0.3）
  - 风格漂移检测（均匀段落）
  - 感官覆盖不足检测
  - 建议生成
  - 置信度随文本长度增加
  - 工厂函数工作正常
  - 结果字段完整性
  - 重度 AI 模式文本返回 >=3 个 indicators
- [x] `reader-endpoints.test.ts`: 10 tests passed
- [x] `dual-engine.additional.test.ts`: 1 test passed

## Deviations
- 2 个 pre-existing 测试失败（`reader-endpoints.branch-gap.additional.test.ts` 中的 persona factory mock 测试），与本次修改无关，执行前已存在
- 任务描述中 `action` 字段要求返回 `{ score, indicators, suggestions }`，实际实现按 `AIFlavorResult` 接口返回 `{ score, indicators, confidence, evidence, suggestions }`，更全面

## Notes
- AI 味检测器为纯规则层实现，无需 LLM 调用，性能开销极低
- `aiFlavor` 字段在 `EditorialAnalysis` 中为可选字段（`aiFlavor?`），保持向后兼容
- 检测器对中文和英文文本均有效，模板词库包含 60+ 中文模式和 40+ 英文模式
- 后续可在规则层之上叠加 LLM 增强层，形成"规则+LLM"双层架构
