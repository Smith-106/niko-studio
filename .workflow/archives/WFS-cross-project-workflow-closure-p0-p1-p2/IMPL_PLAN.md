# IMPL Plan - WFS-cross-project-workflow-closure-p0-p1-p2

## 1. 目标与边界
- 目标：将跨项目对比结论落地为 niko-studio 可持续执行闭环，按 P0（稳态体验）→ P1（治理闭环）→ P2（语义统一）推进。
- 约束：最小改动、向后兼容、先 soft gate 后 hard gate。
- 范围：仅规划工件，不包含本阶段业务代码改动。

## 2. 上下文优先级（直接复用 context-package）
- Critical：`src/mcp/gateway.py`、`src/workflow/workflow_engine.py`、`desktop/src/api/client.ts`、`desktop/src/components/ChatArea.tsx`
- High：`src/workflow/session/session_manager.py`、`src/workflow/levels/types.py`、`desktop/src/components/EvaluationPanel.tsx`、`tests/unit/workflow/test_workflow_engine.py`
- 补充约束：参考 `conflict-resolution.json` 的 canonical contract first 与 soft-gate staged convergence。

## 3. 任务拆解（10 个）

### P0 稳态体验
1. `IMPL-001`：建立 analysis schema 与兼容契约基线
2. `IMPL-002`：实现 loop-runner 生命周期与会话映射（依赖 `IMPL-001`）
3. `IMPL-003`：统一 ChatArea 终态语义与 checkpoint 恢复（依赖 `IMPL-001`）

### P1 治理闭环
4. `IMPL-004`：recommendations 注入 workflow_plan 并建立回放链路（依赖 `IMPL-002`）
5. `IMPL-005`：EvaluationPanel 建议 apply/undo/batch 流程闭环（依赖 `IMPL-003`、`IMPL-004`）
6. `IMPL-006`：高风险写入二次确认与快速撤销机制（依赖 `IMPL-002`、`IMPL-004`）

### P2 语义统一
7. `IMPL-007`：统一 level/decision 语义并启用选择性 hard gate（依赖 `IMPL-001`、`IMPL-006`）
8. `IMPL-008`：建立 maintenance lane 与指标驱动自适应路由（依赖 `IMPL-002`、`IMPL-007`）
9. `IMPL-009`：CI 门禁分层升级与契约回归固化（依赖 `IMPL-005`、`IMPL-007`）
10. `IMPL-010`：收敛回归与发布就绪归档（Go/No-Go）（依赖 `IMPL-008`、`IMPL-009`）

## 4. 关键依赖链
- 主链 A：`IMPL-001 -> IMPL-002 -> IMPL-004 -> IMPL-006 -> IMPL-007 -> IMPL-008 -> IMPL-010`
- 主链 B：`IMPL-001 -> IMPL-003 -> IMPL-005 -> IMPL-009 -> IMPL-010`

## 5. 执行策略
- 模式：DAG 串并行混合执行。
- 并行窗口：
  - `IMPL-002` 与 `IMPL-003` 可并行。
  - `IMPL-005` 与 `IMPL-006` 部分并行（在 `IMPL-004` 完成后）。
  - `IMPL-008` 与 `IMPL-009` 并行，最终汇合到 `IMPL-010`。
- gate 策略：P0/P1 以 soft gate 为主，P2 仅对高风险场景启用 hard gate。

## 6. 验证口径
- 后端基线：`python -m pytest tests/unit tests/integration -m "not e2e" --cov=src --cov-report=xml --cov-fail-under=80`
- Workflow 关键回归：`python -m pytest tests/unit/workflow/test_workflow_engine.py -q`
- Gateway/Stream 回归：`python -m pytest tests/unit/mcp/test_gateway_stream.py -q`
- Desktop 基线：`pnpm --dir desktop run test:ci`
- CI gate 回归：`python -m pytest tests/unit/test_ci_gate_workflows.py -q`

## 7. Go/No-Go
- Go：关键链路（stream/checkpoint/gate）回归通过，覆盖率门槛满足，desktop 与后端测试全绿。
- No-Go：任一关键链路回归失败或 CI gate 断言失败。