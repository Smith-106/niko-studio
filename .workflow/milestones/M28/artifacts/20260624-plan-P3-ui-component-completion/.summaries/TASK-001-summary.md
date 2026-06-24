# TASK-001: VoiceConsistencyDecorations Mark 实现 + NikoEditor 注册 + Toggle UI

## Changes
- `desktop/src/components/editor/extensions/VoiceConsistencyMark.ts` (新建): Mark.create 扩展，name='voiceConsistency'，addAttributes 包含 severity（low/medium/high），parseHTML/renderHTML 使用 data-voice-consistency / data-severity，addCommands 提供 setVoiceConsistency 和 unsetVoiceConsistency
- `desktop/src/components/editor/extensions/VoiceConsistencyDecorations.tsx` (修改): 从 void 占位符实现为完整的 Mark 标注系统。applyWarnings 遍历段落节点，用 text 包含匹配 warning.line，调用 editor.commands.setVoiceConsistency(severity) 设置 mark；enabled=false 时 unsetVoiceConsistency 清除 mark；组件返回 legend overlay（severity 颜色图例 + 分析状态文字）
- `desktop/src/components/NikoEditor.tsx` (修改): extensions 数组添加 VoiceConsistencyMark；JSX 中挂载 VoiceConsistencyDecorations 组件；添加 voiceConsistencyEnabled state 和 toggle 按钮（位于 ShowTell toggle 下方）
- `desktop/src/components/editor/extensions/VoiceConsistencyDecorations.test.tsx` (修改): 7 个测试覆盖 mark 应用、多 warning、清除逻辑、失败处理、unmount 取消、样式导出

## Verification
- [x] grep -n 'voiceConsistency' VoiceConsistencyMark.ts 返回非空（mark 定义存在）
- [x] grep -n 'setVoiceConsistency' VoiceConsistencyMark.ts 返回非空（command 存在）
- [x] grep -n 'VoiceConsistencyMark' NikoEditor.tsx 返回非空（扩展已注册）
- [x] grep -n 'VoiceConsistencyDecorations' NikoEditor.tsx 返回非空（组件已挂载）
- [x] grep -n 'voiceConsistencyEnabled' NikoEditor.tsx 返回非空（toggle 状态存在）
- [x] grep -n 'unsetVoiceConsistency' VoiceConsistencyDecorations.tsx 返回非空（清除逻辑存在）
- [x] 7 个 VoiceConsistency 测试全部通过（npm test -- -t VoiceConsistency）
- [x] typecheck 通过（剩余 2 个 pre-existing 错误与本次修改无关）
- [x] [UI-observable] 编辑器中开启 Voice Consistency 后，有 voice consistency 警告的段落显示对应 severity 颜色的波浪下划线（通过 Mark + CSS 实现）
- [x] [UI-observable] 点击 toggle 按钮可开启/关闭 voice consistency 标注，关闭后波浪下划线消失（unsetVoiceConsistency 清除）

## Tests
- [x] cd desktop && npm run typecheck: 通过（2 个 pre-existing 错误与本次修改无关）
- [x] cd desktop && npm test -- -t VoiceConsistency: 7/7 通过

## Deviations
- None

## Notes
- 复用 ShowTell 的 Mark + Decoration 模式，与现有代码风格一致
- VoiceConsistencyMark 使用 wavy underline 视觉样式（通过 CSS text-decoration），与 ShowTell 的背景色区分
- 按钮使用 `translate-y-20` 定位在 ShowTell toggle 下方，避免重叠
