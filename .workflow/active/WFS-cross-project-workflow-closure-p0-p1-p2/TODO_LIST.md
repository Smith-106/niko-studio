# TODO LIST - WFS-cross-project-workflow-closure-p0-p1-p2

## P0 稳态体验
- [x] `IMPL-001` P0-1 建立 analysis schema 与兼容契约基线
- [x] `IMPL-002` P0-2 实现 loop-runner 生命周期与会话映射（depends_on: `IMPL-001`）
- [x] `IMPL-003` P0-3 统一 ChatArea 终态语义与 checkpoint 恢复（depends_on: `IMPL-001`）

## P1 治理闭环
- [x] `IMPL-004` P1-1 recommendations 注入 workflow_plan 并建立回放链路（depends_on: `IMPL-002`）
- [x] `IMPL-005` P1-2 EvaluationPanel 建议 apply/undo/batch 流程闭环（depends_on: `IMPL-003`, `IMPL-004`）
- [x] `IMPL-006` P1-3 高风险写入二次确认与快速撤销机制（depends_on: `IMPL-002`, `IMPL-004`）

## P2 语义统一
- [x] `IMPL-007` P2-1 统一 level/decision 语义并启用选择性 hard gate（depends_on: `IMPL-001`, `IMPL-006`）
- [x] `IMPL-008` P2-2 建立 maintenance lane 与指标驱动自适应路由（depends_on: `IMPL-002`, `IMPL-007`）
- [x] `IMPL-009` P2-3 CI 门禁分层升级与契约回归固化（depends_on: `IMPL-005`, `IMPL-007`）

## 收敛与就绪
- [x] `IMPL-010` 收敛回归与发布就绪归档（Go/No-Go）（depends_on: `IMPL-008`, `IMPL-009`）

## 执行顺序建议
1. `IMPL-001`
2. `IMPL-002` + `IMPL-003`（并行）
3. `IMPL-004`
4. `IMPL-005` + `IMPL-006`（并行）
5. `IMPL-007`
6. `IMPL-008` + `IMPL-009`（并行）
7. `IMPL-010`