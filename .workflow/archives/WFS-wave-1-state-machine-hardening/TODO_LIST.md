# Tasks: wave-1-state-machine-hardening (Wave-1 ~ Wave-6)

## Wave-1 Task Progress
- [x] **IMPL-001**: 定义 step 状态与合法迁移表 → [📋](./.task/IMPL-001.json)
- [x] **IMPL-002**: 实现 workflow_engine 迁移守卫与审计写入 → [📋](./.task/IMPL-002.json)
- [x] **IMPL-003**: 改造 execute 为分阶段状态推进与失败封口 → [📋](./.task/IMPL-003.json)
- [x] **IMPL-004**: 会话 state 快照补强与 checkpoint 轨迹记录 → [📋](./.task/IMPL-004.json)
- [x] **IMPL-005**: MCP workflow_execute 返回增强（phase/trace/resume） → [📋](./.task/IMPL-005.json)
- [x] **IMPL-006**: 补齐状态机与恢复链测试覆盖 → [📋](./.task/IMPL-006.json)

## Wave-2 ~ Wave-6 Planning Milestones
- [x] **IMPL-007**: Wave-2 门禁编排强制化（review+test gate 强制） → [📋](./.task/IMPL-007.json)
- [x] **IMPL-008**: Wave-3 失败恢复链自动化（analyze->plan->verify->execute） → [📋](./.task/IMPL-008.json)
- [x] **IMPL-009**: Wave-4 并发控制与模块所有权锁 → [📋](./.task/IMPL-009.json)
- [x] **IMPL-010**: Wave-5 可观测指标与模式升级策略 → [📋](./.task/IMPL-010.json)
- [x] **IMPL-011**: Wave-6 预算护栏与交接包制度 → [📋](./.task/IMPL-011.json)

## Dependency Chain
- Wave 主链: `Wave-1 -> Wave-2 -> Wave-3 -> Wave-4 -> Wave-5 -> Wave-6`
- 任务主链: `IMPL-001 -> IMPL-002 -> IMPL-003 -> IMPL-004 -> IMPL-005 -> IMPL-006 -> IMPL-007 -> IMPL-008 -> IMPL-009 -> IMPL-010 -> IMPL-011`

## Status Legend
- `- [ ]` = Pending task
- `- [x]` = Completed task
