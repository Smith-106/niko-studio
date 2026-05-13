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
  - 必须存在 workflow / runtime / docs authority alignment 锚点（external release gate 执行、release summary P0 blocking、authority checker 本地入口）
  - 禁止回退到 legacy 假设（例如 `release_check_summary.py` 中 `from src.` / `--cov=src`）

## 3. fallback / rollback 入口

### Web fallback（removed）
- `src-ts/web/app.ts` has been removed from the codebase. The deprecated browser-first web entry is no longer present.

### 回滚入口
- 回滚手册：`docs/operations/ROLLBACK.md`
- external 回滚补充（Desktop/Gateway/Chat/Streamlit 兼容链路）：`docs/operations/ROLLBACK.md`

## 4. 发布前检查清单（脚本与 CI 映射）

### 本地检查
1. 版本一致性：`python scripts/check_versions.py`
2. 交付语义门禁：`python scripts/delivery_gate.py`
3. 治理脚本回归：`python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q`
4. 发布汇总：`python scripts/release_check_summary.py`
5. 权威对齐检查：`python scripts/check_authority_alignment.py`
6. TS 覆盖率基线：`npm --prefix src-ts run test:coverage:phase4`
7. Desktop sidecar 构建：`npm --prefix desktop run build:sidecar`
8. Desktop sidecar 契约校验：`npm --prefix desktop run validate:sidecar-contract`
9. Desktop 统一检查：`npm --prefix desktop run check`
10. 前端依赖审计：`npm --prefix desktop audit --audit-level=high`

### CI 观察点
- External authority workflow：`.github/workflows/external-release-gate.yml`
- `gate` job：version + delivery gate + TS coverage baseline + external smoke + desktop sidecar readiness + authority alignment + production guard
- `authority-alignment-advisory` job：workflow/runtime/docs 权威漂移观察信号与 `authority-alignment-report` artifact
- `authority-alignment-hard-fail` job：main 分支对 authority alignment 的阻断验证
- `governance-scripts-report-*` artifact：治理脚本回归测试的 junit 结果
- `coverage-xml` artifact：始终由 external release workflow 上传；Codecov 上传是否执行仅影响外部上传，不影响本地 artifact 留档
- `ci-diagnostics-desktop-build-linux-deps-log` artifact：`desktop-build` 的 Linux 系统依赖安装日志
- `ci-diagnostics-desktop-packaging-advisory-log` artifact：Windows 打包 advisory 干跑日志
- `ci-diagnostics-packaged-app-smoke-report` / `ci-diagnostics-packaged-app-smoke-build-log` artifact：Windows 打包 smoke 的结构化结果与 NSIS 构建日志
- `desktop-build` / 其他 CI：作为补充观察点，不替代 external release authority；优先从 `ci-diagnostics:*` summary 与对应 artifact 进入排障

## 5. 单命令可见化入口

- `python scripts/release_check_summary.py`
- 输出文件：`release-check-summary.md`
- 发布机读产物：`.workflow/evidence/release/release-readiness-artifact.json`

## 6. 本地密钥卫生（Local Secrets Hygiene）

### 永远不要提交真实密钥
- `.env` 已写入根目录 `.gitignore`，禁止移除该规则。
- `.env.example` 仅示意所需环境变量名，**不要**填入真实值。
- 真实密钥仅放置在本地 `.env` 或操作系统密钥库 / CI Secret store。

### 应急轮换（Key Rotation）
如果意外把真实 `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` 等密钥提交到 git 或粘贴到任何外部位置：
1. **立即轮换**：登录对应控制台撤销旧密钥并生成新密钥
   - OpenAI：<https://platform.openai.com/api-keys>
   - Anthropic：<https://console.anthropic.com/settings/keys>
   - Google：<https://console.cloud.google.com/apis/credentials>
2. 用新密钥更新本地 `.env`。
3. 如果旧密钥已经进入 git 历史，仅 `git filter-repo` / `git filter-branch` 清理历史是不够的——必须**先**完成轮换；任何已分发的提交副本都必须视为已暴露。

### 其它锚点
- `.env.example` 头部已包含同样的 ROTATE-KEY 提醒（避免开发者只读 docs 错过该约束）。
- CI 不应把真实密钥写入 build artifact 或 log；如需 LLM 集成测试，使用 GitHub Actions Secrets 注入。
