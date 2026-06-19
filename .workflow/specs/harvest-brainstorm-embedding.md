---
title: Embedding 鏂规锛歜ge-small-zh-v1.5 + sqlite-vec
createdBy: harvest
---
---
type: spec
slug: harvest-brainstorm-embedding
title: Embedding 方案：bge-small-zh-v1.5 + sqlite-vec
tags: obsidian-integration,embedding,vector-search
source: harvest
source_id: 20260528-brainstorm-obsidian-knowledge-integration
fragment_id: HRV-d2e3f4a5
created: 2026-06-13
---

Embedding: onnxruntime-node + bge-small-zh-v1.5 (24MB, 384 维)。向量存储: sqlite-vec 扩展 (~5ms@10k, 与现有 SQLite 一致)。检索管线: Vector Search topK=20 + FTS5 topK=20 → RRF Fusion → MMR Rerank。增量索引: 监控 vault 变更 → hash 比较 → 仅对变更笔记 re-chunk+embed+upsert。
