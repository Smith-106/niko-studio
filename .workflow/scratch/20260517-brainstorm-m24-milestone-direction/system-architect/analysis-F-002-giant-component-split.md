# F-002: Giant Component Split — System Architect Analysis

## Architecture Approach

将 EvaluationPanel (1783 行) 和 StoryBiblePanel (1788 行) 拆分为符合单一职责原则的子组件树。采用"容器/展示分离 + 自定义 Hook 提取"模式，确保拆分后的组件可独立测试、独立渲染。

### Design Rationale

- 1700+ 行组件违反 SRP，认知负荷过高
- 状态逻辑与渲染逻辑耦合，无法单独测试业务规则
- 大组件 re-render 范围过广，存在性能隐患
- 现有 EvaluationPanel 已提取了部分 hooks（useEvaluationWorkflow, useEvaluationData 等），证明模式可行

## Data Model

### EvaluationPanel 组件树

```
EvaluationPanel (Container, ~200 lines)
├── EvaluationHeader (展示: 标题、关闭按钮、模式切换)
├── EvaluationScoreBoard (展示: 评分概览、雷达图)
├── EvaluationSuggestionList (容器: 建议列表 + 筛选)
│   ├── SuggestionFilter (展示: focus 筛选器)
│   └── SuggestionCard (展示: 单条建议)
├── EvaluationRevisionSection (容器: 修订预览 + 操作)
│   └── RevisionPreviewCard (已存在)
└── EvaluationQualityCheck (容器: 质量检查面板)
```

### StoryBiblePanel 组件树

```
StoryBiblePanel (Container, ~200 lines)
├── StoryBibleHeader (展示: 标题、搜索、标签筛选)
├── StoryBibleEntityList (容器: 实体列表 + 分组)
│   └── EntityCard (展示: 单个实体卡片)
├── StoryBibleEntityDetail (容器: 实体详情编辑)
│   ├── EntityBasicInfo (展示: 基本信息表单)
│   ├── EntityRelationships (展示: 关系图)
│   └── EntityTimeline (展示: 时间线)
└── StoryBibleConflictView (展示: 一致性冲突提示)
```

### State Ownership

| Hook | Responsibility | Consumer |
|------|---------------|----------|
| `useEvaluationWorkflow` | 工作流状态 + 动作 | EvaluationPanel (已存在) |
| `useEvaluationRecommendations` | 建议数据 + 筛选 | EvaluationSuggestionList (已存在) |
| `useEvaluationRevision` | 修订候选 + 操作 | EvaluationRevisionSection (新建) |
| `useStoryBibleEntities` | 实体 CRUD + 搜索 | StoryBiblePanel (新建) |
| `useStoryBibleDetail` | 单实体详情编辑 | StoryBibleEntityDetail (新建) |

## State Machine: EvaluationPanel Lifecycle

```
[idle] ──(open)──> [loading]
  │                    │
  │                    ├──(data ready)──> [viewing]
  │                    │                      │
  │                    └──(error)──> [error]  ├──(select suggestion)──> [focused]
  │                                     │     │                            │
  │                                     │     ├──(start revision)──> [revising]
  │                                     │     │                         │
  │                                     │     │    ┌──(apply)──> [applied]
  │                                     │     │    │                  │
  │                                     │     │    └──(cancel)──> [viewing]
  │                                     │     │
  └─────────────────(close)─────────────┴─────┴──────────────────> [idle]
```

| From | Event | To | Side Effect |
|------|-------|----|-------------|
| idle | open | loading | 触发数据获取 |
| loading | data ready | viewing | 渲染评分面板 |
| loading | error | error | 显示错误 + 重试按钮 |
| viewing | select suggestion | focused | 高亮对应文本 |
| focused | start revision | revising | 创建修订候选 |
| revising | apply | applied | 应用到编辑器 |
| revising | cancel | viewing | 丢弃候选 |
| * | close | idle | 清理状态 |

## Error Handling Strategy

- 子组件渲染错误 MUST 被各自的 ErrorBoundary 捕获，不影响兄弟组件
- 数据加载失败 SHOULD 显示 inline 错误状态 + 重试按钮
- 状态不一致（如 revision 引用已删除的 suggestion）MUST 自动回退到 viewing 状态

## Integration Points

- `RevisionPreviewCard` 已独立存在，拆分后直接复用
- `useEvaluationWorkflow` 等 hooks 已提取，证明容器/hook 分离模式已在项目中建立
- Props 接口（`EvaluationPanelProps`）MUST NOT 变更——外部调用方无感知
- 快照测试 MUST 覆盖拆分前后的渲染输出一致性

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| 拆分引入视觉回归 | Medium | High | 快照测试 + 逐步拆分（每次一个子组件） |
| 状态传递链过长 (prop drilling) | Medium | Medium | 使用 Context 或 composition pattern |
| 性能反而下降（过多 re-render boundary） | Low | Medium | React.memo + useMemo 关键路径 |
| 测试覆盖率暂时下降 | Medium | Low | 拆分同时迁移对应测试 |

**总体风险**: MEDIUM — 需要细致的增量执行，但模式已在项目中验证。
