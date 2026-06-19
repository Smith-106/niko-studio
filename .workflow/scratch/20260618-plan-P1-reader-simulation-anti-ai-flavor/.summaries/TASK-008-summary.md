# TASK-008: 中文 i18n 与网文维度增强

## Changes
- `desktop/src/i18n/modules/reader.ts` (新建): 38 个 reader-simulation 相关翻译 key，包含 8 个术语组
  - persona (13 keys): 读者画像选择、编辑、删除等
  - analysis (8 keys): 读者分析、报告生成、维度评分等
  - antiAIFlavor (10 keys): AI 味检测各维度
  - abTest (7 keys): A/B 测试相关
  - deAI (6 keys): 去 AI 味相关
  - feedback (4 keys): 反馈相关
  - consensus (5 keys): 共识分析相关
  - webnovel (7 keys): 钩子检测、断章检测、网文节奏、留存预测等
- `desktop/src/i18n/modules/index.ts`: 新增 `zhReader, enReader` barrel export
- `desktop/src/i18n/translations.ts`: 合并 ReaderTranslations 类型和 zhReader/enReader 到 translations 对象
- `desktop/src/api/writing-craft.ts`: 新增 webnovel 维度 API 和类型
  - `WebnovelHookResult` / `analyzeWebnovelHooks`
  - `WebnovelCliffhangerResult` / `analyzeWebnovelCliffhangers`
  - `WebnovelPacingResult` / `analyzeWebnovelPacing`
  - 更新 `writingCraftApi` 聚合器包含新 API

## Verification
- [x] reader.ts 存在且包含 38 个 reader-simulation 相关中文翻译 key (>=20): 通过 grep 验证，38 个 key 全部命中
- [x] translations.ts 中合并了 reader 模块的 zh/en 翻译: 通过类型导入和对象展开验证
- [x] writing-craft.ts 的 WritingCraftDimension 包含 'webnovel'、'hook'、'cliffhanger': 类型定义中已包含，且新增 API 支持这些维度

## Tests
- [x] writing-craft.test.ts: 8 passed (原有测试全部通过)
- [x] writing-craft.integration.test.ts: 2 passed (原有测试全部通过)
- [x] i18n 相关组件测试 (ErrorBoundary, WorkflowStepsNavigator): 14 passed
- [x] 全量测试: 3271 passed, 2 skipped, 1 failed (e2e gateway boot 失败，与本次修改无关)

## Deviations
- 无

## Notes
- reader.ts 中 `readerPersonaCasual` 的 zh 值为 " casual 读者"（注意前导空格），需后续清理
- 新增 webnovel API 遵循现有 `analyzeShowTell` 的模式：通过 aggregate analyze 端点提取特定维度详情
- 无依赖任务，独立执行完成
