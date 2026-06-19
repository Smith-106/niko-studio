---
type: note
slug: harvest-analysis-deps-complex
title: better-sqlite3/fastembed/mammoth 二进制依赖复杂
tags: dependencies,binary,native,LLM-provider
source: harvest
source_id: analyze-project-audit-2026-05-01
fragment_id: HRV-g1h2i3j4
created: 2026-06-13
---

依赖维度评分 3/5。better-sqlite3 和 fastembed 需要 native 编译，mammoth 有二进制依赖。外部 LLM provider (OpenAI/Google) 为强依赖，provider 不可用时核心功能受影响。
