---
slug: harvest-analysis-20260614-review-frontend-backend-interface-workspace
title: Workspace 上下文 3 种不同追加模式需统一
type: note
tags: workspace,architecture,inconsistency,unification,api-module
source: harvest
source_ref: 20260614-review-frontend-backend-interface
created_at: 2026-06-17T19:49:41.434Z
---

前端 API 模块使用 3 种不同的 workspace 追加模式：appendWorkspacePayload、appendLegacyChatWorkspacePayload、appendLegacyMemoryWorkspacePayload。后端需处理 3 种不同 payload 形状。
