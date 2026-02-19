# IMPL Plan - WFS-wave-1-state-machine-hardening (Wave-1 ~ Wave-6)

## 1. 目标与边界
- 总目标：构建可长效自动执行的 workflow 体系，满足会话化、分波次、固定状态机、失败可恢复、幂等续跑、并发控制、质量门禁、可观测性、成本护栏、值班交接。
- Wave-1 目标：在 workflow 引擎中固化 step 状态机为 `planned -> executing -> review -> test -> done/failed`，并保证迁移审计、checkpoint 恢复、MCP 输出可观测。
- 总边界：按 Wave-1 到 Wave-6 渐进改造；每个 wave 必须独立可验收，不做跨波次隐式推进。

## 2. 输入与约束
- 会话：`.workflow/active/WFS-wave-1-state-machine-hardening/workflow-session.json`
- 约束来源：`.workflow/active/WFS-wave-1-state-machine-hardening/planning-notes.md`
- 上下文包：`.workflow/active/WFS-wave-1-state-machine-hardening/.process/context-package.json`
- 冲突决议：`low risk`，无需 conflict phase 阻断。

## 3. 任务拆解（Wave-1）
1. `IMPL-001` 定义 step 状态枚举与合法迁移表（planned/executing/review/test/done/failed）。
2. `IMPL-002` 在 workflow_engine 中实现统一迁移守卫与审计事件写入。
3. `IMPL-003` 改造 execute 主流程为分阶段推进并在失败态封口。
4. `IMPL-004` 会话状态快照补强：在 session state 中记录 step 迁移轨迹与最近 checkpoint。
5. `IMPL-005` MCP `workflow_execute` 返回增强：增加 current_phase/state_trace/can_resume 信号。
6. `IMPL-006` 补齐 integration + unit 测试，覆盖合法迁移、非法跳态、失败恢复、断点续跑。

## 4. 依赖 DAG（Wave-1）
- 主链：`IMPL-001 -> IMPL-002 -> IMPL-003 -> IMPL-004 -> IMPL-005 -> IMPL-006`
- 并行窗口：无（Wave-1 以状态一致性为主，串行执行降低漂移风险）。

## 5. 验收标准（Wave-1）
- 仅允许合法迁移，非法迁移返回错误并写入审计。
- step 执行成功必须经历 `planned -> executing -> review -> test -> done`。
- 失败必须进入 `failed` 且记录 `phase + reason + checkpoint`。
- 中断后可从最近 checkpoint 续跑，不回滚整波次。

## 6. 测试命令（Wave-1）
- `pytest tests/unit/workflow/test_workflow_engine.py -k "state or lifecycle" -q`
- `pytest tests/integration/test_workflow_integration.py -k "state or lifecycle or checkpoint" -q`
- `pytest tests/unit tests/integration -m "not e2e" --cov=src --cov-report=xml --cov-fail-under=80 --junitxml=pytest-wave1.xml`

## 7. 波次门禁（所有 Wave 必须通过）
1. `workflow:review-session-cycle`
2. `workflow:test-fix-gen`
3. `workflow:test-cycle-execute`

## 8. 输出工件（每个 Wave）
- `IMPL_PLAN.md`（主计划持续更新）
- `TODO_LIST.md`（跨 wave 进度）
- `.task/IMPL-xxx.json`
- `.process/PLAN_VERIFICATION.md`

## 9. Wave-2 计划：门禁编排强制化
- 目标：把 `review-session-cycle + test-fix-gen + test-cycle-execute` 固化到 wave 结束状态迁移里，未通过不可进入下一 wave。
- 输入：Wave-1 状态机与 phase trace。
- 产出：gate orchestrator、gate result schema、阻断策略。
- 验收：
  - gate 失败时 wave 状态保持 `failed` 或 `blocked`，禁止推进。
  - gate 通过时自动写入 wave completion checkpoint。
- 关键文件：`src/workflow/workflow_engine.py`、`src/mcp/gateway.py`、`tests/integration/test_workflow_integration.py`。

## 10. Wave-3 计���：失败恢复链自动化
- 目标：失败时统一触发恢复链 `analyze-with-file -> plan -> plan-verify -> execute`，禁止人工即兴重试。
- 输入：Wave-2 gate 结果与失败事件。
- 产出：recovery dispatcher、failure envelope、恢复链审计。
- 验收：
  - 同类失败进入统一恢复链。
  - 恢复链每一步均有落盘记录和 checkpoint。
- 关键文件：`src/workflow/workflow_engine.py`、`src/workflow/session/session_manager.py`、`tests/unit/workflow/test_workflow_engine.py`。

## 11. Wave-4 计划：并发控制与所有权锁
- 目标：独立任务并行，冲突任务串行；共享模块引入锁/所有权防覆盖。
- 输入：Wave-3 恢复链与任务依赖图。
- 产出：module ownership map、lock manager、并行调度规则。
- 验收：
  - 并发任务无共享写冲突。
  - 冲突任务自动降级为串行执行。
- 关键文件：`src/workflow/workflow_engine.py`、`src/workflow/session/session_manager.py`、`tests/integration/test_workflow_integration.py`。

## 12. Wave-5 计划：可观测性与自动升级
- 目标：记录完成率/失败率/重试次数/收敛轮次/MTTR，并按阈值自动升级执行模式。
- 输入：Wave-4 执行日志与 gate 结果。
- 产出：metrics collector、threshold policy、mode escalation（Autopilot -> Team -> Pipeline/Ralph）。
- 验收：
  - 指标可按 wave 聚合回放。
  - 达阈值后模式升级自动触发并可审计。
- 关键文件：`src/workflow/workflow_engine.py`、`src/mcp/gateway.py`、`tests/unit/workflow/test_workflow_engine.py`。

## 13. Wave-6 计划：预算护栏与交接包制度
- 目标：加 token/time budget 与降级策略；形成值班交接包（状态、阻塞、未完成、下一步命令）。
- 输入：Wave-5 指标与模式决策。
- 产出：budget guardrail policy、ecomode 降级、handoff package schema。
- 验收：
  - 预算超阈值触发降级且不中断可恢复链。
  - 每次暂停/交接自动生成 handoff 包。
- 关键文件：`src/workflow/workflow_engine.py`、`src/workflow/session/session_manager.py`、`tests/integration/test_workflow_integration.py`。

## 14. 跨 Wave 总依赖
- `Wave-1 -> Wave-2 -> Wave-3 -> Wave-4 -> Wave-5 -> Wave-6`
- 允许在同一 wave 内局部并行；禁止跨 wave 前置依赖未完成即推进。
