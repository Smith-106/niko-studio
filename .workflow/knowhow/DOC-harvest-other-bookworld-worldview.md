---
title: BookWorld worldview extraction 鏄犲皠鍒?knowledge-service
createdBy: harvest
---
---
type: knowhow
slug: harvest-other-bookworld-worldview
title: BookWorld worldview extraction 映射到 knowledge-service
tags: BookWorld,worldview-extraction,knowledge-service
source: harvest
source_id: 20260507-analysis-P1
fragment_id: HRV-a7b8c9d0
created: 2026-06-13
---

BookWorld worldview_data_extraction 映射到 src-ts/knowledge/manager.ts, knowledge-service.ts, wiki MCP endpoint。流程：chunk → atomic facts → filter → cluster → terminology。提取 term/nature/detail/source 注入 Agent prompts。Effort: medium, risk: low。
