---
type: note
slug: harvest-analysis-llmprovider-duplicate
title: 两个同名 LLMProvider 接口形状完全不同
tags: naming-conflict,LLMProvider
source: harvest
source_id: analysis-llmprovider-duplicate
fragment_id: HRV-e9f0a1b2
created: 2026-06-13
---

knowledge/models.ts:90 与 protocols/llm.ts:93 同名不同形，极易混淆。
