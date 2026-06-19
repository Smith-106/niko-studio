---
slug: harvest-stale-brn-20260602-writing-tool-new-capabilities
title: Brainstorm: writing tool new capabilities — AI co-writing engine, reader simulation, multi-modal story intelligence. 4 r
type: note
tags: harvest,stale,brainstorm,none
source: harvest
source_ref: BRN-20260602-writing-tool-new-capabilities
created_at: 2026-06-17T23:44:14.149Z
---

# Guidance Specification: 写作工具新能力探索

## §1. Project Positioning & Goals

**Problem**: niko-studio 已具备成熟的写作分析能力（结构、节奏、角色、对话等）和叙事可视化，但缺乏 AI 驱动的主动创作辅助能力。用户需要从"被动分析"升级到"AI 共创"体验。

**Goal**: 在现有知识引擎 + MCP 架构基础上，构建三个用户可感知的 AI 驱动写作能力——AI 共创引擎、读者模拟面板、多模态故事智能——形成差异化竞争优势。

**Success Criteria**:
- AI 共创引擎支持 Auto/Guided/Directed 三种模式
- 读者模拟支持预设 + 自定义角色，覆盖 4 个检查维度
- 所有新能力通过 MCP 端点统一暴露
- MVP 阶段交付共创 + 读者模拟双能力

## §2. Concepts & Terminology

| Term | Definition | Aliases | Category |
|------|-----------|---------|----------|
| Knowledge Engine | 现有写作知识引擎，含 MCP 端点、分析服务、检测器 | KE | core |
| MCP Endpoint | Model Context Protocol 端点，服务间通信接口 | — | technical |
| Story Bible | 结构化故事知识库，含角色/世界观/情节线/时间线实体 | SB, 故事知识库 | core |
| Co-Writing Engine | AI 共创引擎，支持 Auto/Guided/Directed 三种模式 | CWE | core |
| Reader Simulat
