# SECURITY VISIBILITY

本页用于集中呈现安全相关“事实锚点”，避免分散描述。

## 1. 运行时守卫（reload / CORS / metrics）

### reload 守卫
- 生产环境强制关闭 reload：`src/mcp/gateway.py:99`、`src/mcp/gateway.py:100`
- 启动脚本在 production 下忽略 `--reload`：`scripts/start_gateway.py:70`

### CORS 守卫
- CORS 来源解析与生产白名单过滤：`src/mcp/gateway.py:122`、`src/mcp/gateway.py:137`
- 生产环境禁止 `*` 与 localhost；为空直接报错：`src/mcp/gateway.py:138`、`src/mcp/gateway.py:141`
- 启动阶段生产白名单为空直接退出：`scripts/start_gateway.py:79`、`scripts/start_gateway.py:81`

### metrics 守卫
- 指标中间件与统计：`src/mcp/gateway.py:148`、`src/mcp/gateway.py:160`
- `/metrics` 端点注册：`src/mcp/gateway.py:366`

## 2. 构建与依赖审计门禁

### 前端统一质量入口
- 统一入口：`desktop/package.json:9`（`check = typecheck + build`）
- 构建命令：`desktop/package.json:10`

### CI 门禁（Integration Tests）
- 安装依赖：`.github/workflows/integration-tests.yml:73`
- 高危依赖审计：`.github/workflows/integration-tests.yml:77`
- 前端统一检查入口（check）：`.github/workflows/integration-tests.yml:81`

### 版本与交付语义门禁
- 版本一致性：`scripts/check_versions.py:43`
- 交付语义门禁：`scripts/delivery_gate.py:46`

## 3. fallback / rollback 入口

### Web fallback（deprecated）
- `src-ts/web/app.ts` 根路径默认 `410`，仅在 `WEB_UI_FORWARD_URL` 存在时 `302` 转发：`src-ts/web/app.ts:154`、`src-ts/web/app.ts:163`

### 回滚入口
- 回滚手册：`docs/operations/ROLLBACK.md:1`
- external 回滚补充（Desktop/Gateway/Chat/Streamlit 兼容链路）：`docs/operations/ROLLBACK.md:52`

## 4. 发布前检查清单（脚本与 CI 映射）

### 本地检查
1. 版本一致性：`python scripts/check_versions.py`
2. 交付语义门禁：`python scripts/delivery_gate.py`
3. 发布汇总：`python scripts/release_check_summary.py`
4. 前端依赖安装：`npm --prefix desktop ci`
5. 前端统一检查：`npm --prefix desktop run check`
6. 前端依赖审计：`npm --prefix desktop audit --audit-level=high`

### CI 观察点
- Workflow：`Integration Tests`
- `tests` job：version + delivery gate
- `desktop-build` job：install + audit(high+) + check
- `external-*` gate：external 发布附加门禁

## 5. 单命令可见化入口

- `python scripts/release_check_summary.py`
- 输出文件：`release-check-summary.md`
- CI 事实来源：`scripts/release_check_summary.py:167`
