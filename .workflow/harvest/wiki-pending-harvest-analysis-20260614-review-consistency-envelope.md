---
slug: harvest-analysis-20260614-review-consistency-envelope
title: 系统性问题：前端类型信封不一致
type: note
tags: systemic-issue,envelope-pattern,callapi,frontend-type,api-contract
source: harvest
source_ref: 20260614-review-consistency
created_at: 2026-06-17T19:49:41.434Z
---

前端类型 inconsistently 应用内层 {success, data: T} 信封。callApi 已提供外层封装，正确模式是 ApiResponse<T> 其中 T = 原始后端 body 形状。
