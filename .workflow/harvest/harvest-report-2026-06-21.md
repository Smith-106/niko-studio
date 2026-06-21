# Harvest Report — 2026-06-21

## Source

- **Source 1**: 20260620-debug-odyssey-nsis-install-file-lock (debug/odyssey)
- **Source 2**: 20260620-improve-odyssey-gateway-startup-chain (improve/odyssey)

## 摘要

| 指标 | 数值 |
|------|------|
| 扫描 artifact | 2 |
| 提取片段 | 23 |
| 重复跳过 | 0 |
| 实际路由 | 23 |
| Wiki pending | 3 |
| Spec 条目 | 11 |
| Issue 条目 | 9 |

## Wiki Pending（3）

| 文件 | 标题 |
|------|------|
| `wiki-pending-harvest-debug-20260620-startup-chain-root-cause.md` | 启动链三层根因叠加：CommandChild+listen()+parseIntNaN |
| `wiki-pending-harvest-improve-20260620-gateway-fixes.md` | Gateway 5 个 EG 修复 + 11 项质量改进 |
| `wiki-pending-harvest-improve-20260620-gateway-metrics.md` | Gateway 启动链质量改进指标 Critical 5→0 |

## Spec 条目（11）

| 分类 | 标题 | 目标文件 |
|------|------|----------|
| coding | parseInt NaN 语义陷阱 — NaN 通过范围校验 | `specs/coding-conventions.md` |
| coding | 并发健康检查减少冷启动延迟 | `specs/coding-conventions.md` |
| coding | HTTP handler headersSent 检查 | `specs/coding-conventions.md` |
| coding | CORS 缓存 + config reload 时 invalidate | `specs/coding-conventions.md` |
| debug | Tauri CommandChild 无 wait() — kill 后须轮询 PID | `specs/debug-notes.md` |
| debug | 同步文件操作无 try-catch 保护 | `specs/debug-notes.md` |
| debug | localhost-only guard 配置-执行两步必须同步 | `specs/debug-notes.md` |
| learning | Node.js listen() 不监听 error 导致静默挂起 | `specs/learnings.md` |
| learning | C4 set*() DI 重构 deferred | `specs/learnings.md` |
| learning | gateway-state.ts god module 拆分 deferred | `specs/learnings.md` |
| arch | shutdown-no-op 反模式 | `specs/architecture-constraints.md` |
| arch | 独立 SIGTERM handler 应统一到 shutdown 链 | `specs/architecture-constraints.md` |

## Issue 条目（9）

| ID | 标题 | 严重度 | 优先级 |
|----|------|--------|--------|
| ISS-20260621-001 | Config endpoint 可修改 localhost-only guard | high | 2 |
| ISS-20260621-002 | Secret endpoint 无认证走 HTTP | high | 2 |
| ISS-20260621-003 | WebSocket relay 无认证无 origin 校验 | high | 2 |
| ISS-20260621-004 | Admin endpoints 无认证 | high | 2 |
| ISS-20260621-005 | CORS wildcard 反射 Origin 头 | medium | 3 |
| ISS-20260621-006 | 默认 host 0.0.0.0 绑定所有接口 | medium | 3 |
| ISS-20260621-007 | health endpoint 返回 200 即使 degraded | medium | 3 |
| ISS-20260621-008 | 5 个 _initSchema deferred 缺 try-catch | low | 4 |
| ISS-20260621-009 | prewarm 失败丢弃已有健康服务 | medium | 3 |

位置：`.workflow/issues/issues.jsonl`

## 元数据

- 执行时间：2026-06-21
- source：`harvest`
- harvest-log：`.workflow/harvest/harvest-log.jsonl`（新增 24 条 provenance 记录）

## 下一步建议

1. 审阅新增 issue：`/manage-issue list --source harvest`
2. 加载最新 spec：`/spec-load --role implement`
3. 连接 wiki 图谱：`/manage-wiki connect --fix`
4. 做全周期回顾：`/quality-retrospective`
