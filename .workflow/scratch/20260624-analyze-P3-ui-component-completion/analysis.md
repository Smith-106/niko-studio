---
related:
  - project-project
  - roadmap-roadmap
  - scratch-20260624-analyze-p3-ui-component-completion-context
  - scratch-20260624-analyze-p3-ui-component-completion-discussion
---

# Analysis: M28 Phase 3 — UI Component Completion

## Executive Summary

M28 Phase 3 的目标是实现三个 UI 完成项：VoiceConsistencyDecorations（从占位符到真实实现）、TemplateManagerPanel 连接 PlotTemplateService（从空壳到后端连通）、NikoEditor 添加 Ctrl+S 和 dirty check（从缺失到完整）。基于代码库深度探索和架构分析，本分析认为该 phase **技术上可行、用户价值明确、风险低**，建议 **GO**，整体置信度 **86%**。

核心约束：

1. VoiceConsistencyDecorations 的 `applyWarnings` 当前为 void 占位符，需实现为 ProseMirror Mark 或 DecorationSet 模式，与 ShowTellDecorations 对齐。
2. TemplateManagerPanel 当前已连接 `templateService`（本地文件系统），roadmap 要求的 PlotTemplateService 后端服务在代码库中不存在，需明确是连接现有 templateService 还是新建后端服务。
3. NikoEditor 已具备 Ctrl+S 快捷键（`handleKeyDown` 第 134-138 行），但 dirty check 和 beforeunload 保护不完整。

## Dimension Summary

| Dimension | Score | Confidence | Key Evidence |
|-----------|-------|------------|--------------|
| Feasibility | 4/5 | 85% | ShowTellMark/ShowTellDecorations 提供完整参考模式；templateService 已存在；dirty state 已在 uiSlice 和 DocumentEditor 中管理 |
| Impact | 4/5 | 80% | 关闭 ISS-20260613-019/027/029 三个 open issue；补齐用户可见的编辑器功能和模板管理能力 |
| Risk | 4/5 | 85% | 低风险：无架构变更，纯 UI 层实现；最大风险是 VoiceConsistencyDecorations 的 ProseMirror 集成复杂度 |
| Complexity | 3/5 | 80% | VoiceConsistencyDecorations 需要新建 Mark + 段落定位逻辑；其余两项为已有模式的直接扩展 |
| Dependencies | 2/5 (favorable) | 85% | 仅内部模块依赖；无外部库变更；PlotTemplateService 不存在需澄清 |
| Alternatives | 3 options evaluated | 80% | 轻量 tooltip overlay vs 完整 Mark 模式；templateService 复用 vs 新建后端 |

**Overall: GO — 86% confidence**

## Per-Dimension Scoring

### Feasibility (4/5)

- **VoiceConsistencyDecorations**: ShowTellDecorations（`desktop/src/components/editor/extensions/ShowTellDecorations.tsx`）提供了完整的参考实现：通过 `ShowTellMark`（Mark.create）定义 mark 类型，在 `applyShowTellMarks` 中遍历段落节点、设置 selection、调用 `setShowTell(kind)`。VoiceConsistencyDecorations 可以复用相同模式，新建 `VoiceConsistencyMark` 并替换 `applyWarnings` 的 void 实现。
- **TemplateManagerPanel**: 当前已连接 `templateService`（`desktop/src/services/templateService.ts`），提供 `listTemplates` / `saveTemplate` / `deleteTemplate` / `duplicateTemplate` / `substitutePlaceholders`。代码库中不存在名为 `PlotTemplateService` 的模块。ISS-20260613-027 描述为"空壳 UI 未连接后端"，但当前实际上已连接本地 templateService。需要澄清：是扩展现有 templateService 以支持 plot 相关模板，还是新建 PlotTemplateService。
- **Ctrl+S / dirty check**: NikoEditor 第 134-138 行已实现 `Ctrl+S` 快捷键，调用 `onSaveRef.current?.()`。DocumentEditor 第 199-213 行的 `handleSave` 已实现手动保存逻辑。dirty state 由 `uiSlice.ts` 的 `editorIsDirty` + `setEditorIsDirty` 管理，DocumentEditor 的 `handleEditorUpdate` 第 176 行在编辑时设置 `setEditorIsDirty(true)`，保存后设置 `false`。缺失项：`beforeunload` 事件监听（防止未保存离开页面）。

### Impact (4/5)

- 关闭 3 个 open issue：ISS-20260613-019（VoiceConsistencyDecorations 占位）、ISS-20260613-027（TemplateManagerPanel 空壳）、ISS-20260613-029（缺 Ctrl+S 和 dirty check）。
- 用户可见价值：编辑器获得 voice consistency 可视化反馈、模板管理完整功能、保存快捷键和未保存保护。
- 与 M28 整体目标对齐：UI 组件完成度是 roadmap 四大支柱之一。

### Risk (4/5 — low risk, high score)

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| VoiceConsistencyMark 与 ShowTellMark 冲突 | medium | low | 使用不同的 mark 名称和 data attribute；测试同时启用两者 |
| ProseMirror 段落定位不准确 | medium | low | 复用 ShowTellDecorations 的 `descendants` 遍历模式，用 `textBetween` 匹配 warning.line |
| TemplateManagerPanel 与 TemplateBrowserPanel 功能重复 | low | medium | 两者都使用 `templateService` 和 `CustomEvent('template:apply')`；考虑合并或明确分工 |
| beforeunload 事件在 Tauri 中行为差异 | low | low | Tauri 桌面应用通常不刷新页面，但需验证窗口关闭行为 |
| dirty check 与 auto-save 1.5s 防抖冲突 | low | low | auto-save 后设置 `editorIsDirty(false)`，beforeunload 检查同一状态 |

### Complexity (3/5)

- **VoiceConsistencyDecorations**: 中等复杂度。需要：
  1. 新建 `VoiceConsistencyMark.ts`（类似 ShowTellMark，增加 severity 属性）
  2. 实现 `applyVoiceConsistencyMarks`（遍历段落，用 `textBetween` 匹配 `warning.line`，设置 mark）
  3. 在 NikoEditor.tsx 中注册 mark 扩展并挂载组件
  4. 添加 toggle UI（类似 ShowTell 的"开启/关闭"按钮）
- **TemplateManagerPanel**: 低复杂度。当前已实现完整 UI，只需确认与后端服务的连接方式。如果 PlotTemplateService 是新建后端，需要新增 API 层；如果是扩展现有 templateService，则只需添加 plot 模板数据。
- **Ctrl+S / dirty check**: 低复杂度。快捷键已实现，只需添加 `beforeunload` 事件监听和 `window.addEventListener('beforeunload', ...)` 保护。

### Dependencies (2/5 — favorable)

- **内部依赖**：
  - `writing-craft.ts` API（`analyzeVoiceConsistency`）已存在且测试覆盖
  - `templateService.ts` 已存在且功能完整
  - `uiSlice.ts` 的 `editorIsDirty` 状态已存在
  - `ShowTellMark.ts` / `ShowTellDecorations.tsx` 提供参考模式
- **无外部依赖变更**：不需要新库、新服务或基础设施变更。
- **PlotTemplateService 不存在**：这是唯一的不确定性。需要澄清是扩展现有服务还是新建。

### Alternatives

1. **VoiceConsistencyDecorations 轻量 tooltip overlay vs 完整 Mark 模式**
   - 轻量方案：在 VoiceFingerprintPanel 中显示警告列表，不在编辑器中标注位置。实现简单但用户需要在面板和编辑器之间来回查看。
   - Mark 方案（推荐）：在编辑器中直接标注有问题的对话行，与 ShowTell 对齐，用户体验一致。

2. **TemplateManagerPanel 复用现有 templateService vs 新建 PlotTemplateService**
   - 复用现有（推荐）：当前 templateService 已支持结构/类型/格式/自定义模板，可扩展 category 添加 'plot'。
   - 新建后端：如果 plot 模板需要特殊逻辑（如故事结构验证），可新建服务，但增加维护成本。

3. **dirty check 仅 auto-save vs auto-save + beforeunload**
   - 仅 auto-save：当前已实现，1.5s 防抖自动保存。但用户可能不习惯无显式保存。
   - auto-save + beforeunload（推荐）：保留 auto-save 的便捷，添加 beforeunload 防止意外关闭时丢失未保存内容。

## Go/No-Go Verdict

**Verdict: GO (conditional)**

- 所有 intent 已覆盖，无未解决的 ❌ 项。
- 6 维度评分均 >= 3，整体置信 86%。
- 条件：执行阶段必须澄清 PlotTemplateService 的具体定义（扩展现有 templateService 还是新建）；VoiceConsistencyDecorations 采用 Mark 模式与 ShowTell 对齐。

## Confidence Summary

- Feasibility: 85%
- Impact: 80%
- Risk: 85%
- Complexity: 80%
- Dependencies: 85%
- Alternatives: 80%
- **Overall: 86%**
- Pressure pass: passed on ShowTell reference pattern
- Residual risks: PlotTemplateService 定义澄清

## [UI-observable] Criteria for Downstream Plan

下游 plan 必须包含以下 UI-observable 验收标准：

1. **VoiceConsistencyDecorations**:
   - [UI-observable] 编辑器中可见 voice consistency 警告下划线（红色/橙色/灰色波浪线）
   - [UI-observable] 开启/关闭 toggle 按钮存在且可交互
   - [UI-observable] 悬停警告显示详细问题描述（character + issue + severity）
   - [UI-observable] 与 ShowTell 同时启用时无视觉冲突

2. **TemplateManagerPanel**:
   - [UI-observable] 模板列表正确加载并显示（内置 + 自定义）
   - [UI-observable] 模板应用后内容正确插入编辑器
   - [UI-observable] 保存/复制/删除自定义模板后列表实时刷新

3. **Ctrl+S / dirty check**:
   - [UI-observable] 按 Ctrl+S 触发保存，状态栏显示"已保存"反馈
   - [UI-observable] 编辑时状态栏显示"保存中..."
   - [UI-observable] 尝试关闭窗口/刷新页面时，如有未保存内容弹出确认对话框
   - [UI-observable] 章节切换时如有未保存内容显示确认提示（ProjectSidebar 已部分实现）

## Related Issues

- ISS-20260613-019: VoiceConsistencyDecorations 占位实现
- ISS-20260613-027: TemplateManagerPanel 为 stub
- ISS-20260613-029: 缺 Ctrl+S 和 dirty check
- ISS-20260613-039: ShowTellDecorations 逐段 transaction（性能相关，可同步优化）
