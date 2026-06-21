# Roadmap: Niko Studio M24 — Tech Debt Cleanup + Narrative Visualization

- [[spec:project:harvest-brainstorm-m24-scope]]
- [[spec:project:architecture-constraints]]

## Overview

M24 聚焦两大目标：(1) 清理 M10-M23 积累的 6 项技术债（console 收口、巨型组件拆分、类型安全加固、翻译模块化、catalog 外置、workflow-engine 重构），(2) 在稳定代码基础上交付叙事结构可视化 MVP。技术债采用"接口冻结"策略——所有重构保持公共 API 不变；workflow-engine 采用 Strategy 模式分层；craft-catalog 外置为 JSON 热加载。Phase 1 通过 wave DAG 内部分 3 批次执行（P1 基础设施 → P2 独立重构 → P2 深度重构），Phase 2 在稳定基础上构建新功能。

## Phases

**Minimum-phase principle:** Default 1 phase. Only add phases for hard dependencies (runtime + not parallelizable + full barrier). Wave DAG inside each phase handles task ordering.

- [x] **Phase 1: Tech Debt Cleanup** — F-001~F-006 技术债清理，3 波次递进执行 ✅ completed
- [x] **Phase 2: Narrative Visualization MVP** — F-007 叙事结构可视化核心功能 ✅ completed

## Phase Details

### Phase 1: Tech Debt Cleanup

**Goal**: 完成 6 项技术债清理，提升代码健康度。Wave 1 建立基础设施模式（logger + 组件拆分），Wave 2 执行独立重构（as-any + translations），Wave 3 执行深度重构（catalog 外置 + workflow-engine Strategy 模式）。全程接口冻结，不破坏向后兼容。

**Depends on**: Nothing (first phase)

**Requirements**: F-001, F-002, F-003, F-004, F-005, F-006

**Success Criteria** (what must be TRUE):
1. 前端 17 个文件的 `console.*` 全部收口到结构化 logger，生产环境无信息泄露
2. EvaluationPanel (1783行) 和 StoryBiblePanel (1788行) 各拆分为 ≤500 行的子组件，保持功能等价
3. 4 个非测试文件的 `as any` 全部替换为正确类型，TypeScript strict 无报错
4. translations.ts (2892行) 按模块拆分为独立文件，key 结构不变，i18n 流程无影响
5. craft-catalog (1584行) 外置为 JSON 文件，支持热加载，现有引用透明迁移
6. workflow-engine (1970行) 采用 Strategy 模式分层，编排逻辑与业务规则分离，公共 API 签名不变
7. 所有现有测试通过，无回归

### Phase 2: Narrative Visualization MVP

**Goal**: 交付叙事结构可视化核心功能——故事线时间轴、角色关系图谱、情节张力曲线。基于 Phase 1 稳定的 workflow-engine 和 craft 数据层构建，集成到现有编辑器面板体系。

**Depends on**: Phase 1 (workflow-engine refactored API + externalized craft-catalog)

**Requirements**: F-007

**Success Criteria** (what must be TRUE):
1. 故事线时间轴组件渲染章节事件序列，支持缩放和筛选
2. 角色关系图谱动态展示角色互动频率和关系类型变化
3. 情节张力曲线基于 M23 reader-state 模型实时渲染，标注关键转折点
4. 可视化面板集成到编辑器侧边栏，响应文档切换
5. 新增测试覆盖率 ≥ 80%，现有测试无回归

**Phase split justification (3-condition check):**
1. Runtime dependency: F-007 可视化组件在运行时调用 workflow-engine 的分析编排 API 和 craft-catalog 数据
2. Not parallelizable: workflow-engine 内部 Strategy 模式重构改变执行路径，F-007 集成测试需要稳定的重构后实现
3. Full barrier: F-001~F-006 全部完成并验证后，F-007 才能可靠集成测试

## Scope Decisions

- **In scope**:
  - F-001: 前端 console 收口（17 文件）
  - F-002: EvaluationPanel + StoryBiblePanel 拆分
  - F-003: MathView, ExportDialog, WritingHelperPanel, revisionOrchestrator 类型加固
  - F-004: translations.ts 按模块拆分
  - F-005: craft-catalog 外置为 JSON + 热加载 loader
  - F-006: workflow-engine Strategy 模式分层重构
  - F-007: 叙事可视化 MVP（时间轴 + 关系图 + 张力曲线）

- **Deferred (M25)**:
  - F-008: 智能修订工作流增强
  - 写作会话智能（行为模式分析）
  - 写作知识个性化（风格推荐）

- **Out of scope**:
  - 重写 workflow-engine 架构（仅重构）
  - 引入新 UI 框架或状态管理库
  - 破坏现有 API 接口向后兼容性
  - 多人协作功能
  - Electron 框架迁移

## Implementation Strategies

| Strategy | Applies To | Description |
|----------|-----------|-------------|
| 接口冻结 | F-001~F-006 | 所有重构保持公共 API 签名不变，内部实现自由调整 |
| JSON 外置 | F-005 | craft-catalog 数据提取为 JSON，TypeScript 仅保留 loader + 类型定义 |
| Strategy 模式 | F-006 | workflow-engine 按职责拆分为 Strategy 接口 + 具体策略实现 |
| 逐步拆分 | F-002 | 巨型组件先提取子组件，再调整 props 传递，最后验证渲染等价 |

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Tech Debt & Integration | ✅ Completed | F-001~F-006, 3-way data integration, mtime detection, sourceIndex persistence, Nowledge Mem library bridge |
| 2. Narrative Visualization MVP | ✅ Completed | F-007: TimelineView, CharacterGraphView, TensionCurveView, ReaderState integration |
