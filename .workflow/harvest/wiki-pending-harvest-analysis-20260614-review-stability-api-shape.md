---
slug: harvest-analysis-20260614-review-stability-api-shape
title: API 形状变更需同步更新四方
type: note
tags: api-shape,synchronization,frontend,backend,test-mock
source: harvest
source_ref: 20260614-review-stability
created_at: 2026-06-17T19:49:41.434Z
---

API 形状变更需要同步更新：前端类型、后端 endpoint、容器适配器、测试 mock。任一遗漏都会导致运行时错误或测试失败。
