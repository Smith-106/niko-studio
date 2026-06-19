# F-008: Revision Workflow Enhance — System Architect Analysis

## Architecture Approach

基于 M23 已有的读者体验模型（reader-state, hook/cliffhanger 分析）和修订循环（RevisionOrchestrator），构建智能修订工作流：定向修订建议 → 修订执行 → 效果量化 → 迭代追踪。核心是将"修订"从单次操作升级为有状态的会话。

### Design Rationale

- M23 已有 `RevisionOrchestrator`、`RevisionPreviewCard`、`revisionLoop` 工具函数
- 当前修订是"一次性"的：建议 → 应用 → 结束，无法追踪效果
- 读者体验模型产出的分析结果（弱点识别）SHOULD 直接驱动修订建议
- 作者需要看到"修订前后对比"来建立信心

## Data Model

### Core Entities

```typescript
interface RevisionSession {
  id: string;
  createdAt: number;
  status: RevisionSessionStatus;
  targetChapters: string[];           // 修订目标章节
  triggerSource: 'evaluation' | 'manual' | 'reader-experience';
  iterations: RevisionIteration[];
  config: RevisionSessionConfig;
}

type RevisionSessionStatus = 
  | 'planning'       // 分析弱点，生成修订计划
  | 'suggesting'     // 生成修订建议
  | 'reviewing'      // 用户审阅建议
  | 'applying'       // 应用修订
  | 'measuring'      // 量化效果
  | 'completed'      // 会话结束
  | 'abandoned';     // 用户放弃

interface RevisionIteration {
  id: string;
  round: number;                      // 第几轮迭代
  focus: RevisionFocus;               // 本轮关注点
  suggestions: RevisionSuggestion[];
  appliedCount: number;
  metrics: RevisionMetrics;           // 本轮效果量化
}

interface RevisionFocus {
  dimension: 'tension' | 'character' | 'pacing' | 'dialogue' | 'consistency' | 'style';
  weakPoints: Array<{
    location: { chapter: string; paragraph: number };
    score: number;          // 0-100, 当前得分
    targetScore: number;    // 期望得分
    description: string;
  }>;
}

interface RevisionMetrics {
  before: DimensionScores;
  after: DimensionScores;
  improvement: number;      // 综合提升百分比
  regressions: Array<{     // 修订导致的退步
    dimension: string;
    delta: number;
    description: string;
  }>;
}

interface DimensionScores {
  tension: number;
  character: number;
  pacing: number;
  dialogue: number;
  consistency: number;
  style: number;
  overall: number;
}

interface RevisionSessionConfig {
  maxIterations: number;            // 最大迭代轮数 (default: 5)
  autoMeasure: boolean;             // 应用后自动量化
  focusDimensions: string[];        // 关注维度（空 = 全部）
  aggressiveness: 'conservative' | 'moderate' | 'aggressive';
}
```

### Relationships

```
RevisionSession ──(1:N)──> RevisionIteration
RevisionIteration ──(1:1)──> RevisionFocus
RevisionIteration ──(1:N)──> RevisionSuggestion (existing type)
RevisionIteration ──(1:1)──> RevisionMetrics
RevisionSession ──(triggered by)──> EvaluationPanel | ReaderExperienceAnalysis
RevisionFocus ──(derived from)──> Narrative Analyzers (existing)
```

## State Machine: Revision Session Lifecycle

```
[planning] ──(weakpoints identified)──> [suggesting]
                                              │
                                              ├──(suggestions ready)──> [reviewing]
                                              │                              │
                                              │    ┌──(accept some)──> [applying]
                                              │    │                        │
                                              │    │                        ├──(applied)──> [measuring]
                                              │    │                        │                    │
                                              │    │                        │    ┌──(improved)──┤
                                              │    │                        │    │              │
                                              │    │                        │    │   (target met OR max iterations)
                                              │    │                        │    │              │
                                              │    │                        │    │              v
                                              │    │                        │    │        [completed]
                                              │    │                        │    │
                                              │    │                        │    └──(not enough)──> [suggesting] (next round)
                                              │    │                        │
                                              │    └──(reject all)──> [abandoned]
                                              │
                                              └──(generation error)──> [planning] (retry)
```

| From | Event | To | Guard | Side Effect |
|------|-------|----|-------|-------------|
| planning | weakpoints found | suggesting | weakPoints.length > 0 | 调用 LLM 生成建议 |
| suggesting | ready | reviewing | suggestions.length > 0 | 展示建议列表 |
| reviewing | accept | applying | acceptedCount > 0 | 应用到编辑器 |
| reviewing | reject all | abandoned | — | 记录放弃原因 |
| applying | applied | measuring | autoMeasure = true | 重新运行分析 |
| measuring | improved + target met | completed | — | 生成总结报告 |
| measuring | improved + not target | suggesting | round < maxIterations | 下一轮迭代 |
| measuring | max iterations | completed | round >= maxIterations | 强制结束 |

## Error Handling Strategy

- LLM 建议生成失败 MUST 允许重试（最多 3 次），不自动放弃会话
- 效果量化分析失败 SHOULD 跳过量化步骤，允许用户手动判断
- 修订应用失败（编辑器状态冲突）MUST 支持 undo + 回退到 reviewing 状态
- 会话中途应用崩溃 MUST 有 checkpoint（利用现有 workflow checkpoint 机制）

## Integration Points

### 现有组件复用

- `RevisionOrchestrator` (desktop/src/services/) — 修订执行核心，SHOULD 扩展而非重写
- `RevisionPreviewCard` — 建议展示组件，直接复用
- `useEvaluationWorkflow` — 工作流状态管理模式，可参考
- `revisionLoop` utils — apply/undo/capture 工具函数，直接复用

### 后端分析引擎

- `src-ts/narrative/reader-satisfaction-analyzer.ts` — 读者体验评分
- `src-ts/narrative/evaluators/` — 各维度评估器（提供 before/after 对比数据）
- `src-ts/workflow/revision-loop.ts` — 后端修订循环逻辑

### 与 F-006 的关系

- 修订工作流 SHOULD 作为 workflow-engine 的一种 workflow type 运行
- F-006 重构后的 executor SHOULD 能编排修订步骤
- 修订会话的 checkpoint SHOULD 复用 workflow 的 checkpoint 机制

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| 效果量化不准确（分析引擎噪声） | High | Medium | 展示为"参考"而非"绝对"，允许用户覆盖 |
| 迭代修订导致文本质量震荡 | Medium | High | 回归检测 + 自动停止条件 |
| 会话状态管理复杂度 | Medium | Medium | 复用 workflow session 机制 |
| LLM 建议质量不稳定 | High | Medium | 多候选 + 用户筛选 + 质量评分 |

**总体风险**: MEDIUM-HIGH — 功能复杂度高，但大量基础设施已存在（RevisionOrchestrator, analyzers）。

### MVP Scope (M24)

- 仅支持单章节修订会话（多章节 defer）
- 最多 3 轮迭代
- 仅 tension + pacing 两个维度的定向修订
- 效果量化使用现有 evaluator，不新增分析能力
- 不含修订历史回溯（defer 到 M25）
