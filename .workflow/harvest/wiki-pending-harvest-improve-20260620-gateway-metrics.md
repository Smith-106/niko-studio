---
type: note
slug: harvest-improve-20260620-gateway-metrics
title: Gateway 启动链质量改进指标 — Critical 5→0
tags: gateway,improve,metrics,odyssey
source: 20260620-improve-odyssey-gateway-startup-chain
harvested: 2026-06-21
---

# Improvement Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Critical findings | 5 | 0 | ✅ -5 |
| High findings fixed | 0 | 6 | ✅ +6 |
| localhost-only guard enforcement | ❌ 未执行 | ✅ 403 拒绝 | ✅ 安全关键 |
| shutdown cleanup | ❌ no-op | ✅ container.shutdown() + WS close + rate limiter stop | ✅ 资源泄漏修复 |
| Ephemeral port safety | ❌ listener 未 drop | ✅ 显式 drop | ✅ 端口竞争修复 |
| Health probe latency (cold start) | ~6s+ 串行 | ~2s 并发 | ✅ -66% |
| CORS origins computation | 每请求 | 缓存 + reload 失效 | ✅ -100% 重复计算 |
| 500 error correlation | ❌ 无 requestId | ✅ 含 requestId | ✅ 可诊断性 |
| headersSent protection | ❌ 无检查 | ✅ 检查 + destroy | ✅ 防止二次写入异常 |
| unhandled rejection | ❌ 无 handler | ✅ 全局 handler | ✅ 防止静默崩溃 |
| WS upgrade fd leak | ❌ 挂起 | ✅ socket.destroy() | ✅ fd 泄漏修复 |
| Unit tests | 46 | 54 | ✅ +8 |
