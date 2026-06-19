---
slug: harvest-debug-20260614-debug-interface-gaps-defense
title: 纵深防御原则被违反
type: note
tags: defense-in-depth,security,service-layer,header-pattern,validation
source: harvest
source_ref: 20260614-debug-interface-gaps
created_at: 2026-06-17T19:49:41.434Z
---

validateEntityType 仅应用于前端组件层，未应用于 service 层；header 传输模式未应用于 writing-craft.ts。纵深防御要求边界层和核心层都应有防护。
