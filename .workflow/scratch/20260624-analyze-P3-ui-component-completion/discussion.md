---
related:
  - project-project
  - roadmap-roadmap
  - scratch-20260624-analyze-p3-ui-component-completion-analysis
  - scratch-20260624-analyze-p3-ui-component-completion-context
---

# Discussion: M28 Phase 3 — UI Component Completion

## Session Metadata

- **Date**: 2026-06-24
- **Phase**: M28 Phase 3
- **Goal**: 实现 VoiceConsistencyDecorations、连接 TemplateManagerPanel 到 PlotTemplateService、为 NikoEditor 添加 Ctrl+S 和 dirty check
- **Output directory**: .workflow/scratch/20260624-analyze-P3-ui-component-completion
- **Delegate analysis**: gemini (failed auth), claude (still running — not needed for final output)

## Current Understanding

### VoiceConsistencyDecorations

**现状**: `desktop/src/components/editor/extensions/VoiceConsistencyDecorations.tsx` 是一个占位组件。`applyWarnings` 函数第 28-42 行将所有参数 void 掉，不做任何实际操作。组件返回 null，仅触发 API 调用（`analyzeVoiceConsistency`）但不将结果应用到编辑器。

**参考模式**: `ShowTellDecorations.tsx` 提供了完整实现：
- `ShowTellMark.ts` 定义 ProseMirror Mark 扩展
- `applyShowTellMarks` 遍历段落节点，设置 selection，调用 `editor.commands.setShowTell(kind)`
- 组件渲染图例 overlay
- NikoEditor 中注册 mark 扩展并挂载组件，提供 toggle 按钮

**实现路径**: 复用 ShowTell 模式，新建 `VoiceConsistencyMark.ts`，在 `applyWarnings` 中实现段落遍历 + mark 设置，在 NikoEditor 中注册和挂载。

### TemplateManagerPanel

**现状**: `desktop/src/components/TemplateManagerPanel.tsx` 已实现完整的 UI：
- 分类筛选（all/structure/genre/format/custom）
- 模板卡片网格
- 模板预览（outline + placeholders + action buttons）
- 保存/复制/删除自定义模板
- 通过 `templateService`（本地文件系统）CRUD 操作
- 通过 `CustomEvent('template:apply')` 将结果分发给编辑器

**关键发现**: 代码库中不存在 `PlotTemplateService` 模块。ISS-20260613-027 描述为"空壳 UI 未连接后端"，但当前 TemplateManagerPanel 实际上已连接 `templateService`（`desktop/src/services/templateService.ts`）。

**澄清需求**: roadmap 中"连接 TemplateManagerPanel 到 PlotTemplateService"需要明确：
1. 是扩展现有 `templateService` 添加 plot 模板支持？
2. 还是新建一个后端 `PlotTemplateService`（MCP endpoint）？
3. 还是 ISS-20260613-027 的描述已过时，当前实现已满足需求？

### Ctrl+S / Dirty Check

**现状**: 
- **Ctrl+S 快捷键**: NikoEditor.tsx 第 134-138 行已实现 `handleKeyDown` 拦截 Ctrl+S / Cmd+S，调用 `onSaveRef.current?.()`
- **手动保存逻辑**: DocumentEditor.tsx 第 199-213 行 `handleSave` 已实现：写入文件系统 + 创建 snapshot + 更新状态栏
- **dirty state**: uiSlice.ts 第 54-55 行定义 `editorIsDirty` + `setEditorIsDirty`
- **auto-save**: DocumentEditor 第 170-197 行 `handleEditorUpdate` 中 1.5s 防抖自动保存，编辑时 `setEditorIsDirty(true)`，保存后 `setEditorIsDirty(false)`
- **章节切换保护**: ProjectSidebar.tsx 第 51-57 行 `handleChapterSelect` 已检查 `editorIsDirty`，显示确认 toast

**缺失项**: 
- `beforeunload` 事件监听：防止用户关闭浏览器标签/窗口时丢失未保存内容
- Tauri 窗口关闭事件监听：桌面应用需要 `appWindow.onCloseRequested` 处理

## Decision Table

| Decision | Context | Options | Chosen | Reason |
|----------|---------|---------|--------|--------|
| VoiceConsistencyDecorations 实现模式 | applyWarnings 为 void 占位符 | 1. 轻量 tooltip overlay 2. 完整 ProseMirror Mark 模式 | 2 (Mark 模式) | 与 ShowTell 对齐，用户体验一致，已有参考模式 |
| TemplateManagerPanel 后端连接 | PlotTemplateService 不存在 | 1. 扩展现有 templateService 2. 新建后端服务 3. 当前实现已满足 | 待澄清 | 需要确认 roadmap 意图 |
| Dirty check 范围 | auto-save 已存在 | 1. 仅 auto-save 2. auto-save + beforeunload + Tauri close | 2 (完整保护) | 桌面应用需要窗口关闭保护 |

## Intent Coverage

| Intent | Status | Evidence |
|--------|--------|----------|
| 实现 VoiceConsistencyDecorations | addressed | ShowTell 模式提供完整参考；applyWarnings 需替换为 mark 应用逻辑 |
| 连接 TemplateManagerPanel 到后端 | partially addressed | 已连接 templateService；PlotTemplateService 不存在需澄清 |
| 添加 Ctrl+S 和 dirty check | mostly addressed | Ctrl+S 已实现；dirty state 已管理；缺失 beforeunload/Tauri close |
| 关闭 ISS-20260613-019 | addressed | VoiceConsistencyDecorations 占位→mark 模式实现 |
| 关闭 ISS-20260613-027 | needs clarification | 当前已连接 templateService，需确认 PlotTemplateService 意图 |
| 关闭 ISS-20260613-029 | addressed | Ctrl+S 已实现；beforeunload 需补充 |

## Rounds

### Round 1: 代码库探索
- 读取 roadmap.md、state.json、issues.jsonl 获取上下文
- 搜索 VoiceConsistencyDecorations、TemplateManagerPanel、NikoEditor、dirty check 相关代码
- 读取关键文件：VoiceConsistencyDecorations.tsx、TemplateManagerPanel.tsx、NikoEditor.tsx、DocumentEditor.tsx、uiSlice.ts、templateService.ts、ShowTellDecorations.tsx、ShowTellMark.ts
- 发现：PlotTemplateService 在代码库中不存在

### Round 2: 架构分析
- 对比 ShowTell 实现模式与 VoiceConsistencyDecorations 占位实现
- 分析 dirty check 现有状态（uiSlice + DocumentEditor + ProjectSidebar）
- 评估 TemplateManagerPanel 与 TemplateBrowserPanel 的功能重叠
- 识别缺失项：beforeunload、Tauri close 事件

### Round 3: 独立验证
- 尝试 gemini delegate（失败：auth 问题）
- 尝试 claude delegate（运行中，未等待完成）
- 已有直接代码探索足够支撑分析结论

## Assumptions

1. **PlotTemplateService 假设**: 如果 roadmap 中的 PlotTemplateService 指的是现有 `templateService` 的扩展（添加 plot 模板 category），则实现复杂度低。如果指新建后端服务，则需要额外 API 设计和实现。
2. **VoiceConsistencyDecorations 视觉样式假设**: 复用 ShowTell 的段落背景色模式，但改为下划线（wavy underline）以区分于 ShowTell 的背景色块。
3. **Tauri 关闭事件假设**: 假设 Tauri v2 的 `appWindow.onCloseRequested` 事件可用于拦截窗口关闭，需要验证实际 API。
