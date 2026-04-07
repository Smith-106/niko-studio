# SECURITY VISIBILITY

本页用于集中呈现安全相关“事实锚点”，避免分散描述。

## 1. 运行时守卫（reload / CORS / metrics）

### reload 守卫（TypeScript authority）
- 生产环境强制关闭 reload：`src-ts/mcp/config.ts` -> `resolveReloadEnabled()` 中 `if (isProductionEnv()) return false;`
- 发布汇总门禁会直接检查该锚点：`scripts/release_check_summary.py` -> `_typescript_production_guard()`

### CORS 守卫（TypeScript authority）
- 生产环境 CORS 白名单解析：`src-ts/mcp/config.ts` -> `resolveCorsOrigins()`
- 生产环境禁止 `*` / localhost：`src-ts/mcp/config.ts` -> `forbidden` 集合过滤
- 生产环境白名单为空直接抛错：`src-ts/mcp/config.ts` -> `Production CORS origins are empty`
- 发布汇总门禁会直接检查上述锚点：`scripts/release_check_summary.py` -> `_typescript_production_guard()`

### metrics 守卫（TypeScript authority）
- `/metrics` 端点守卫：`src-ts/mcp/endpoints/health.ts` -> `metricsEndpoint()`
- `gateway.metrics_enabled` 禁用时返回 404：`src-ts/mcp/endpoints/health.ts`
- `/metrics` 路由注册：`src-ts/gateway-server.ts`
- 发布汇总门禁会直接检查上述锚点：`scripts/release_check_summary.py` -> `_typescript_metrics_guard()`

## 2. 构建与验证门禁

### TS / Desktop 质量入口
- TS 官方验证面：`src-ts/package.json` -> `test:phase4` / `test:coverage:phase4`
- Desktop 统一质量入口：`desktop/package.json` -> `check = typecheck + build`
- Desktop sidecar 构建入口：`desktop/package.json` -> `build:sidecar`

### 交付语义门禁
- 交付语义脚本：`scripts/delivery_gate.py`
- 门禁覆盖：
  - 必须存在 TS/desktop 权威锚点（workflow hard gate、chat/metrics 路由、phase4 验证入口）
  - 禁止回退到 legacy 假设（例如 `release_check_summary.py` 中 `from src.` / `--cov=src`）

## 3. fallback / rollback 入口

### Web fallback（deprecated）
- `src-ts/web/app.ts` 根路径默认 `410`，仅在 `WEB_UI_FORWARD_URL` 存在时 `302` 转发

### 回滚入口
- 回滚手册：`docs/operations/ROLLBACK.md`
- external 回滚补充（Desktop/Gateway/Chat/Streamlit 兼容链路）：`docs/operations/ROLLBACK.md`

## 4. 发布前检查清单（脚本与 CI 映射）

### 本地检查
1. 版本一致性：`python scripts/check_versions.py`
2. 交付语义门禁：`python scripts/delivery_gate.py`
3. 发布汇总：`python scripts/release_check_summary.py`
4. TS 覆盖率基线：`npm --prefix src-ts run test:coverage:phase4`
5. Desktop sidecar 构建：`npm --prefix desktop run build:sidecar`
6. Desktop sidecar 契约校验：`npm --prefix desktop run validate:sidecar-contract`
7. Desktop 统一检查：`npm --prefix desktop run check`
8. 前端依赖审计：`npm --prefix desktop audit --audit-level=high`

### CI 观察点
- External authority workflow：`.github/workflows/external-release-gate.yml`
- `gate` job：version + delivery gate + TS coverage baseline + production guard + external smoke + desktop sidecar readiness
- `coverage-xml` artifact：始终由 external release workflow 上传；Codecov 上传是否执行仅影响外部上传，不影响本地 artifact 留档
- `desktop-build` / 其他 CI：作为补充观察点，不替代 external release authority

## 5. 单命令可见化入口

- `python scripts/release_check_summary.py`
- 输出文件：`release-check-summary.md`
- 发布机读产物：`.workflow/evidence/release/release-readiness-artifact.json`
