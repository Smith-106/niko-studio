---
name: gateway-env-robustness
description: Gateway URL 环境变量配置脆弱性分析与改进 — 已实施并推送
metadata:
  type: project
---

基于 2026-05-14 的 gateway 连接故障修复，分析并实施了 4 项改进（commit 426b19b）。

**Why:** `.env.local` 缺少 `VITE_` 前缀 + 端口错误导致前端无法连接 gateway，暴露了配置引导缺失、诊断日志不足、错误信息不具体等问题。
**How to apply:** 后续涉及 gateway 连接配置或 env 变量时，`.env.example` 为参考基线；`VITE_NIKO_GATEWAY_URL` 为唯一推荐变量名。

### 已实施

- **P1** `desktop/.env.example` — 说明 `VITE_` 前缀要求和 gateway URL 配置
- **P2** `gateway_runtime.rs` — env/override URL 不健康时输出 `[gateway]` 诊断日志
- **P3** `gateway/runtime.ts` — `buildFetchErrorResponse` 包含实际 gateway URL 和可操作提示
- **P4** `gateway_runtime.rs` — `VITE_NIKO_GATEWAY_URL` 提升为 Rust 端首选变量

### 涉及文件

- `desktop/.env.example`（新增）
- `desktop/src-tauri/src/gateway_runtime.rs`（P2 + P4）
- `desktop/src/api/gateway/runtime.ts`（P3）
