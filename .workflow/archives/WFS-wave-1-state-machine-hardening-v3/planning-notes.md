# Planning Notes - WFS-wave-1-state-machine-hardening-v3

## User Intent
- GOAL: 固化 workflow step 状态机为 `planned -> executing -> review -> test -> done/failed`，并保证迁移可审计、失败可恢复。
- SCOPE: 覆盖 `workflow_engine`、`session_manager`、MCP 返回契约和对应测试。
- CONTEXT: 项目已有 wave-1~6 的实现与回归，本轮计划用于新一轮自动执行基线。

## Key Constraints
1. 保持 `workflow_plan` 与 `workflow_execute` 入口兼容。
2. 状态迁移仅允许合法路径，禁止跳态。
3. 每次迁移必须落盘审计并可回放。
4. 失败路径必须保留 checkpoint 与恢复信号。
5. 本阶段只产出计划工件，不做额外范围实现。

## Critical Files
- `src/workflow/workflow_engine.py`
- `src/workflow/session/session_manager.py`
- `src/mcp/gateway.py`
- `tests/unit/workflow/test_workflow_engine.py`
- `tests/integration/test_workflow_integration.py`
