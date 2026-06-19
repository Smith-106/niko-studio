---
slug: harvest-debug-20260614-debug-interface-gaps-rollout
title: 安全/上下文功能推广不完整是共同根因
type: note
tags: incomplete-rollout,security,context,root-cause,defense-in-depth
source: harvest
source_ref: 20260614-debug-interface-gaps
created_at: 2026-06-17T19:49:41.434Z
---

所有 5 个缺口共享共同模式：安全/上下文功能已应用于部分调用点但未全部推广。基础设施（validateEntityType、header 传输、workspace 上下文）已存在，只是未统一应用。
