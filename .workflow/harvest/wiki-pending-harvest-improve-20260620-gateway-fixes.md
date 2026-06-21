---
type: note
slug: harvest-improve-20260620-gateway-fixes
title: Gateway 启动链 5 个 EG 修复 + 11 项质量改进
tags: gateway,debug,improve,odyssey,fixed
source: 20260620-improve-odyssey-gateway-startup-chain
harvested: 2026-06-21
---

# Debug 修复（5 项 EG）

| EG | 修复 | 验证 |
|----|------|------|
| EG-17 | listen() 添加 server error 事件 | TS 编译 + 8 tests |
| EG-08 | kill() 后 OpenProcess 轮询 | Rust cargo check |
| EG-21 | Number.isFinite(port) 替代 NaN | TS 编译 |
| EG-23 | parseIntSafe() 替代 6 处 parseInt | TS 编译 |
| EG-15 | createDefaultConfigFile try-catch | TS 编译 |

# Improve 改进（11 项）

- C2: drop(listener) 释放 ephemeral 端口
- C5: shutdownGatewayControlPlane 实际清理资源
- C1+H1: tokio::join! 并发 health probe + 共享 reqwest::Client
- C3: localhost-only guard 中间件 (403 拒绝非本地)
- H5: CORS origins 缓存 + invalidateCorsCache()
- H16: unhandledRejection + uncaughtException 全局处理器
- H25: 500 响应包含 requestId
- H20: headersSent 检查，流式响应 destroy
- Rate limiter stop on shutdown
- WS upgrade 非 /ws/events 路径 socket.destroy()
- Bootstrap shutdown 链完善
