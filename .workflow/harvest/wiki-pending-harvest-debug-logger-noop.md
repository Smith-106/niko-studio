---
type: knowhow
slug: harvest-debug-logger-noop
title: Logger isDev-based noop 模式
tags: logger,production-silence,isDev-noop
source: harvest
source_id: 20260525-test-P1-tech-debt-cleanup
fragment_id: HRV-a1b2c3d4
created: 2026-06-13
---

Logger 模块使用 isDev-based noop 模式：console.log/warn/debug/info 通过 logger 在生产无输出。logger.error 仍输出。已通过用户确认和 logger.ts 代码检查验证。
