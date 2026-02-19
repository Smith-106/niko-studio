# IMPL Plan - WFS-wave-1-state-machine-hardening-v7 (Wave-1)

## 1. Goal
在不破坏现有行为的前提下，形成可重复执行的 Wave-1 状态机硬化计划，确保状态迁移、审计、恢复与对外返回契约一致。

## 2. Scope
- 状态机与迁移守卫：`src/workflow/workflow_engine.py`
- 会话落盘与审计：`src/workflow/session/session_manager.py`
- MCP 返回契约：`src/mcp/gateway.py`
- 单测/集测：`tests/unit/workflow/test_workflow_engine.py`、`tests/integration/test_workflow_integration.py`

## 3. Task Breakdown
1. IMPL-001: 定义状态枚举与合法迁移矩阵
2. IMPL-002: 实现统一迁移守卫与审计写入
3. IMPL-003: execute 主流程分阶段推进与失败封口
4. IMPL-004: 持久态补强（state trace + checkpoint）
5. IMPL-005: MCP 返回增强（phase/trace/can_resume）
6. IMPL-006: 单元 + 集成测试覆盖与回归

## 4. Dependency DAG
`IMPL-001 -> IMPL-002 -> IMPL-003 -> IMPL-004 -> IMPL-005 -> IMPL-006`
