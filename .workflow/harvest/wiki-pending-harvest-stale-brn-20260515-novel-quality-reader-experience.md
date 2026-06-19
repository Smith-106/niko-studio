---
slug: harvest-stale-brn-20260515-novel-quality-reader-experience
title: Brainstorm: 6 directions for novel quality improvement and reader experience.
type: note
tags: harvest,stale,brainstorm,M23
source: harvest
source_ref: BRN-20260515-novel-quality-reader-experience
created_at: 2026-06-17T23:44:14.149Z
---

# Roadmap: Niko Studio M24 — Tech Debt Cleanup + Narrative Visualization

## Overview

M24 聚焦两大目标：(1) 清理 M10-M23 积累的 6 项技术债（console 收口、巨型组件拆分、类型安全加固、翻译模块化、catalog 外置、workflow-engine 重构），(2) 在稳定代码基础上交付叙事结构可视化 MVP。技术债采用"接口冻结"策略——所有重构保持公共 API 不变；workflow-engine 采用 Strategy 模式分层；craft-catalog 外置为 JSON 热加载。Phase 1 通过 wave DAG 内部分 3 批次执行（P1 基础设施 → P2 独立重构 → P2 深度重构），Phase 2 在稳定基础上构建新功能。

## Phases

**Minimum-phase principle:** Default 1 phase. Only add phases for hard dependencies (runtime + not parallelizable + full barrier). Wave DAG inside each phase handles task ordering.

- [x] **Phase 1: Tech Debt Cleanup** — F-001~F-006 技术债清理，3 波次递进执行 ✅ completed
- [x] **Phase 2: Narrative Visualization MVP** — F-007 叙事结构可视化核心功能 ✅ completed

## Phase Details

### Phase 1: Tech Debt Cleanup
