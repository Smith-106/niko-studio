---
type: note
slug: harvest-analysis-circular-deps
title: Container 与 MCP 双向依赖 — 基础设施层依赖表示层
tags: architecture,circular-import,layer-violation
source: harvest
source_id: 20260527-review-G1-G6
fragment_id: HRV-b6c7d8e9
created: 2026-06-13
---

container/gateway-control-plane.ts:3 从 6 个 mcp 模块导入，mcp 也从 container 导入。层违规：基础设施依赖表示层。修复：将 control-plane 移到 container 和 mcp 之上的独立组合根模块。
