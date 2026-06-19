# Context: Phase 2 — Narrative Visualization MVP

**Date**: 2026-05-25
**Areas discussed**: ReaderState 集成, 类型去重, SVG 交互模式, 测试覆盖

## Decisions

### Decision 1: ReaderState 集成优先于布局算法
- **Context**: M23 reader-immersion-engine 未被可视化消费，张力曲线仅基于 EmotionCraft
- **Options**:
  1. 集成 ReaderState 增强张力曲线
  2. 保持 EmotionCraft，仅标注转折点
- **Chosen**: 集成 ReaderState — **Reason**: 解锁 M23 价值，ReaderState 接口已冻结

### Decision 2: 共享类型定义消除重复
- **Context**: NarrativeVisualizationBundle 类型在 desktop/src/api/ 和 src-ts/narrative/ 各定义一次
- **Options**:
  1. 创建 src-ts/narrative/types/visualization-types.ts，desktop 重新导出
  2. 使用代码生成从 src-ts 生成 desktop 类型
- **Chosen**: 共享类型文件 + 重新导出 — **Reason**: 简单直接，无工具链依赖

### Decision 3: 继续使用 inline SVG，不引入 D3
- **Context**: Timeline 需要缩放，CharacterGraph 需要 force-directed 布局
- **Options**:
  1. 引入 D3 实现复杂交互
  2. 继续手写 SVG，参考 Intelligence 模块模式
- **Chosen**: 手写 SVG + Intelligence 参考 — **Reason**: 保持零外部依赖策略，现有 SVG 模式已验证可行

## Constraints

### Locked
- ReaderState (M23) 必须接入 TensionCurveView 作为数据源
- 类型定义单一真源：src-ts/narrative/types/visualization-types.ts
- 不引入外部图表库（D3, Recharts 等）
- 向后兼容：不修改现有 NarrativeVisualizationBundle 的公共字段名
- 侧边栏集成已完成，不修改面板注册机制

### Free
- Timeline 缩放实现方式（SVG viewBox transform vs. CSS transform）
- CharacterGraph 布局算法（简化 force-directed vs. 预计算 grid vs. 层次布局）
- 转折点标注视觉样式（颜色/图标/动画）
- hover tooltip 内容和格式

### Deferred
- CharacterRelationshipsPanel 与 CharacterGraphView 整合（影响范围大，独立评估）
- 可视化数据缓存/增量更新机制（性能优化，非 MVP）
- 大型小说（100+ 章节）性能优化（需基线数据）

## Code Context

- **现有组件**: `desktop/src/components/narrative-visualization/` (7 files)
- **API 契约**: `desktop/src/api/narrative-visualization.ts` (types + POST call)
- **后端聚合**: `src-ts/narrative/narrative-visualization.ts` (buildNarrativeVisualizationBundle)
- **ReaderState**: `src-ts/narrative/reader-immersion-engine.ts` (ReaderState, ChapterReaderState)
- **SVG 参考**: `desktop/src/components/intelligence/TrendChart.tsx`, `EmotionalArcChart.tsx`
- **侧边栏集成**: `AppRightPanels.tsx`, `Sidebar.tsx`, `useAppUiPersistence.ts`
