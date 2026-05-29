# Guidance Specification: M24 Milestone Direction

## 1. Project Positioning & Goals

Niko Studio 是一款 AI 驱动的桌面小说写作工具（Electron + TypeScript），已完成 M10-M23 共 14 个里程碑。当前版本 v9.26.1，具备完整的叙事分析引擎、写作技巧知识库、读者体验评估、智能学习能力和云同步功能。

**M24 目标**：在 M23 功能完备的基础上，通过技术债清理提升代码健康度，同时探索高价值新功能方向，为下一阶段产品演进奠定基础。

**成功标准**：
- 技术债项完成率 ≥ 80%
- 无回归（所有现有测试通过）
- 至少 1 个新功能方向进入可交付状态

## 2. Concepts & Terminology

| Term | Definition | Category |
|------|-----------|----------|
| Console 收口 | 将散落的 `console.*` 调用统一收口到结构化 logger | technical |
| 巨型组件 | 超过 1500 行的 React 组件，违反单一职责原则 | technical |
| craft-catalog | 写作技巧维度的静态数据目录，当前内嵌于代码 | core |
| workflow-engine | 工作流执行引擎，管理分析任务的编排与状态 | core |
| 逻辑下沉 | 将 UI 层混入的业务逻辑移至 service/hook 层 | technical |
| translations 拆分 | 将 2892 行的单体翻译文件按模块拆分 | technical |
| as any | TypeScript 类型断言逃逸，削弱类型安全 | technical |
| 读者体验模型 | M23 新增的 reader-state + hook/cliffhanger 分析能力 | core |

## 3. Non-Goals (Out of Scope)

- MUST NOT 重写现有工作流引擎架构（仅重构，不重建）
- MUST NOT 引入新的 UI 框架或状态管理库
- MUST NOT 破坏现有 API 接口的向后兼容性
- SHOULD NOT 在本里程碑引入多人协作功能（复杂度过高）
- SHOULD NOT 更换 Electron 为其他框架（风险过大）

## 4. Technical Debt Inventory

### 4.1 Console 收口（前端）
- **现状**: 后端已完成，前端 17 个文件仍有 `console.*` 直接调用
- **影响**: 日志不可控、生产环境信息泄露风险
- **优先级**: P1（低风险、高确定性）

### 4.2 巨型组件拆分
- **现状**: EvaluationPanel (1783行), StoryBiblePanel (1788行)
- **影响**: 可维护性差、测试困难、渲染性能隐患
- **优先级**: P1（改善开发体验）

### 4.3 as any 清理
- **现状**: 前端 4 个非测试文件（MathView, ExportDialog, WritingHelperPanel, revisionOrchestrator）
- **影响**: 类型安全漏洞，运行时错误风险
- **优先级**: P2（范围可控）

### 4.4 translations.ts 拆分
- **现状**: 2892 行单文件
- **影响**: 编辑困难、合并冲突频繁、tree-shaking 无效
- **优先级**: P2（改善 DX）

### 4.5 craft-catalog 外置
- **现状**: 1584 行静态数据内嵌于 TypeScript 代码
- **影响**: 数据更新需重新编译、无法热加载
- **优先级**: P2（为未来扩展铺路）

### 4.6 workflow-engine 逻辑下沉
- **现状**: 1970 行单文件，混合编排逻辑与业务规则
- **影响**: 测试复杂、扩展困难
- **优先级**: P2（架构改善）

## 5. New Feature Exploration Directions

### 5.1 写作会话智能（Writing Session Intelligence）
- 基于写作行为模式的实时建议
- 写作节奏分析与疲劳检测
- 个性化写作习惯学习

### 5.2 叙事结构可视化（Narrative Structure Visualization）
- 故事线时间轴可视化
- 角色关系图谱动态展示
- 情节张力曲线实时渲染

### 5.3 智能修订工作流（Intelligent Revision Workflow）
- 基于 M23 读者体验模型的定向修订建议
- 修订前后对比分析
- 迭代修订追踪与效果量化

### 5.4 写作知识个性化（Personalized Craft Knowledge）
- 基于作者风格的技巧推荐
- 弱项识别与针对性练习
- 写作成长轨迹可视化

## 6. Cross-Role Integration Points

- 技术债清理 MUST 先于新功能开发（依赖关系）
- 巨型组件拆分 SHOULD 与新功能 UI 需求协同设计
- workflow-engine 重构 MUST 保持现有 API 不变
- craft-catalog 外置 MAY 与写作知识个性化功能合并实施

## 7. Risks & Constraints

| Risk | Impact | Mitigation |
|------|--------|-----------|
| 巨型组件拆分引入回归 | High | 逐步拆分 + 快照测试 |
| workflow-engine 重构范围蔓延 | Medium | 严格限定接口不变 |
| 新功能方向选择过多 | Medium | 本里程碑最多 1 个新功能 |
| translations 拆分影响 i18n 流程 | Low | 保持 key 结构不变 |

## 8. Feature Decomposition

| ID | Slug | Description | Priority | Related Roles |
|----|------|-------------|----------|---------------|
| F-001 | frontend-console-logger | 前端 console 收口到结构化 logger | P1 | system-architect |
| F-002 | giant-component-split | EvaluationPanel + StoryBiblePanel 拆分 | P1 | system-architect, product-manager |
| F-003 | type-safety-cleanup | as any 清理与类型加固 | P2 | system-architect |
| F-004 | translations-modularize | translations.ts 按模块拆分 | P2 | system-architect |
| F-005 | craft-catalog-externalize | craft-catalog 数据外置为 JSON/YAML | P2 | data-architect, system-architect |
| F-006 | workflow-engine-refactor | workflow-engine 逻辑分层与下沉 | P2 | system-architect |
| F-007 | narrative-visualization | 叙事结构可视化（新功能探索） | P3 | product-manager, ui-designer |
| F-008 | revision-workflow-enhance | 智能修订工作流增强 | P3 | product-manager |

## Appendix: Decision Tracking

| Decision | Source | Rationale |
|----------|--------|-----------|
| 技术债优先于新功能 | Auto (--yes) | 代码健康度是新功能质量的基础 |
| 限制新功能为 1 个方向 | Auto (--yes) | 避免里程碑范围膨胀 |
| 保持 Electron 不变 | Auto (--yes) | 迁移风险远大于收益 |
| 不引入新状态管理 | Auto (--yes) | 现有方案满足需求 |
