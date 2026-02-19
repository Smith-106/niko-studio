# Planning Notes - WFS-wave-1-state-machine-hardening-v2

## User Intent
- GOAL: 固化 workflow step 状态机为 `planned -> executing -> review -> test -> done/failed`，并确保全过程可审计、可恢复。
- SCOPE: 仅覆盖 workflow 引擎、会话持久化、MCP 返回契约与对应测试。
- CONTEXT: 当前代码已具备 wave-1~6 能力，本次规划聚焦 wave-1 状态机硬化基线的复盘与可复用执行计划。

## Key Constraints
1. 保持 `workflow_plan` / `workflow_execute` 入口兼容。
2. 禁止非法跳态，所有迁移必须经统一守卫。
3. 每次迁移必须写审计并可回放。
4. 失败路径必须保留 checkpoint 与可恢复信号。
5. 仅规划，不在本阶段直接改动业务逻辑。

## Critical Files
- `src/workflow/workflow_engine.py`
- `src/workflow/session/session_manager.py`
- `src/mcp/gateway.py`
- `tests/unit/workflow/test_workflow_engine.py`
- `tests/integration/test_workflow_integration.py`
