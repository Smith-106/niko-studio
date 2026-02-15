# Tasks: fix-six-critical-risks

## Task Progress
- [x] **IMPL-001**: 建立六项风险修复基线与软门禁校验矩阵 → [📋](./.task/IMPL-001.json)
- [x] **IMPL-002**: 统一终态语义与 L1-L5 label/slug 映射（canonical + legacy） → [📋](./.task/IMPL-002.json)
- [x] **IMPL-003**: 修复 checkpoint 恢复链路与 replay 字段完整性 → [📋](./.task/IMPL-003.json)
- [x] **IMPL-004**: 收敛 recommendations 注入与 plan_hash deterministic 一致性 → [📋](./.task/IMPL-004.json)
- [x] **IMPL-005**: 修复会话状态迁移一致性（runner_state → persisted status） → [📋](./.task/IMPL-005.json)
- [x] **IMPL-006**: 固化 gateway 多挂载契约与 route/endpoint parity 回归 → [📋](./.task/IMPL-006.json)
- [x] **IMPL-007**: 对齐 desktop 适配层与 UI 语义消费并补齐回归断言 → [📋](./.task/IMPL-007.json)
- [x] **IMPL-008**: 按先 soft 后 hard 策略收敛门禁并执行全链路回归 → [📋](./.task/IMPL-008.json)

## 关键依赖链
- 主链 A：IMPL-001 → IMPL-002 → IMPL-003 → IMPL-004 → IMPL-007 → IMPL-008
- 主链 B：IMPL-001 → IMPL-003 → IMPL-005 → IMPL-008
- 主链 C：IMPL-001 → IMPL-002 → IMPL-006 → IMPL-007 → IMPL-008

## Status Legend
- `- [ ]` = Pending task
- `- [x]` = Completed task
