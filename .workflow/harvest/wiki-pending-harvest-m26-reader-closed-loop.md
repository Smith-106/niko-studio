---
type: spec
slug: harvest-m26-reader-closed-loop
title: 读者模拟闭环: 分析→模拟→修订→反馈
tags: reader,workflow,closed-loop
source: harvest
source_id: ANL-20260618-m26-p1-reader-simulation-anti-ai-flavor
date: 2026-06-20
---

M26 实现了读者模拟的完整闭环工作流：
1. **分析**: /reader/analyze 接收文本，DualEngine 并行运行 9 维度 + anti-AI-flavor 分析
2. **模拟**: PersonaDefinition 定义多种读者画像，模拟不同读者反应
3. **修订**: /reader/de-ai 通过 IRevisionService 重写，/reader/compare 做 A/B 对比
4. **反馈**: /reader/feedback 接收读者反馈并调整维度权重

数据流: fetch manuscript → DualEngine + anti-AI-flavor → ConsensusReport → MCP endpoints → frontend via reader.ts
