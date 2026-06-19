---
type: knowhow
slug: harvest-m26-reader-coverage-baseline
title: M26 Reader 模块测试覆盖率 98.67% 基线
tags: test-coverage,reader,baseline
source: harvest
source_id: TST-20260619-m26-p1-reader-simulation-anti-ai-flavor
date: 2026-06-20
---

M26 Phase 1 UAT 测试基线数据：
- 整体覆盖率 98.67%
- src-ts: 776 test files, 5795 tests passed; reader/mcp 模块 statements 83.38%, branches 91.53%
- desktop: 407 test files, 3273 tests passed; reader API 100%, reader 组件 97.07%
- 所有 R-M26-001~006 需求已覆盖测试场景
- 2 个 accepted risk: CORR-003 (除零), SEC-003 (HTTPS/timeout)

环境说明：desktop e2e 测试因中文路径编码问题排除，与 M26 改动无关。
