# IMPL Plan - WFS-fix-six-critical-risks

## 1. 目标与边界
- 目标：修复 6 项关键风险点并形成可执行任务 DAG，风险范围为：
  1) 终态语义一致性；
  2) checkpoint 恢复链路；
  3) recommendations 注入与 plan_hash 一致性；
  4) 会话状态迁移一致性；
  5) L1-L5 label/slug 语义一致性；
  6) gateway 多挂载契约回归。
- 约束：最小改动、向后兼容、先 soft gate 后 selective hard gate。
- 范围：本阶段仅生成规划工件，不修改业务代码。

## 2. 输入上下文与约束来源
- 会话元数据：`.workflow/active/WFS-fix-six-critical-risks/workflow-session.json`
- 主约束源：`.workflow/active/WFS-fix-six-critical-risks/planning-notes.md`
- 结构化上下文：`.workflow/active/WFS-fix-six-critical-risks/.process/context-package.json`
- 冲突决议：`.workflow/active/WFS-fix-six-critical-risks/.process/conflict-resolution.json`
- 关键约束共 4 条：
  1) 采用 canonical 语义并保留 legacy 回填；
  2) label/slug 以 `types.py` 转换函数为单一映射来源；
  3) plan_hash 维持 deterministic 回放；
  4) 缺失 brainstorm 工件不阻断规划流程。

## 3. 风险到任务映射
- 风险 R1 终态语义一致性 → `IMPL-002`、`IMPL-007`
- 风险 R2 checkpoint 恢复链路 → `IMPL-003`、`IMPL-007`
- 风险 R3 recommendations + plan_hash 一致性 → `IMPL-004`、`IMPL-007`
- 风险 R4 会话状态迁移一致性 → `IMPL-005`
- 风险 R5 L1-L5 label/slug 一致性 → `IMPL-002`
- 风险 R6 gateway 多挂载契约回归 → `IMPL-006`、`IMPL-008`

## 4. 任务拆解（8 个）
1. `IMPL-001`：建立六项风险修复基线与软门禁校验矩阵
2. `IMPL-002`：统一终态语义与 L1-L5 label/slug 映射（canonical + legacy）
3. `IMPL-003`：修复 checkpoint 恢复链路与 replay 字段完整性
4. `IMPL-004`：收敛 recommendations 注入与 plan_hash deterministic 一致性
5. `IMPL-005`：修复会话状态迁移一致性（runner_state → persisted status）
6. `IMPL-006`：固化 gateway 多挂载契约与 route/endpoint parity 回归
7. `IMPL-007`：对齐 desktop 适配层与 UI 消费语义并补齐回归断言
8. `IMPL-008`：按先 soft 后 hard 策略收敛门禁并执行全链路回归

## 5. 依赖与执行策略（DAG）
- 主链 A：`IMPL-001 -> IMPL-002 -> IMPL-003 -> IMPL-004 -> IMPL-007 -> IMPL-008`
- 主链 B：`IMPL-001 -> IMPL-003 -> IMPL-005 -> IMPL-008`
- 主链 C：`IMPL-001 -> IMPL-002 -> IMPL-006 -> IMPL-008`
- 并行窗口：
  - `IMPL-002` 与 `IMPL-003` 在 `IMPL-001` 后可并行；
  - `IMPL-005` 与 `IMPL-006` 可并行；
  - `IMPL-007` 依赖 `IMPL-004`，最终与 `IMPL-005/006` 汇合到 `IMPL-008`。

## 6. 验收与测试命令（执行期复用）
- Python 基线：
  - `pytest tests/unit tests/integration -m "not e2e" --cov=src --cov-report=xml --cov-fail-under=80 --junitxml=pytest-baseline.xml`
- Workflow 核心：
  - `pytest tests/unit/workflow/test_workflow_engine.py -q`
  - `pytest tests/unit/workflow/test_levels_types.py -q`
  - `pytest tests/integration/test_workflow_integration.py -q`
- Gateway 契约：
  - `pytest tests/unit/mcp/test_gateway_stream.py -k "contract" -q`
  - `pytest tests/unit/mcp/test_gateway_chat.py -q`
- Desktop Vitest：
  - `npm --prefix desktop run test -- src/api/client.test.ts src/components/ChatArea.test.tsx src/components/EvaluationPanel.test.tsx`
  - `npm --prefix desktop run test:ci`

## 7. 质量门禁与回滚策略
- 阶段 1（soft gate）：在 `IMPL-001` 到 `IMPL-007` 期间保持告警不阻断，记录语义漂移与契约偏差。
- 阶段 2（selective hard gate）：`IMPL-008` 对高风险用例启用 hard fail，范围仅限 workflow decision、gateway contract、desktop parser/apply/undo 三组断言。
- 回滚：任一 hard gate 失败时，回滚到 `IMPL-007` 输出并保留 soft gate 观测，不放大改动范围。

## 8. 产物清单
- 计划文档：`IMPL_PLAN.md`
- 任务清单：`TODO_LIST.md`
- 任务 JSON：`.task/IMPL-001.json` 至 `.task/IMPL-008.json`

## 模板校验清单
- [x] 包含目标、边界、约束、风险映射
- [x] 任务数量在 6-10 范围内（当前 8）
- [x] 依赖链清晰且无循环
- [x] 验收命令包含 pytest 与 desktop vitest
- [x] 明确 soft gate → hard gate 渐进策略
