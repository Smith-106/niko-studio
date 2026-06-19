---
type: note
slug: harvest-analysis-gatewaydeps-isp
title: GatewayDeps 违反接口隔离原则 — 15+ 方法胖接口
tags: architecture,ISP,fat-interface
source: harvest
source_id: 20260527-review-G1-G6
fragment_id: HRV-c7d8e9f0
created: 2026-06-13
---

health.ts:21 GatewayDeps 强迫每个消费者依赖不使用的方法。每个端点只需 3-5 方法但必须实现全部 15+。修复：拆分为 HealthEngineAccess/RuntimeStateAccess/ServiceRegistryAccess/ObservabilityAccess/MetricsAccess/ConfigAccess 等聚焦子接口。
