---
slug: harvest-analysis-20260616-test-coverage-store
title: Store 层是最大测试风险点
type: note
tags: store,test-coverage,regression,companion-pattern,risk
source: harvest
source_ref: 20260616-analyze-test-coverage
created_at: 2026-06-17T19:49:41.434Z
---

Store 层 5 个核心 slice 零覆盖 + 9 个浅层测试是最大风险点。skillsSlice 近期修过 CORR-001/007 一致性 bug 但无回归保护。companion test pattern 是最有效的覆盖率提升策略。
