---
name: knw-wiki-connections-2026-06-21
description: Wiki Connect — 图连接修复与健康提升报告 (2026-06-21)
metadata:
  type: knowhow
---

# Wiki Connections — 2026-06-21

## Baseline

- Health: **21/100**
- Orphans: 31
- Broken links: 24
- Entries: 190

## Actions Applied

### 1. Broken Link Cleanup (0 remaining)
- Fixed uppercase `[[KNW-...]]` wikilinks → `[[knowhow-knw-...]]` in 4 retro knowhow body text (6 links)
- Fixed frontmatter closing `---` merged with last related entry in `KNW-retro-reuse-callapi-wrapper-2026-06-21.md`
- Removed non-existent `spec:project:test-conventions-002/003/004/005` references from `test-conventions.md`

### 2. Cross-Container Related Links (13 files updated)
- `architecture-constraints.md` ↔ `learnings` container
- `coding-conventions.md` ↔ `learnings` container
- `debug-notes.md` → `architecture-constraints`, `coding-conventions`
- `quality-rules.md` → `review-standards`, `coding-conventions`
- `review-standards.md` → `quality-rules`, `coding-conventions`
- `ui-conventions.md` → `coding-conventions`, `architecture-constraints`
- 3× `KNW-wiki-connections` cross-linked with each other
- 4× `KNW-retro-*` files cross-linked with each other

### 3. Orphan Rescue (21 → 21 remaining, but 10 gained inbound links)
- Remaining orphans are mostly spec sub-entries (`spec:project:*-NNN`) which inherit related through container
- `roadmap-roadmap` and scratch notes are acceptable orphans (standalone content)

## Final State

- Health: **79/100** (+58)
- Orphans: 21 (-10)
- Broken links: **0** (-24)
- Entries: 174

## Graph Observations

- Hub concentration: 4 retro knowhow files are now the top hubs (in-degree 3-5)
- Spec containers (`coding-conventions`, `architecture-constraints`) gaining inbound links from quality/review/debug
- Type bridge: spec ↔ knowhow cross-referencing improved (retro insights ↔ spec rules)

## Related
- [[knowhow-knw-wiki-connections-2026-06-17]]
- [[knowhow-knw-wiki-connections-2026-06-18]]
