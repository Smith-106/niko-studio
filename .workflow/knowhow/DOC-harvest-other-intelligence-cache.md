---
title: IntelligenceService content-hash 缂撳瓨閬垮厤鍐椾綑 API 璋冪敤
createdBy: harvest
---
---
type: knowhow
slug: harvest-other-intelligence-cache
title: IntelligenceService content-hash 缓存避免冗余 API 调用
tags: intelligenceService,caching,content-hash
source: harvest
source_id: m10-phase1
fragment_id: HRV-d6e7f8a9
created: 2026-06-13
---

intelligenceService.ts 基于 content hashes (hashContent) 实现缓存。结果存储在 projects/{id}/analysis/{module}.json。analyzeProject 管理章节集的完整分析生命周期。
