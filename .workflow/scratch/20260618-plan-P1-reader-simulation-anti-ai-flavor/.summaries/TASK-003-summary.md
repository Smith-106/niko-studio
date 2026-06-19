# TASK-003: 扩展 PersonaDefinition 与 PersonaSelector

## Changes
- `src-ts/reader/PersonaDefinition.ts`: 扩展 `ReaderPersona.parameters` 接口，新增 5 个可选字段（ageGroup, culturalBackground, readingPreference, genrePreference, aiFlavorSensitivity）。新增 4 个 preset 工厂函数：`createPacingHawk`, `createAntiAIFlavorCritic`, `createYoungAdultReader`, `createWebNovelVeteran`。注册到 `PRESET_PERSONAS` 注册表（共 7 个 preset）。
- `src-ts/reader/PersonaDefinition.test.ts` (新建): 14 个测试断言，覆盖 preset 注册、各预设权重验证、新字段存在性、custom factory 合并逻辑。
- `desktop/src/components/reader/PersonaSelector.tsx`: 同步新增 4 个 preset 卡片（节奏猎手/反 AI 味评论家/青春文学读者/网文老读者），扩展 `Persona` 接口，新增 `CustomPersonaModal` 表单字段（AI 味敏感度滑块 + 4 个下拉选择框）。
- `desktop/src/components/reader/PersonaSelector.test.tsx`: 新增 1 个测试用例验证扩展字段在自定义画像 modal 中的可用性。

## Verification
- [x] PRESET_PERSONAS 中至少包含 7 个 preset（原有 3 个 + 新增 4 个）：通过 `listPresetPersonas()` 验证返回 7 个 ID
- [x] ReaderPersona.parameters 包含 ageGroup, culturalBackground, readingPreference, genrePreference, aiFlavorSensitivity 字段：接口定义 + 4 个新 preset 均填充了这些字段
- [x] PersonaSelector.tsx 中 PRESET_PERSONAS 数组同步新增 4 个 preset 卡片，且 CustomPersonaModal 支持新字段配置：测试通过，UI 新增 4 个卡片 + AI 味敏感度滑块 + 4 个下拉选择框
- [x] 相关测试通过：
  - `PersonaDefinition.test.ts`: 14 passed
  - `PersonaSelector.test.tsx`: 3 passed

## Tests
- [x] `npx vitest run src-ts/reader/PersonaDefinition.test.ts`: 14 passed (200ms)
- [x] `npx vitest run src/components/reader/PersonaSelector.test.tsx`: 3 passed (1.57s)

## Deviations
- None

## Notes
- 新 preset 的 9 维度权重已按任务要求覆盖 webnovel/传统文学/悬疑/青春文学偏好
- 前端 `Persona` 接口与后端 `ReaderPersona` 保持字段对齐（新增字段均为可选）
- 原有 3 个 preset 保持向后兼容，未修改其权重和字段
- `reader-endpoints.ts` 中 `rsCreateCustomPersonaEndpoint` 对新字段的验证可后续增强（当前通过 `createCustomPersona` 的深合并自动处理）
