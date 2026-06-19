---
type: knowhow
slug: harvest-m26-de-ai-revision-service
title: De-AI rewrite 通过 IRevisionService 注入
tags: reader,revision,pattern
source: harvest
source_id: ANL-20260618-m26-p1-reader-simulation-anti-ai-flavor
date: 2026-06-20
---

M26 的 De-AI / 风格变换重写功能复用了 M25 建立的 IRevisionService，通过 `revise()` 注入 qualityGoals（如 anti-ai、style-shift）实现重写，而非在 reader 模块引入独立的 LLM writer。

关键决策理由：
- 保持 reader 模块只读分析职责
- 复用 revision 循环的迭代机制和 session tracking
- MCP endpoint /reader/de-ai 调用 RevisionService.revise 并传入 De-AI 目标

参考文件：src-ts/services/revision-service.ts, src-ts/protocols/revision.ts
