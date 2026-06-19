---
type: knowhow
slug: harvest-m26-ai-templates-dedup
title: AI_TEMPLATE_PATTERNS 需跨模块去重提取
tags: ai-flavor,refactoring,pattern
source: harvest
source_id: REV-20260619-m26-p1-reader-simulation-anti-ai-flavor
date: 2026-06-20
---

Review MAINT-002 发现：AI 模板模式列表在 ai-flavor-detector.ts 和 revision-service.ts 中重复定义，且已分化（两个文件的列表内容不一致）。

推荐方案：提取共享 ai-templates.ts 模块，统一模式定义，两个消费者通过 import 引用。

影响：重复模式会导致 inconsistent de-AI 行为和膨胀的匹配计数 (CORR-002)。
