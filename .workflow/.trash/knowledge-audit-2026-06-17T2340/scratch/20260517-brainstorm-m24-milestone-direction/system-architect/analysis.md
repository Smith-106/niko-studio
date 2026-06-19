# System Architect Analysis: M24 Milestone Direction

## Role Perspective Overview

M24 的核心架构目标是在不破坏现有接口契约的前提下，通过分层重构降低系统复杂度，同时为唯一的新功能方向（叙事可视化或修订工作流）建立可扩展的技术基座。架构策略遵循"数据结构优先、增量演进、接口不变"三原则。

技术债清理（F-001 至 F-006）构成 M24 的主体工作量，其本质是将散落的横切关注点收敛到正确的抽象层级。新功能探索（F-007、F-008）MUST 建立在清理后的架构之上，避免在脆弱基座上叠加复杂度。

## Feature Point Index

| Feature | Analysis File | Key Decisions |
|---------|--------------|---------------|
| F-001 Frontend Console Logger | [analysis-F-001-frontend-console-logger.md](./analysis-F-001-frontend-console-logger.md) | 统一 LogService 接口；生产环境自动降级 |
| F-002 Giant Component Split | [analysis-F-002-giant-component-split.md](./analysis-F-002-giant-component-split.md) | 容器/展示分离；自定义 hook 提取状态逻辑 |
| F-003 Type Safety Cleanup | [analysis-F-003-type-safety-cleanup.md](./analysis-F-003-type-safety-cleanup.md) | 逐文件类型加固；引入 branded types |
| F-004 Translations Modularize | [analysis-F-004-translations-modularize.md](./analysis-F-004-translations-modularize.md) | 按功能域拆分；保持 key 路径不变 |
| F-005 Craft Catalog Externalize | [analysis-F-005-craft-catalog-externalize.md](./analysis-F-005-craft-catalog-externalize.md) | JSON 数据文件 + TypeScript 类型守卫 |
| F-006 Workflow Engine Refactor | [analysis-F-006-workflow-engine-refactor.md](./analysis-F-006-workflow-engine-refactor.md) | 职责分层；策略模式提取业务规则 |
| F-007 Narrative Visualization | [analysis-F-007-narrative-visualization.md](./analysis-F-007-narrative-visualization.md) | 数据管道架构；增量计算模型 |
| F-008 Revision Workflow Enhance | [analysis-F-008-revision-workflow-enhance.md](./analysis-F-008-revision-workflow-enhance.md) | 修订会话状态机；效果量化管道 |

## Cross-Cutting Concerns

See [analysis-cross-cutting.md](./analysis-cross-cutting.md)

## Key Recommendations

1. **执行顺序**: F-001 → F-003 → F-004 → F-005 → F-002 → F-006 → F-007/F-008（依赖链决定）
2. **共享基础设施**: LogService、模块化 i18n loader、JSON schema validator 三个基础组件 MUST 先行建设
3. **接口契约冻结**: workflow-engine 重构 MUST 保持所有 public API 签名不变，通过 adapter 层隔离内部变更
4. **新功能二选一**: F-007 和 F-008 在本里程碑 SHOULD 仅选择一个进入交付状态，另一个 MAY 完成设计但不实现
5. **回归防护**: 巨型组件拆分 MUST 配合快照测试 + 集成测试，确保零视觉回归
