---
type: knowhow
slug: harvest-debug-20260620-startup-chain-root-cause
title: 启动链三层根因叠加：CommandChild+listen()+parseIntNaN
tags: gateway,root-cause,startup,odyssey
source: 20260620-debug-odyssey-nsis-install-file-lock
harvested: 2026-06-21
---

# 启动链三层根因叠加

Niko-Studio Desktop 启动链存在三类根因导致"运行出错"：

1. **静默失败**（最难诊断）— listen() 挂起、kill() 未 wait、NaN 通过校验 → 已修复
2. **未捕获异常**（最易崩溃）— createDefaultConfigFile 无 try-catch → 已修复
3. **降级无通知**（用户体验差）— onError 可选、Mutex poison 无日志、global config 解析失败静默 → 待泛化扫描

**根因确认**：Tauri `CommandChild` API 缺失 `wait()` + Node.js `listen()` 错误传播缺失 + `parseInt` NaN 语义陷阱，三者叠加导致启动链在异常条件下静默挂起或崩溃，用户无法诊断。

## 修复清单

| EG | 文件 | 修复 |
|----|------|------|
| EG-17 | gateway-bootstrap.ts | `listen()` 添加 server error 事件 + EADDRINUSE reject |
| EG-08 | gateway_runtime.rs | kill() 后 OpenProcess 轮询 PID 确保进程退出 |
| EG-21 | config/index.ts | `!Number.isFinite(port)` 替代 NaN 比较 |
| EG-23 | config/index.ts | `parseIntSafe()` 替代 6 处 `parseInt()` |
| EG-15 | config/index.ts | `createDefaultConfigFile()` 包裹 try-catch |
