# TASK-003: 提取 craft-types.ts 打破 craft-catalog ↔ catalog-loader 类型循环

## Changes
- `src-ts/narrative/writing-craft/craft-types.ts`: 新建文件，包含从 craft-catalog.ts 提取的所有 enum 和 interface 定义（共 18 个 enum + 对应 interface，以及 ForeshadowHierarchyData、ForeshadowRecoveryMethodsData、DialogueRulesData、StoryStructureData、StoryStructureBeat、WebNovelPsychologyData 等数据类型）
- `src-ts/narrative/writing-craft/craft-catalog.ts`: 移除所有 enum 和 interface 定义，添加 `export * from './craft-types'` 以保持外部兼容，保留运行时 const 导出和 getter 调用
- `src-ts/narrative/writing-craft/catalog-loader.ts`: 将类型导入从 `./craft-catalog` 改为 `./craft-types`，合并为单一 import 语句
- `src-ts/narrative/writing-craft/index.ts`: barrel export 新增 `export * from './craft-types'`

## Verification
- [x] craft-types.ts 包含 enum 定义（grep `export enum` 返回非空，包含 SuspenseSubgenre 等）
- [x] catalog-loader.ts 不再从 craft-catalog import 任何类型（grep `from.*craft-catalog` 返回空）
- [x] catalog-loader.ts 从 craft-types import 类型（grep `from.*craft-types` 返回非空）
- [x] index.ts 导出 craft-types（grep `export * from.*craft-types` 返回非空）
- [x] craft-catalog.ts 通过 re-export 保持兼容（grep `export * from.*craft-types` 返回非空）
- [x] craft-catalog.ts 不再定义 enum（grep `export enum` 返回空）
- [x] `npm run typecheck` 通过（tsc --noEmit 无错误）
- [x] `vitest run tests/narrative/writing-craft.test.ts` 36 tests 全部通过
- [x] `vitest run tests/narrative/craft-catalog-m15.test.ts` 16 tests 全部通过

## Tests
- [x] typecheck: 通过
- [x] writing-craft.test.ts: 36 passed
- [x] craft-catalog-m15.test.ts: 16 passed

## Deviations
- None

## Notes
- 循环依赖已消除：craft-catalog.ts 只从 catalog-loader.ts import 运行时函数，catalog-loader.ts 只从 craft-types.ts import 类型定义
- craft-catalog.ts 通过 `export * from './craft-types'` 保持外部 API 完全兼容，消费者无需修改 import 路径
- 所有类型导入均使用 `import type` 以避免运行时循环
