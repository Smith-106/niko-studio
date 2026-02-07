# 跨领域工作流重构任务

## 目标
将小说专用工作流改造为可扩展的跨领域平台架构

## 任务清单

### 1. 平台核心层
- [ ] `src/workflow/base_state.py` - BaseState 抽象基类
- [ ] `src/workflow/base_workflow.py` - BaseWorkflow 抽象类
- [ ] `src/workflow/graph_factory.py` - 工作流工厂

### 2. 领域适配器层
- [ ] `src/workflow/adapters/__init__.py`
- [ ] `src/workflow/adapters/novel_adapter.py` - 小说适配器 (重构现有)
- [ ] `src/workflow/adapters/code_adapter.py` - 代码适配器 (新增)
- [ ] `src/workflow/adapters/base_adapter.py` - 适配器基类

### 3. 小说工作流重构
- [ ] 更新 `state.py` 继承 `BaseState`
- [ ] 更新 `graph.py` 使用适配器模式
- [ ] 确保向后兼容

### 4. 文档更新
- [ ] 更新 SDD_V2.md 添加跨领域架构设计
- [ ] 更新 TASKS.md 添加重构任务
