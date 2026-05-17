# TASK-001 Summary

## Goal
TipTap Show vs Tell 色彩标记扩展（Show=绿、Tell=红、Neutral=灰），并完成前后端接口接入。

## Files Modified
- src-ts/mcp/endpoints/writing-craft.ts
- src-ts/mcp/endpoints/index.ts
- desktop/src/api/writing-craft.ts
- desktop/src/components/editor/extensions/ShowTellMark.ts
- desktop/src/components/editor/extensions/ShowTellDecorations.tsx
- desktop/src/components/NikoEditor.tsx
- desktop/src/components/intelligence/ShowTellLegend.tsx

## Evidence
- desktop/src/api/writing-craft.ts: 新增 analyzeShowTell(text)
- desktop/src/components/editor/extensions/ShowTellMark.ts: Mark 扩展
- desktop/src/components/editor/extensions/ShowTellDecorations.tsx: 基于 heatMap 对段落应用 mark，并提供 UI toggle
- desktop/src/components/NikoEditor.tsx: 注册 ShowTellMark 并挂载 ShowTellDecorations

## Notes
- 当前实现以 Mark + 段落级映射为主，避免引入更重的 ProseMirror Decoration plugin。
