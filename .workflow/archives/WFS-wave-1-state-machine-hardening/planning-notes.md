# Planning Notes - WFS-wave-1-state-machine-hardening

## User Intent
- GOAL: 固化 workflow step 状态机为 `planned -> executing -> review -> test -> done/failed`，并确保全过程可审计、可恢复。
- SCOPE: 仅覆盖 workflow 引擎、会话持久化、MCP 返回契约、对应测试。
- CONTEXT: 现有状态为 `pending/running/completed/failed`，已具备 checkpoint 与 session 生命周期能力。

## Key Constraints
1. 最小改动，保持现有命令入口兼容（`workflow_plan`/`workflow_execute`）。
2. 禁止跳态推进，必须按固定状态机迁移。
3. 每次状态迁移必须落盘并写审计事件。
4. 失败后只能通过恢复链推进，不允许手动回跳重跑。
5. 每个 wave 收尾必须可衔接 review/test 门禁。

## Architecture Findings
- 状态与执行主流程：`src/workflow/workflow_engine.py`
- 会话与审计落盘：`src/workflow/session/session_manager.py`
- MCP 工作流入口：`src/mcp/gateway.py`
- 核心集成测试：`tests/integration/test_workflow_integration.py`
- workflow 单元测试：`tests/unit/workflow/test_workflow_engine.py`

## Conflict Risk
- risk_level: low
- reason: 变更集中在 workflow 核心模块，接口边界清晰，已存在测试可作为回归护栏。
