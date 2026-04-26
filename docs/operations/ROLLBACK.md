# ROLLBACK RUNBOOK

## 回退目标契约

本 runbook 的回退目标与根 README / release notes 共享同一交付契约。

- `Supported runtime`: `desktop/` + Tauri host + local `src-ts/` Node/TypeScript gateway. This is the shipped product, default build, and default runtime path.
- `Supported launcher`: `python scripts/start_gateway.py` remains an operator-facing entrypoint, but in the current checkout it starts the Node/TypeScript gateway by default.
- `Advisory compatibility surfaces`: explicit `--runtime python` legacy override, legacy `src/mcp/**` sources, and Streamlit validation flows only when a release candidate explicitly includes them.
- `Deprecated surface` (removed): browser-first web entry has been removed from the codebase.

## 回退触发条件

满足以下任一条件立即触发回退：

- 发布后核心流程不可用（启动失败、接口不可达）。
- 测试基线回归（关键用例失败）。
- 配置变更导致环境无法初始化。
- external 发布后出现关键依赖异常（`/health` 总状态为 `degraded` 且不可快速恢复）。

## 回退步骤

1. 定位上一个稳定版本 commit/tag。
2. 回退代码到稳定版本。
3. 恢复对应配置（包含 `.env` 与部署配置）。
4. 重新安装依赖并启动服务。

## 回退后验证

1. 版本检查：

```bash
python scripts/check_versions.py
python scripts/delivery_gate.py
python scripts/check_authority_alignment.py
```

2. 健康检查与生产守卫：

```bash
npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts --reporter=default
```

3. 端点验证：

- `GET /health`：状态恢复为 `healthy`。
- `GET /metrics`：指标可访问（或明确按配置关闭）。
- `GET /tools`、`POST /chat`：关键入口可用。

4. 最小测试回归：

```bash
npm --prefix src-ts run test:coverage:phase4 -- --coverage.reporter=text
npm --prefix desktop run build:sidecar
npm --prefix desktop run validate:sidecar-contract
npm --prefix desktop run validate:package:dry-run
```

5. external 场景附加验证：

```bash
npm --prefix src-ts exec -- vitest run tests/mcp/workflow-endpoints.integration.test.ts tests/mcp/workflow-critic-smoke.integration.test.ts --reporter=default
python scripts/release_check_summary.py
```

- e2e 冒烟可重新执行并通过。
- 覆盖率与关键质量信号完整可见。

## external 回滚补充（入口/流式/UI 组件化）

若发布后出现以下任一情况，执行本节回滚：

- Sidebar 入口失效（无法打开 Knowledge/Settings/Evaluation）。
- Chat 流式异常且未成功降级，导致响应不可用或消息丢失。
- Desktop 本地 Gateway 启动失败，且 `Supported local runtime` 的 Node-first 路径到 packaged Python compatibility fallback 仍无法恢复。
- Streamlit 兼容路径若在当前发布候选中启用，tab4/tab5 组件化渲染异常，影响场景看板查看。

建议回滚步骤：

1. 回退到上一个稳定 commit/tag。
2. 启动后先做核心链路验证：
   - Desktop：Sidebar 三入口可打开并关闭。
   - Gateway：先确认 `Supported local runtime` 的 Node-first 路径可恢复，再确认 packaged desktop 仍能退回到 bundled Python compatibility sidecar。
   - Chat：发送一条消息，确认至少非流式路径可用。
   - Streamlit：仅在当前候选包含 `Advisory compatibility surfaces` 时，验证 tab4/tab5 可正常展示场景看板。
3. 再执行本 runbook 的通用健康检查与测试回归。

- 回退触发原因：
- 回退目标版本：
- 回退执行人：
- `/health` 验证结果：
- `/metrics` 验证结果：
- 测试回归结果：
- 是否恢复服务：是 / 否
