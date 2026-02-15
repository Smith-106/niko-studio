# Planning Notes

**Session**: WFS-cross-project-workflow-closure-p0-p1-p2
**Created**: 2026-02-15T13:31:21+08:00

## User Intent (Phase 1)

- **GOAL**: 将跨项目对比结论落地为 niko-studio 可持续执行闭环（P0 稳态体验 + P1 治理闭环 + P2 语义统一）
- **KEY_CONSTRAINTS**: 复用现有 src/mcp/gateway.py、src/workflow/workflow_engine.py、src/workflow/session/session_manager.py、src/workflow/levels/types.py、desktop 端 client.ts/ChatArea/EvaluationPanel、现有 CI 与 pytest/desktop tests；要求最小改动、向后兼容、先 soft gate 后 hard gate

---

## Context Findings (Phase 2)
- 已完成 4 条探索轨（architecture / dependencies / testing / integration-points）汇总，确认本次闭环应以 `src/mcp/gateway.py`、`src/workflow/workflow_engine.py`、`src/workflow/session/session_manager.py`、`src/workflow/levels/types.py` 与 desktop `client.ts`/`ChatArea.tsx`/`EvaluationPanel.tsx` 为主轴。
- 当前能力具备 route-plan-execute、SSE 终态 decision、checkpoint create/restore 与 CI gate 基础，可按“先 soft gate、后 hard gate”渐进落地 P0/P1/P2，避免破坏既有契约。
- 主要风险集中在多路语义漂移（level 路由、checkpoint 双机制、SSE 终态字段、建议到 plan 注入链路不完整），已在 context-package 中给出优先级分层与缓解策略。

## Conflict Decisions (Phase 3)
- 2026-02-15T13:46:09+08:00 已执行自动冲突解决（--yes）：围绕模块重叠与契约语义漂移采用推荐策略，保持最小改动与向后兼容，并将缺失 brainstorm 工件约束写入 conflict-resolution.json 的 planning_constraints。

## Consolidated Constraints (Phase 4 Input)
1. 复用现有 src/mcp/gateway.py、src/workflow/workflow_engine.py、src/workflow/session/session_manager.py、src/workflow/levels/types.py、desktop 端 client.ts/ChatArea/EvaluationPanel、现有 CI 与 pytest/desktop tests；要求最小改动、向后兼容、先 soft gate 后 hard gate

---

## Task Generation (Phase 4)
### [Action-Planning Agent] 2026-02-15
- **Tasks**: 10（IMPL-001, IMPL-002, IMPL-003, IMPL-004, IMPL-005, IMPL-006, IMPL-007, IMPL-008, IMPL-009, IMPL-010）
- **Execution Strategy**: DAG 串并行混合，先 P0/P1 soft gate 稳态，再 P2 选择性 hard gate。

## N+1 Context
### Decisions
| Decision | Rationale | Revisit? |
|----------|-----------|----------|
| 保持 10 个任务分解并按 P0→P1→P2 推进 | 覆盖用户 8 项范围且保证依赖清晰，可逐步回归与回滚 | No |
| 先收敛 canonical contract，再推进 UI 建议闭环与 hard gate | 降低跨层语义漂移风险，符合最小改动与向后兼容 | No |
| maintenance lane 与 adaptive routing 放在 P2 | 避免在 P0/P1 引入过早硬阻断，先稳住主链路 | Yes |

### Deferred
- [ ] 评估将 maintenance lane 指标接入发布汇总脚本（scripts/release_check_summary.py） - 待 P2 回归稳定后再落地
- [ ] 评估 i18n gate 独立 job（warning->blocking） - 待 desktop 语义文案稳定后推进
