# F-002: Giant Component Split — Product Analysis

## User Value Proposition

将 EvaluationPanel（1783 行）和 StoryBiblePanel（1788 行）拆分为职责单一的子组件，改善 UI 响应性能，降低功能扩展的开发成本。用户将间接受益于更快的面板切换和更稳定的交互体验。

**核心价值**: 开发效率提升 + UI 性能改善 + 为 F-007 新功能 UI 扫清障碍

## Priority Justification

### Impact vs Effort Matrix

| 维度 | 评估 |
|------|------|
| 用户影响 | Medium（性能改善可感知） |
| 开发影响 | Very High（最大的 DX 改善项） |
| 架构影响 | High（建立组件拆分范式） |
| 实施工作量 | High（需仔细设计边界 + 测试） |
| 风险 | Medium（可能引入 UI 回归） |

**综合优先级**: P1 — 虽然工作量大，但对后续所有 UI 功能开发有乘数效应。

## Success Metrics

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 最大组件行数 | < 500 行 | 静态分析 |
| 子组件数量 | 每个面板 4-8 个 | 文件计数 |
| 面板切换耗时 | < 100ms（P95） | Performance profiling |
| 测试覆盖率 | 不低于拆分前 | Coverage report |
| UI 快照测试 | 拆分前后视觉一致 | Snapshot diff |

## User Stories

### US-001: 作为用户，我希望评估面板切换更流畅
**动机**: 当前 EvaluationPanel 整体渲染，切换 tab 时有明显卡顿
**验收**: 面板内 tab 切换无可感知延迟（< 100ms）

### US-002: 作为开发者，我希望修改评估面板的某个子功能时不影响其他部分
**动机**: 1783 行单文件修改任何部分都可能引入意外副作用
**验收**: 每个子组件独立可测试，修改一个子组件的测试不需要 mock 整个面板

### US-003: 作为产品经理，我希望能快速在面板中添加新的分析维度
**动机**: M24 F-007 需要在面板中添加可视化 tab，当前架构难以扩展
**验收**: 新增一个面板 tab 只需创建一个新子组件 + 注册，不修改主面板文件

## Acceptance Criteria

1. EvaluationPanel MUST 拆分为不超过 500 行的子组件
2. StoryBiblePanel MUST 拆分为不超过 500 行的子组件
3. 拆分后 MUST 保持所有现有功能不变（快照测试验证）
4. 每个子组件 MUST 有独立的单元测试文件
5. 组件间通信 SHOULD 通过 props 或 context，MUST NOT 使用全局状态
6. 拆分 MUST NOT 改变现有的公共 API（其他组件对面板的引用方式不变）
7. 拆分后 SHOULD 支持子组件的懒加载（React.lazy）

## Dependencies and Sequencing

### 前置依赖
- F-001 SHOULD 先完成（logger 规范确立后，新子组件直接使用）
- 无硬性技术依赖

### 后续影响
- F-007 叙事可视化 MUST 在 F-002 之后开发（需要清晰的面板架构）
- F-008 修订工作流的 UI 部分受益于拆分后的可扩展架构

### 建议排期
- **Batch 2, Week 3-4**
- 预估工时：5-7 天（含测试）
- EvaluationPanel 和 StoryBiblePanel MAY 并行拆分
