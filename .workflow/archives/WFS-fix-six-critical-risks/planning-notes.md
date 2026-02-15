# Planning Notes

## Context Findings
- 会话 `WFS-fix-six-critical-risks` 的上下文采集已完成，核心链路覆盖 workflow/gateway/desktop 三端。
- 六项风险主轴已映射到优先文件集：终态语义、checkpoint 恢复、recommendations+plan_hash、一致性状态迁移、L1-L5 label/slug、Gateway 多挂载契约。
- 当前建议沿用“最小改动、向后兼容、先 soft gate 后 selective hard gate”策略，并以现有 integration/unit 测试为回归护栏。

## Conflict Decisions
- 2026-02-15T00:00:00Z 已执行自动冲突解决（--yes）：采用推荐策略处理 3 项 high 冲突（终态语义、level label/slug、plan_hash 回放一致性），并将 brainstorm 工件缺失按 fallback 方式沉淀为 planning_constraints（不阻断流程）。

## Task Generation (Append 2026-02-15)
- 已生成 8 个可执行任务 JSON：`IMPL-001` 至 `IMPL-008`，覆盖六项关键风险点并保持 DAG 无循环。
- 依赖结构采用“先软门禁基线、后语义/链路修复、最终 selective hard gate 收敛”三阶段：
  - 阶段 1：`IMPL-001`
  - 阶段 2：`IMPL-002/003/004/005/006/007`
  - 阶段 3：`IMPL-008`
- 已在每个任务 `flow_control.acceptance_commands` 中固化 pytest + desktop vitest 命令，满足执行期可验证性。
- 已生成规划文档：`IMPL_PLAN.md`、`TODO_LIST.md`，并与 `.task/IMPL-*.json` 完整联动。

## N+1 Context (Append 2026-02-15)
### Decisions
| Decision | Rationale | Revisit? |
|----------|-----------|----------|
| Canonical first + legacy fallback | 避免终态与 level 语义漂移导致前后端行为不一致 | No |
| Checkpoint replay 绑定 deterministic plan_hash | 保证 recommendations 注入后恢复链路可重复、可验证 | Yes |
| Gate progression 采用 soft -> selective hard | 先观测再收敛，降低一次性硬阻断对存量流程冲击 | No |

### Deferred
- [ ] 将 selective hard gate 扩展到更多非关键契约（当前仅 workflow decision / gateway contract / desktop parser+evaluation）。
- [ ] 补齐缺失 brainstorm 工件（guidance/synthesis）并回灌下一轮规划，以替代 fallback 约束来源。

