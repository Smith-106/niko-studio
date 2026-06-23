# TASK-001: 扩展共享输入校验并补齐 Reader 剩余字段校验

## Changes
- `src-ts/mcp/input-validation.ts`: 新增 7 个 MAX_* 常量（MAX_PERSONA_ID_LENGTH=256, MAX_FEEDBACK_ID_LENGTH=256, MAX_DIMENSION_LENGTH=100, MAX_TARGET_STYLE_LENGTH=200, MAX_LABEL_LENGTH=200, MAX_ARRAY_LENGTH=64, MAX_ARRAY_ITEM_LENGTH=200）；新增 `validateStringArray(items, opts)` 函数（检查 Array.isArray、长度上限、每项为 string、每项长度上限）；新增 `validateEnum(value, allowedSet, label)` 函数（检查值在允许集合中）。
- `src-ts/reader/mcp/reader-endpoints.ts`: rsAnalyze 中 personaIds 循环内添加 `validateStringLength(id, MAX_PERSONA_ID_LENGTH, 'personaId')`；rsFeedback 中 feedbackId 改为 `MAX_FEEDBACK_ID_LENGTH` 校验、dimension 添加 `MAX_DIMENSION_LENGTH` 校验；rsCompare 中 versionA.label / versionB.label 添加 `MAX_LABEL_LENGTH` 校验、personaIds 元素添加 `MAX_PERSONA_ID_LENGTH` 校验；rsCreateCustomPersona 中 focusAreas / biases 改为使用 `validateStringArray` 校验（替代原先仅检查 Array.isArray 的弱校验）；rsDeAI 中 targetStyle 添加 `MAX_TARGET_STYLE_LENGTH` 校验。

## Verification
- [x] grep -n 'MAX_PERSONA_ID_LENGTH' src-ts/mcp/input-validation.ts 命中定义（line 31）
- [x] grep -n 'validateStringArray' src-ts/mcp/input-validation.ts 命中函数签名（line 209）
- [x] grep -n 'validateEnum' src-ts/mcp/input-validation.ts 命中函数签名（line 251）
- [x] grep -n 'MAX_FEEDBACK_ID_LENGTH' src-ts/reader/mcp/reader-endpoints.ts 命中 feedbackId 校验行（line 773）
- [x] grep -n 'MAX_DIMENSION_LENGTH' src-ts/reader/mcp/reader-endpoints.ts 命中 dimension 校验行（line 789）
- [x] grep -n 'MAX_TARGET_STYLE_LENGTH' src-ts/reader/mcp/reader-endpoints.ts 命中 targetStyle 校验行（line 1087）
- [x] grep -n 'MAX_LABEL_LENGTH' src-ts/reader/mcp/reader-endpoints.ts 命中 versionA.label / versionB.label 校验行（lines 973, 979）
- [x] grep -n 'validateStringArray' src-ts/reader/mcp/reader-endpoints.ts 命中 focusAreas / biases 校验调用（line 584）
- [x] npm test（vitest run -t "reader"）: 27 测试文件通过，136 测试通过，0 失败
- [x] npm run build: tsc 无错误，postprocess 成功（214 文件）

## Tests
- [x] `npm test -- --grep 'reader'`（实际使用 `vitest run -t "reader"`）: 全部通过（27 passed, 0 failed）
- [x] `npm run build`: 通过（tsc + postprocess_esm_imports.cjs）

## Deviations
- None

## Notes
- validateEnum 函数已添加但当前 Reader 端点中 action 校验仍使用内联数组检查（`['helpful', 'not_helpful', 'ignore'].includes(action)`）。后续 TASK 可考虑统一替换为 validateEnum，但当前保持向后兼容、不改动已有测试路径。
- rsCreateCustomPersona 中 focusAreas / biases 的校验从仅检查 Array.isArray 升级为 validateStringArray（同时检查类型、数组长度、元素类型、元素长度），这是更严格的校验，但测试用例中使用的值均满足新约束，因此无回归。
