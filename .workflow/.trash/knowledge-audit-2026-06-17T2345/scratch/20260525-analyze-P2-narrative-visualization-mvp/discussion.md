# Discussion: Phase 2 — Narrative Visualization MVP

**Session ID**: ANL-P2-narrative-visualization-mvp-2026-05-25
**Date**: 2026-05-25
**Phase**: 2 (M24)
**Mode**: micro (phase-scoped)
**Dimensions**: architecture, implementation, performance
**Perspectives**: Technical (single comprehensive)
**Depth**: Standard

## Table of Contents

- [User Intent](#user-intent)
- [Current Understanding](#current-understanding)
- [Round 1: Exploration Findings](#round-1-exploration-findings)
- [Intent Coverage](#intent-coverage)
- [Confidence Tracking](#confidence-tracking)

## User Intent

将 Phase 2 定义的可视化 MVP 功能交付到可发布状态：
- 故事线时间轴组件渲染章节事件序列，支持缩放和筛选
- 角色关系图谱动态展示角色互动频率和关系类型变化
- 情节张力曲线基于 reader-state 模型实时渲染，标注关键转折点
- 可视化面板集成到编辑器侧边栏，响应文档切换
- 新增测试覆盖率 ≥ 80%，现有测试无回归

## Current Understanding

**关键发现：可视化模块已经存在并集成到编辑器侧边栏。** 三个视图组件（TimelineView、CharacterGraphView、TensionCurveView）已通过 NarrativeVisualizationPanelContent 渲染，后端 API 管线已联通。Phase 2 的核心任务是**增强和完善**，而非从零构建。

现有状态：
- ✅ 三视图组件存在（SVG 渲染）
- ✅ 侧边栏集成完成（AppRightPanels + Sidebar）
- ✅ 后端 API 管线联通（src-ts → MCP endpoint → desktop API）
- ⚠️ 时间轴缺少缩放和筛选功能
- ⚠️ 角色图谱不展示互动频率，关系类型为静态
- ⚠️ 张力曲线不基于 reader-state，转折点标注缺失
- ❌ reader-immersion-engine (M23) 的 ReaderState 未被消费
- ❌ 类型定义在 desktop/src/api/ 和 src-ts/narrative/ 之间重复
- ❌ 无测试覆盖
- ⚠️ Intelligence 模块有更丰富的 SVG 交互模式（hover, tooltips, toggles），可视化视图未采用

## Round 1: Exploration Findings

**Sources**: cli-explore-agent (3-layer), roadmap.md, state.json

### Key Findings

1. **现有架构** — 14 文件组成完整的前后端管线
   - Frontend: `desktop/src/components/narrative-visualization/` (7 files)
   - API: `desktop/src/api/narrative-visualization.ts` (1 file)
   - Backend: `src-ts/narrative/narrative-visualization.ts` + `emotional-arc.ts` + 依赖模块
   - Integration: `AppRightPanels.tsx`, `Sidebar.tsx`, `useAppUiPersistence.ts`

2. **渲染技术** — 全部使用 inline SVG，无 D3/Recharts 依赖
   - 优点：零外部依赖，bundle size 小
   - 缺点：复杂交互（zoom/pan, force-directed layout）需手写

3. **ReaderState 断裂** — M23 的 `reader-immersion-engine.ts` 定义了完整的 ReaderState 模型，但可视化面板完全未消费
   - 当前张力曲线基于 `analyzeEmotionalArc()` 的 EmotionCraft 分析
   - ReaderState 包含: engagement, immersion, tension, pacing, emotionalState — 正是可视化需要的数据

4. **类型重复** — API 契约类型在 desktop/src/api/ 和 src-ts/narrative/ 各定义一次
   - 维护风险：修改一方容易遗漏另一方

5. **Intelligence 模块参考** — `TrendChart.tsx` 和 `EmotionalArcChart.tsx` 实现了 hover tooltips、趋势切换、交互式图例等高级功能
   - 可视化视图可以复用这些模式

### Discussion Points

- 缩放/筛选实现路径：SVG transform vs. 虚拟化列表？
- 角色图谱布局：force-directed vs. 预计算？
- ReaderState 集成：替换还是增强现有 emotional arc？
- 类型去重：共享包 vs. 代码生成？

### Open Questions

- 现有组件的测试覆盖率（可能为 0）
- 性能基线：大型小说（100+ 章节）的渲染时间
- CharacterRelationshipsPanel 与 CharacterGraphView 的关系定位

## Intent Coverage

| # | Intent | Status | Where |
|---|--------|--------|-------|
| 1 | 故事线时间轴支持缩放和筛选 | 🔄 组件存在，缺少交互 | TimelineView.tsx |
| 2 | 角色关系图谱展示互动频率 | 🔄 组件存在，静态展示 | CharacterGraphView.tsx |
| 3 | 张力曲线基于 reader-state + 转折点 | ❌ 未消费 reader-state | TensionCurveView.tsx |
| 4 | 面板集成到侧边栏 | ✅ 已完成 | AppRightPanels + Sidebar |
| 5 | 测试覆盖率 ≥ 80% | ❌ 无测试 | — |

## Confidence Tracking

| Dimension | Findings | Evidence | Coverage | User Val | Consistency | Overall |
|-----------|----------|----------|----------|----------|-------------|---------|
| Architecture | 85% | 80% | 90% | 70% | 85% | **82%** |
| Implementation | 75% | 70% | 80% | 65% | 80% | **74%** |
| Performance | 50% | 40% | 60% | 50% | 70% | **52%** |

Threshold: 60-80% → 可选继续深入 | Performance 维度偏低，但可在 plan 阶段设计 benchmark
