# RELEASE NOTES

## 发布级别矩阵

| 级别 | 用途 | e2e 冒烟 | Codecov 上传失败 | 结论 |
|---|---|---|---|---|
| internal | 内部 dry-run / 日常集成验证 | 可跳过 | 告警，不阻断 | 用于内部验证 |
| external | 对外交付 / 正式发布 | 必须通过 | 有 `CODECOV_TOKEN` 时阻断；无 token 时告警并登记风险 | 满足 Go/No-Go 条件后放行 |

## External 发布准入条件（Go/No-Go）

满足以下全部条件方可 Go：

1. 版本一致性通过：

```bash
python scripts/check_versions.py
```

2. 交付语义门禁通过：

```bash
python scripts/delivery_gate.py
```

3. TypeScript Phase 4 基线与覆盖率门禁通过：

```bash
npm --prefix src-ts run test:coverage:phase4 -- --coverage.reporter=text --coverage.reporter=json --coverage.reporter=html --coverage.reporter=cobertura
```

4. external 冒烟通过（external 必选）：

```bash
npm --prefix src-ts exec -- vitest run tests/mcp/workflow-endpoints.integration.test.ts tests/mcp/workflow-critic-smoke.integration.test.ts --reporter=default
```

> 约定：external 冒烟以当前 `src-ts` MCP workflow/critic integration tests 为主，而不是缺失的 legacy Python `tests/integration/test_e2e_workflow.py`。

5. 质量信号完整：覆盖率报告生成并上传成功，并且 CI 产出 `coverage-xml`、`vitest-production-guard-*`、`vitest-e2e-report-*` 工件可追溯。
   - external 场景下：当已配置 `CODECOV_TOKEN` 且 `codecov_fail_ci_if_error=true` 时，Codecov 上传失败为 No-Go；当缺失 token 时允许降级并输出告警，必须在发布记录中登记风险。

6. Desktop sidecar readiness 通过：

```bash
npm --prefix desktop run build:sidecar
npm --prefix desktop run validate:sidecar-contract
```

7. 生产安全配置与可观测守卫通过：`env=production` 时 CORS 白名单必须为真实域名，禁止 `*` 与 localhost 占位，`reload` 必须关闭，且 `gateway.metrics_enabled=true`。

```bash
npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts --reporter=default
```

8. 回退预案已确认：`docs/operations/ROLLBACK.md` 中 external 回退触发与验证项均可执行。

9. 发布检查汇总完成：

```bash
python scripts/release_check_summary.py
```

> 说明：`release-check-summary.md` 属于本地检查快照；external 是否放行以 CI workflow 结果为准。

## external 口径对齐说明（新增）

external 对外“100% 完成度”仅指核心可达链路：

1. Desktop 主入口可达：`Knowledge` / `Settings` / `Evaluation`，且本地 Gateway 运行态可恢复。
2. Chat 默认流式：优先 `/chat/stream`，失败自动降级 `/chat`。
3. Streamlit 仅作为兼容验证路径：若当前发布候选包含该路径，tab4/tab5 仍需保持组件渲染（`scene_dashboard`），但它不是主交付入口。

补充说明：

- Desktop 运行时当前默认优先 Node/TypeScript Gateway，并保留显式 Python override/fallback。
- sidecar 打包链与运行时选择不是同一层语义：构建/打包仍可按 `NIKO_GATEWAY_RUNTIME` 选择 Python 或 Node 产物。

证据链建议在同一次发布中保留：

- TypeScript Phase 4 基线日志：`npm --prefix src-ts run test:coverage:phase4 -- --coverage.reporter=text --coverage.reporter=json --coverage.reporter=html --coverage.reporter=cobertura`
- external 冒烟日志：`npm --prefix src-ts exec -- vitest run tests/mcp/workflow-endpoints.integration.test.ts tests/mcp/workflow-critic-smoke.integration.test.ts --reporter=default`
- production guard 日志：`npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts --reporter=default`
- Desktop sidecar 构建日志：`npm --prefix desktop run build:sidecar`
- Desktop sidecar 契约日志：`npm --prefix desktop run validate:sidecar-contract`
- 发布汇总输出：`python scripts/release_check_summary.py`

### internal（dry-run）

1. 确认工作区干净并记录当前 commit。
2. 执行版本一致性、交付语义门禁、TypeScript Phase 4 基线与 Desktop sidecar 检查。
3. 记录产物版本与测试结果。

### external（正式交付）

1. 执行 internal 全部步骤。
2. 执行 e2e 冒烟。
3. 确认质量信号完整（覆盖率 + CI 关键信号）。
   - 若已配置 `CODECOV_TOKEN`，按 strict 模式执行并将上传失败判定为 No-Go。
   - 若缺失 `CODECOV_TOKEN`，允许降级为告警，但必须在发布验收记录中注明该风险。
4. 验证 production guard（CORS / reload / metrics）通过。
5. 核对回退预案与回滚验证路径。
6. 评审 Go/No-Go 并登记结果。

## 验收记录模板

- 发布级别：internal / external
- 发布版本：
- 对应 commit：
- 版本一致性检查：通过 / 失败
- 交付语义门禁：通过 / 失败
- 基线测试与覆盖率：
- e2e 冒烟（external 必填）：通过 / 失败 / 跳过（internal）
- 质量信号完整性（覆盖率上传、CI 关键步骤）：完整 / 不完整
- 生产守卫（CORS / reload / metrics）：通过 / 失败
- 回退预案确认：是 / 否
- 结论：Go / No-Go
