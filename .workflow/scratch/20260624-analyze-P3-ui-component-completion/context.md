# Context: M28 Phase 3 — UI Component Completion

## Scope

- Milestone: M28
- Phase: 3
- Title: UI Component Completion
- Analysis artifact: ANL-20260624-P3-ui-component-completion

## Interview Decisions

| Decision | Classification | Value |
|----------|----------------|-------|
| Scope | Locked | Phase 3 micro analysis |
| Depth | Locked | Standard |
| Dimensions | Locked | All 6 |
| Verdict | Locked | GO |

## Locked Decisions

1. **VoiceConsistencyDecorations 采用 ProseMirror Mark 模式**: 与 ShowTellDecorations 对齐，新建 `VoiceConsistencyMark.ts`，实现 `applyVoiceConsistencyMarks` 段落遍历 + mark 设置逻辑。
2. **Ctrl+S 快捷键保持现有实现**: NikoEditor 第 134-138 行已实现，无需修改。补充 `beforeunload` 和 Tauri 关闭事件保护。
3. **dirty state 复用现有 uiSlice 机制**: `editorIsDirty` + `setEditorIsDirty` 已存在，ProjectSidebar 章节切换保护已使用，只需扩展 beforeunload/Tauri close。

## Free Decisions

1. **VoiceConsistencyDecorations 的视觉样式**: 下划线颜色（已定义 colorForSeverity）、下划线样式（wavy underline）、tooltip 显示内容（character + issue + severity）。
2. **beforeunload 提示消息文案**: 由 i18n 模块提供，具体字符串在实现时确定。
3. **TemplateManagerPanel 与 TemplateBrowserPanel 的分工**: 两者功能高度重叠，可在实现时决定是否合并或明确分工。

## Deferred Decisions

1. **PlotTemplateService 具体定义**: 需要澄清是扩展现有 templateService 还是新建后端服务。当前 TemplateManagerPanel 已连接 templateService，可能 ISS-20260613-027 已部分解决。
2. **ShowTellDecorations 性能优化（ISS-20260613-039）**: 逐段 transaction 导致长文卡顿，可在 Phase 3 同步优化，但非必须。
3. **VoiceConsistencyDecorations 与 VoiceFingerprintPanel 的联动**: 当前两者独立运行，未来可考虑共享分析结果避免重复 API 调用。

## Gray Areas

- **TemplateManagerPanel 的 "stub" 状态**: ISS-20260613-027 描述为"空壳 UI 未连接后端"，但当前代码显示已完整连接 templateService。可能 issue 描述已过时，或 PlotTemplateService 是另一个未实现的后端。
- **TemplateBrowserPanel 与 TemplateManagerPanel 的关系**: 两者都使用 templateService 和 CustomEvent('template:apply')，功能高度重叠。TemplateBrowserPanel 在 `desktop/src/components/TemplateBrowserPanel.tsx` 中定义，可能为旧版本或不同入口。

## Key Constraints

- `VoiceConsistencyDecorations.tsx` 的现有测试（`VoiceConsistencyDecorations.test.tsx`）必须继续通过。
- `ShowTellMark.ts` 的 mark 名称和 data attribute 不能冲突；`VoiceConsistencyMark` 必须使用不同的名称和 attribute。
- `beforeunload` 事件处理在 Tauri 桌面环境中行为可能与浏览器不同，需测试验证。
- 所有 UI 变更必须遵循现有的 dark/light 模式 CSS 变量约定。

## Confidence

- Overall: 86%
- Highest: Ctrl+S / dirty check（已有 80% 实现，只需补充 beforeunload）
- Lowest: TemplateManagerPanel / PlotTemplateService（PlotTemplateService 定义不明确）

## Next Step

`/maestro-plan 3`
