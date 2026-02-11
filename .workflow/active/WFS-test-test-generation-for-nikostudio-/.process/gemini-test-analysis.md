# Test Concept Analysis

## 目标与范围
- 目标：评估 nikostudio 现有测试覆盖现状，识别关键缺口，并给出自动化、分层的测试策略与覆盖率门槛建议。
- 范围：CI 配置、tests/unit、tests/integration、tests/performance，以及验证脚本（scripts）。

## 现有测试与自动化入口
### CI 与覆盖率
- CI 入口：`.github/workflows/integration-tests.yml`
- 当前约束：CI 仅运行 `tests/integration`，覆盖率门槛为 **70%**。
- 风险：文档规划覆盖率为 **80%**，与 CI 不一致；仓库缺少 `pytest.ini`，可能导致本地/CI 参数差异。

### 主要测试资产
- 集成测试：
  - `tests/integration/test_e2e_workflow.py`
  - `tests/integration/test_memory_integration.py`
  - `tests/integration/test_service_layer.py`
- 单元测试：
  - `tests/unit/mcp/test_gateway_chat.py`
  - `tests/unit/test_workflow.py`
  - `tests/unit/mcp/conftest.py`（fixtures/mocks 基础）
- 文档规范：
  - `docs/tdd/01_Unit_Tests_Plan.md`
  - `docs/tdd/03_Test_Cases_Inventory.md`

## 覆盖差距分析
### 关键缺口
1. **覆盖率门槛不一致**：CI 70 与文档 80 不一致，导致质量标准漂移。
2. **pytest.ini 缺失**：测试参数无法统一，影响自动化可重复性。
3. **单元测试覆盖不足**：
   - Workflow：仅覆盖部分模板/阈值逻辑，缺少适配器边界条件。
   - Memory/Graph/Services：核心模块覆盖率较低，尤其是边界条件与失败分支。
4. **集成测试范围偏窄**：CI 仅运行 integration，未覆盖 unit 与 performance。
5. **脚本验证未纳入自动化**：`scripts/verify_project_status.py`、`scripts/verify_vector_search.py` 未纳入 CI 流水线。

### 质量风险
- API 签名变化导致 Mock 不一致（历史冲突经验）。
- 覆盖率门槛不统一导致发布前质量不可比。
- 测试层级缺失导致关键路径仅在集成层暴露问题，定位成本高。

## 分层测试策略（L0-L3）
> 目标：自动化、可复现、分层防御，覆盖从单点逻辑到端到端流程。

### L0：快速验证（Smoke）
- **目标**：最短时间验证核心可用性。
- **范围**：CLI 入口 + Workflow Engine 最小运行路径。
- **推荐用例**：
  - CLI 启动与 `src/cli/main.py` 入口可调用。
  - Workflow Engine 最小会话执行，不触发异常。

### L1：单元测试（Unit）
- **目标**：确保核心逻辑稳定、可回归。
- **重点模块**：
  - `src/workflow/state.py`、`src/workflow/adapters/novel_adapter.py`
  - `src/memory/*`（Memory Manager、Distillation）
  - `src/graph/*`（Graph Manager）
  - `src/services/*`（indexing/obsidian/token 等）
- **要求**：覆盖正常路径 + 异常分支 + 边界值。

### L2：集成测试（Integration）
- **目标**：验证模块交互与接口一致性。
- **重点场景**：
  - Workflow + Memory + Services 联动。
  - 关键 API 签名一致性（避免 Mock 假设偏差）。
  - 现有 integration 目录扩展覆盖 workflow 模板、memory 服务与 graph 模块。

### L3：端到端与性能（E2E/Performance）
- **目标**：模拟真实使用与性能边界。
- **建议范围**：
  - 端到端 workflow 执行路径（含 CLI 触发）。
  - 关键性能指标：检索/索引、记忆写入、服务调用延迟。
  - 将 `tests/performance` 纳入独立 pipeline（非每次提交）。

## 覆盖率策略建议
- **短期**：以 CI 70 为最低门槛，同时在文档中明确阶段目标。
- **中期**：统一门槛至 80%，并��齐 pytest.ini 规范参数（markers、timeout、async 配置）。
- **分层门槛**（可选）：
  - L1 单元：>= 80%
  - L2 集成：>= 70%
  - L3 性能：结果报告型，不做硬门槛

## 测试策略落地清单
1. 明确 CI 测试范围（integration vs unit + integration）。
2. 统一覆盖率阈值并补齐 pytest.ini。
3. 增补 unit 测试以覆盖 Memory/Graph/Services 的失败分支。
4. 扩展 integration 测试覆盖 workflow 模板与 memory 服务。
5. 将验证脚本纳入自动化流程（可作为 nightly job）。

## L0-L3 需求清单（多层要求）
- **L0**：
  - L0-1：CLI 入口可执行且无异常退出。
  - L0-2：Workflow Engine 最小会话可完成。
- **L1**：
  - L1-1：Workflow 状态初始化与阈值路由覆盖正常/异常分支。
  - L1-2：Memory Manager 的读写与异常处理覆盖边界条件。
  - L1-3：Graph Manager 的创建/查询/空结果分支有断言。
  - L1-4：Service 层（indexing/obsidian/token）主要函数覆盖成功与失败路径。
- **L2**：
  - L2-1：Workflow + Memory + Service 的端到端联动测试。
  - L2-2：接口签名一致性验证（Mock 与真实参数一致）。
  - L2-3：Workflow 模板（L1/L3）执行路径覆盖。
- **L3**：
  - L3-1：E2E workflow（包含 CLI 触发）完整流程可执行。
  - L3-2：关键性能指标（检索/索引/记忆写入）基线测量并记录。
  - L3-3：性能测试不阻塞日常 CI，但有定期执行计划。
