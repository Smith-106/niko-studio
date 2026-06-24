# TASK-003: beforeunload + Tauri 窗口关闭 dirty check 保护

## Changes
- `desktop/src/stores/selectors.ts`: 在 `useDocumentEditorState` selector 中添加了 `editorIsDirty` 字段，使其可被 DocumentEditor 组件消费
- `desktop/src/components/DocumentEditor.tsx`: 添加了 `beforeunload` + `onCloseRequested` 保护 useEffect
  - 从 `useDocumentEditorState` 解构出 `editorIsDirty`
  - 监听 `window.beforeunload`，当 `editorIsDirty` 为 true 时阻止页面关闭
  - 条件动态导入 `@tauri-apps/api/window`，注册 `onCloseRequested`，当 `editorIsDirty` 为 true 时阻止窗口关闭
  - cleanup 中移除 `beforeunload` 监听和 Tauri `onCloseRequested` 监听
  - 使用 try/catch + 动态 import，确保 web 构建不会崩溃

## Verification
- [x] grep 'beforeunload' desktop/src/components/DocumentEditor.tsx 返回非空（事件监听存在）: 在 298 行找到 `window.addEventListener('beforeunload', handleBeforeUnload)`
- [x] grep 'onCloseRequested' desktop/src/components/DocumentEditor.tsx 返回非空（Tauri 关闭保护存在）: 在 306-307 行找到 `win.onCloseRequested`
- [x] grep 'editorIsDirty' desktop/src/components/DocumentEditor.tsx 返回非空（dirty 状态检查存在）: 在 55、293、308、329 行找到
- [x] grep 'setEditorIsDirty(false)' desktop/src/components/DocumentEditor.tsx 返回非空（保存后清除 dirty 存在）: 在 189、210、281 行找到
- [x] typecheck 通过: `npm run typecheck` 0 errors
- [x] DocumentEditor 相关测试通过: `npx vitest run -t DocumentEditor` 所有 5 个测试通过（0 失败）

## Tests
- [x] `cd desktop && npm run typecheck`: 通过，0 errors
- [x] `npx vitest run -t DocumentEditor`: 通过，5 个测试全部通过

## Deviations
- 测试命令从 `--grep` 改为 `-t`（vitest 的 filter 选项），因为 vitest 不支持 `--grep`
- 使用了 `getCurrentWindow` 而非 `appWindow`（Tauri v2 API），通过 `(mod as any).getCurrentWindow` 避免类型错误，同时保持 web 构建兼容

## Notes
- `editorIsDirty` 之前已在 `uiSlice` 中定义，但 `useDocumentEditorState` selector 未暴露它，本次补充暴露
- Tauri API 通过条件动态导入 + try/catch 保护，web 构建时静默降级为仅 `beforeunload` 保护
- auto-save 和手动保存后都会调用 `setEditorIsDirty(false)`，与关闭保护逻辑一致
