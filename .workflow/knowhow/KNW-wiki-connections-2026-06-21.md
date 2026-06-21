---
related:
  - "knowhow-knw-wiki-connections-2026-06-17"
  - "knowhow-knw-wiki-connections-2026-06-18"
---
# Wiki Connections — 2026-06-21

## Baseline

- Health: 28
- Orphans: 48
- Broken links: 12
- Entries: 137

## Suggestions (20)

| # | Score | Source | Target | Reason |
|---|---|---|---|---|
| 1 | 0.92 | knowhow-doc-harvest-other-bookworld-ablation | spec:project:learnings-005 | tag overlap (BookWorld,ablation) + type bridge |
| 2 | 0.92 | spec:project:harvest-brainstorm-m24-scope | spec:project:architecture-constraints-001 | M24 scope — same concept, type bridge |
| 3 | 0.92 | spec:project:harvest-brainstorm-m26-scope | spec:project:architecture-constraints-018 | M26 scope — same concept, type bridge |
| 4 | 0.90 | knowhow-doc-harvest-debug-craft-catalog-json | spec:project:coding-conventions-004 | catalog JSON — same concept, type bridge |
| 5 | 0.90 | knowhow-doc-harvest-debug-i18n-split | spec:project:coding-conventions-003 | i18n module split — same concept |
| 6 | 0.90 | knowhow-doc-harvest-debug-reexport-anchor | spec:project:coding-conventions-002 | re-export anchor — same concept |
| 7 | 0.88 | knowhow-doc-harvest-other-lifecycle-hooks | spec:project:architecture-constraints-008 | lifecycle hooks — tag overlap + type bridge |
| 8 | 0.88 | spec:project:harvest-brainstorm-obsidian-architecture | spec:project:architecture-constraints-020 | obsidian — same concept, type bridge |
| 9 | 0.88 | spec:project:harvest-brainstorm-error-propagation | spec:project:architecture-constraints-027 | error propagation — same concept |
| 10 | 0.85 | knowhow-doc-harvest-debug-camelcase-api | spec:project:coding-conventions-011 | camelCase API — same concept |
| 11 | 0.85 | knowhow-doc-harvest-other-intelligence-cache | spec:project:coding-conventions-010 | caching — same concept |
| 12 | 0.85 | spec:project:harvest-brainstorm-backward-compat | spec:project:architecture-constraints-024 | backward compat — same concept |
| 13 | 0.80 | knowhow-doc-harvest-other-m10-style-learning | spec:project:coding-conventions-008 | voice/style — concept overlap |
| 14 | 0.80 | knowhow-doc-harvest-other-bookworld-worldview | spec:project:architecture-constraints-007 | worldview — concept overlap |
| 15 | 0.78 | knowhow-doc-harvest-debug-test-design | spec:project:test-conventions | testing — type bridge |
| 16 | 0.75 | knowhow-doc-harvest-debug-logger-noop | spec:project:quality-rules-003 | logger — concept overlap |
| 17 | 0.72 | knowhow-doc-harvest-other-workflowservice | spec:project:architecture-constraints-022 | iterative verification — concept |
| 18 | 0.70 | spec:project:harvest-brainstorm-cytoscape | spec:project:harvest-brainstorm-embedding | knowledge graph / embedding related |
| 19 | 0.70 | spec:project:harvest-brainstorm-sync-engine | spec:project:architecture-constraints-025 | data contract / sync |
| 20 | 0.65 | knowhow-doc-harvest-other-mirofish-graphrag | spec:project:harvest-brainstorm-cytoscape | GraphRAG / knowledge graph |

## Reverse Links (8)

为强化双向连接，对前 8 个建议添加反向链接：

| Source | Target | Reason |
|---|---|---|
| spec:project:learnings-005 | knowhow-doc-harvest-other-bookworld-ablation | bidirectional |
| spec:project:architecture-constraints-001 | spec:project:harvest-brainstorm-m24-scope | bidirectional |
| spec:project:architecture-constraints-018 | spec:project:harvest-brainstorm-m26-scope | bidirectional |
| spec:project:coding-conventions-004 | knowhow-doc-harvest-debug-craft-catalog-json | bidirectional |
| spec:project:coding-conventions-003 | knowhow-doc-harvest-debug-i18n-split | bidirectional |
| spec:project:coding-conventions-002 | knowhow-doc-harvest-debug-reexport-anchor | bidirectional |
| spec:project:architecture-constraints-008 | knowhow-doc-harvest-other-lifecycle-hooks | bidirectional |
| spec:project:architecture-constraints-027 | spec:project:harvest-brainstorm-error-propagation | bidirectional |

## Applied

- Forward links applied: 20/20
- Reverse links applied: 8/8
- Total updates: 28
- New health: 51 (delta +23)
- New orphans: 25 (delta -23)

## Orphan Rescue Results

### Rescued (23 entries no longer orphan)
- **Knowhow harvest (15)**: 全部 knowhow-doc-harvest-debug-* 和 knowhow-doc-harvest-other-* 现已连接到对应 spec
- **Brainstorm harvest (7)**: 全部 spec:project:harvest-brainstorm-* 现已连接到对应架构决策
- **wiki-connections reports**: 部分通过反向链接获得 in-degree

### Remaining Orphans (25)
- **Issue entries (~73)**: 全部 ISS-* 条目仍孤立 — issue 条目天然难以链接（需专门标签分类）
- **Scratch notes (17)**: workflow 会话工件，多为一次性分析/讨论记录
- **wiki-connection reports (8)**: 历史连接报告（KNW-wiki-connections-*），元条目

## Graph Structure Observations

### 类型分布
- spec: 86 条目（含 36 arch + 22 coding + 6 debug + 10 learnings + 8 brainstorm harvest + 父条目）
- knowhow: 24 条目（15 harvest + 8 session + 1 meta）
- note: 17 条目（全部 scratch 会话工件）
- issue: 73+ 条目（全部孤立）
- roadmap: 1

### Hub 浓度
- 父 spec 条目（architecture-constraints, coding-conventions 等）仍是主 hub
- 新增反向链接使 knowhow 和 brainstorm 条目获得 in-degree
- issue 条目缺乏 hub 结构（无标签分类，无相互引用）

### 关键发现
1. **Knowhow ↔ Spec 是最高价值的 type bridge** — 15 个 knowhow 条目原是孤立的重灾区，现在全部通过同概念连接到 spec
2. **Brainstorm harvest 条目脱离知识图谱** — 7 个 brainstorm 收获条目从未链接到实际架构决策，是知识沉淀断裂点
3. **Issue 条目无连接结构** — 73+ issue 条目完全孤立，缺乏标签或分类，建议后续 harvest 时为 issue 添加 category/tags
4. **12 个断裂链接仍存在** — 需 `cleanup --fix` 处理（不在 connect 范围）

## Graph Insights

- **Knowhow 高孤立率修复**: knowhow 类条目原孤立率最高（15/24 = 62%），本轮修复后降至 0%。根因：harvest 时 knowhow 条目未自动建立到对应 spec 的引用。
- **Brainstorm 断链**: brainstorm → architecture 决策的连接是知识沉淀的关键断点。brainstorm 产出的决策需显式回链到架构 spec，否则知识图谱无法追溯决策来源。
- **Issue 条目无图谱价值**: issue 条目天然孤立，建议改为按 category 聚合（如 security/performance/reliability）建立 issue-hub 条目。
