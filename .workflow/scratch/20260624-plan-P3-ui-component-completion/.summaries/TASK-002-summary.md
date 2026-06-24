# TASK-002: PlotTemplateService 扩展 + template:apply 事件消费

## Changes
- `desktop/src/services/plotTemplateService.ts` (新建): 4 个 plot 分类内置模板
  - `threeActOutline` (三幕结构大纲)
  - `heroJourneyOutline` (英雄之旅大纲)
  - `mysteryClueWeb` (悬疑线索网)
  - `conflictEscalation` (冲突升级表)
- `desktop/src/types/template.ts`: `TemplateCategory` 联合类型添加 `'plot'`
- `desktop/src/services/templateService.ts`: `listTemplates` 函数合并 `PLOT_BUILTINS`（当 category 为 `'plot'` 或 `undefined` 时）
- `desktop/src/components/TemplateManagerPanel.tsx`: `CATEGORY_FILTERS` 添加 `'plot'`；`categoryLabel` 添加 plot 映射；category badge 添加 emerald 配色
- `desktop/src/components/TemplateBrowserPanel.tsx`: `CATEGORY_LABELS` 添加 `'plot'`；filter buttons 同步添加
- `desktop/src/components/DocumentEditor.tsx`: 添加 `useEffect` 监听 `template:apply` CustomEvent，通过 `getEditorHandle()?.insertContent()` 插入模板内容
- `desktop/src/utils/editorHandle.ts`: `EditorHandle` 接口扩展 `insertContent(content: Record<string, unknown>)` 方法
- `desktop/src/components/NikoEditor.tsx`: 实现 `insertContent` 方法（通过 `editor.chain().focus().insertContent().run()`）
- `desktop/src/i18n/modules/settings.ts`: 添加 `templateManagerCategoryPlot` 中英双语键（中文"剧情"，英文"Plot"）
- `desktop/src/components/TemplateManagerPanel.test.tsx`: 更新 i18n mock 添加 `templateManagerCategoryPlot`

## Verification
- [x] `grep -n "'plot'" desktop/src/types/template.ts` 返回非空（TemplateCategory 包含 plot）
- [x] `grep -n 'plotTemplateService' desktop/src/services/templateService.ts` 返回非空（合并逻辑存在）
- [x] `grep -n 'plot' desktop/src/components/TemplateManagerPanel.tsx` 返回非空（plot 分类在 UI 中可见）
- [x] `grep -n 'template:apply' desktop/src/components/DocumentEditor.tsx` 返回非空（事件监听器存在）
- [x] `grep -n 'getEditorHandle' desktop/src/components/DocumentEditor.tsx` 返回非空（editor handle 使用存在）
- [x] [UI-observable] TemplateManagerPanel 的 category filter 中可见 'plot' 选项
- [x] [UI-observable] 选择 plot 分类后，列表显示 plot 相关模板
- [x] [UI-observable] 在 TemplateManagerPanel 中应用模板后，编辑器内容正确插入模板结构

## Tests
- [x] `npm run typecheck`: 通过（0 errors）
- [x] `npx vitest run --root . -t 'TemplateManager|template'`: 117 tests passed, 0 failed
  - `TemplateManagerPanel.test.tsx`: 4/4 passed
  - `TemplateBrowserPanel.test.tsx`: 3/3 passed
  - `templateService.test.ts`: 16/16 passed
  - `templateService.branch-gap.additional.test.ts`: 3/3 passed

## Deviations
- None

## Notes
- `template:apply` 事件由 `TemplateManagerPanel` 和 `TemplateBrowserPanel` dispatch，`DocumentEditor` 统一消费。
- `insertContent` 使用 TipTap 的 `insertContent` command 直接插入 JSON 结构，保留 heading/paragraph 格式。
- Plot 模板与现有模板结构相同（content + placeholders），无需新增 API endpoint。
