# TASK-002 Summary

## Goal
提供 EmotionalArcChart 交互式 SVG 图表组件，并完成 intelligence 导出。

## Files Modified
- src-ts/mcp/endpoints/writing-craft.ts
- desktop/src/api/writing-craft.ts
- desktop/src/components/intelligence/EmotionalArcChart.tsx
- desktop/src/components/intelligence/index.ts

## Evidence
- desktop/src/components/intelligence/EmotionalArcChart.tsx: <svg> 折线图 + tensionDeserts 区间高亮
- desktop/src/api/writing-craft.ts: analyzeEmotionalArc(chapters)

## Notes
- 图表曲线支持可见性切换；tensionDeserts 以半透明红色矩形覆盖。
