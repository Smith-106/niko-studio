# F-007: Narrative Visualization — System Architect Analysis

## Architecture Approach

构建叙事结构可视化系统，将后端已有的叙事分析数据（张力曲线、角色关系、时间线一致性）转化为前端可交互的可视化图表。采用"数据管道 + 增量计算"架构，避免每次渲染都重新分析全文。

### Design Rationale

- 后端已有丰富的分析引擎（tension-curve, character-state, conflict, timeline-consistency 等）
- 缺失的是"分析结果 → 可视化数据 → 渲染"的管道
- 小说文本量大（10万+ 字），MUST 支持增量计算避免性能瓶颈
- 可视化 SHOULD 与编辑器联动（点击节点跳转到对应章节）

## Data Model

### Core Entities

```typescript
interface VisualizationDataset {
  id: string;
  type: 'tension-curve' | 'character-network' | 'timeline' | 'plot-structure';
  version: number;                    // 数据版本，用于增量更新
  generatedAt: number;                // 生成时间戳
  chapterRange: [number, number];     // 覆盖章节范围
  data: TensionCurveData | CharacterNetworkData | TimelineData | PlotStructureData;
}

interface TensionCurveData {
  points: Array<{
    chapterId: string;
    position: number;       // 0-1 normalized position within chapter
    tension: number;        // 0-100 tension score
    label?: string;         // 关键事件标注
    type: 'rising' | 'falling' | 'climax' | 'resolution';
  }>;
  arcs: Array<{
    id: string;
    name: string;
    startChapter: string;
    endChapter: string;
    peakTension: number;
  }>;
}

interface CharacterNetworkData {
  nodes: Array<{
    id: string;
    name: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
    appearances: number;
    firstAppearance: string;  // chapterId
  }>;
  edges: Array<{
    source: string;           // character id
    target: string;           // character id
    relationship: string;     // 关系类型
    weight: number;           // 互动频率
    sentiment: number;        // -1 to 1
    chapters: string[];       // 出现章节
  }>;
}

interface TimelineData {
  events: Array<{
    id: string;
    description: string;
    chapter: string;
    storyTime: string;        // 故事内时间
    characters: string[];
    type: 'plot' | 'backstory' | 'foreshadow';
  }>;
  inconsistencies: Array<{
    eventA: string;
    eventB: string;
    type: 'temporal' | 'causal' | 'character-state';
    severity: 'error' | 'warning';
    description: string;
  }>;
}
```

### Relationships

```
Novel chapters ──(analyzed by)──> Narrative analyzers (existing)
Narrative analyzers ──(produce)──> Raw analysis results
Raw results ──(transformed by)──> VisualizationPipeline
VisualizationPipeline ──(outputs)──> VisualizationDataset[]
VisualizationDataset ──(rendered by)──> React visualization components
```

## State Machine: Visualization Pipeline

```
[idle] ──(request viz)──> [checking-cache]
                               │
                               ├──(cache hit + fresh)──> [rendering]
                               │                              │
                               ├──(cache stale)──> [incremental-update]
                               │                        │
                               │                        └──(updated)──> [rendering]
                               │
                               └──(cache miss)──> [full-analysis]
                                                       │
                                                       ├──(complete)──> [rendering]
                                                       └──(error)──> [error-state]

[rendering] ──(rendered)──> [interactive]
                                 │
                                 ├──(chapter edited)──> [stale] ──(auto)──> [checking-cache]
                                 └──(close)──> [idle]
```

| From | Event | To | Side Effect |
|------|-------|----|-------------|
| idle | request viz | checking-cache | 检查本地缓存 |
| checking-cache | cache fresh | rendering | 直接使用缓存数据 |
| checking-cache | cache stale | incremental-update | 仅分析变更章节 |
| checking-cache | cache miss | full-analysis | 全量分析 |
| full-analysis | complete | rendering | 缓存结果 |
| rendering | rendered | interactive | 用户可交互 |
| interactive | chapter edited | stale | 标记受影响数据集 |

## Error Handling Strategy

- 分析超时（大文本）MUST 支持取消 + 部分结果展示
- 渲染错误 MUST 隔离在 ErrorBoundary 内，不影响编辑器
- 数据不一致（分析结果引用已删除章节）SHOULD 自动清理 + 重新分析
- 可视化库加载失败 MUST 显示 fallback（纯文本摘要）

## Integration Points

### 后端分析引擎（已存在）

- `src-ts/narrative/analyzers/tension-curve-analyzer.ts` → TensionCurveData
- `src-ts/narrative/cross-chapter-character-tracker.ts` → CharacterNetworkData
- `src-ts/narrative/timeline-consistency-checker.ts` → TimelineData
- `src-ts/narrative/evaluators/` → 补充评分数据

### 前端组件

- 新增 `desktop/src/components/visualization/` 目录
- MUST 使用现有 UI 框架（React）和样式系统
- 可视化库选择 SHOULD 优先考虑轻量级方案（如 D3 subset 或 visx）
- MUST NOT 引入重量级图表框架（如 ECharts 全量）

### 与编辑器联动

- 点击可视化节点 → 编辑器跳转到对应位置
- 编辑器光标位置 → 可视化高亮当前上下文
- 通过现有 `useAppStore` 共享状态

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| 大文本分析性能不足 | High | High | 增量计算 + Web Worker + 分析结果缓存 |
| 可视化库 bundle 过大 | Medium | Medium | Tree-shaking + 动态 import |
| 分析数据与编辑器状态不同步 | Medium | Medium | 脏标记 + debounced 重分析 |
| 交互复杂度超出预期 | Medium | Low | MVP 先做只读展示，交互后续迭代 |

**总体风险**: MEDIUM-HIGH — 新功能方向，技术不确定性较高。SHOULD 先做 MVP（仅张力曲线），验证管道后再扩展。

### MVP Scope (M24)

- 仅实现 TensionCurveData 可视化
- 仅支持全量分析（增量计算 defer 到 M25）
- 只读展示，不含编辑器联动交互
- 最大支持 50 章节（性能边界）
