---
type: knowhow
slug: harvest-m26-dual-engine-extensibility
title: DualEngine 架构支持横向扩展新检测引擎
tags: architecture,reader,dual-engine
source: harvest
source_id: ANL-20260618-m26-p1-reader-simulation-anti-ai-flavor
date: 2026-06-20
---

M26 验证了 DualEngine + ConsensusEngine 架构的横向扩展能力。新增 anti-AI-flavor detector 作为独立引擎，通过 Promise.all 与既有 9 维度分析并行运行，输出合并到 ConsensusReport。

关键模式：
- `DualEngine.analyze()` 使用 `Promise.all([qualityAnalysis, aiFlavorAnalysis])`
- ConsensusEngine 接收任意数量的 engine 结果
- MCP endpoint 通过新增路由暴露，不影响既有 /reader/analyze 契约

参考文件：src-ts/reader/DualEngine.ts, src-ts/reader/ai-flavor-detector.ts
