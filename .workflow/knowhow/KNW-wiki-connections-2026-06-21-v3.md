---
name: knw-wiki-connections-2026-06-21-v3
description: Wiki Connect — 图连接修复与健康提升报告 (2026-06-21 v3)
metadata:
  type: knowhow
---

# Wiki Connections — 2026-06-21 v3

## Baseline

- Health: **71/100**
- Orphans: 21
- Broken links: 4
- Entries: 189

## Actions Applied

### 1. Broken Link Cleanup (4 → 0)
- Removed truncated `[[KNW-...]]` and `[[knowhow-knw-...]]` wikilinks from `KNW-wiki-connections-2026-06-21-v2.md`
- Removed non-existent `spec:project:ui-conventions-005/006/007/008` from ui-conventions.md frontmatter

### 2. Automated Orphan Rescue (2 rescued)
- `knowhow-doc-harvest-other-bookworld-scene` → linked to `bookworld-worldview`, `bookworld-ablation`, `debug-camelcase-api`
- `knowhow-doc-harvest-other-m10-consistency` → linked to `debug-reexport-anchor`, `bookworld-ablation`, `debug-i18n-split`

### 3. Manual High-Value Connections (24 related links via `maestro wiki update`)
- `roadmap-roadmap` → `harvest-brainstorm-m24-scope`, `architecture-constraints`
- `spec:project:ui-conventions` → `coding-conventions`, `architecture-constraints`
- 16 scratch notes → spec/knowhow entries matching their domain (test-coverage→test-conventions, M26-reader→retro-knowhow, fix-risks→quality-rules, odyssey→arch-constraints)
- `knowhow-doc-harvest-other-m10-multi-pass` → `architecture-constraints-008`

### 4. Body Wikilinks (18 added)
- 16 scratch files: added `## Related` section with `[[wikilinks]]` to spec/knowhow targets
- `roadmap.md`: added wikilinks to M24 scope spec
- `ui-conventions.md`: added wikilinks to sibling specs
- `m10-multi-pass.md`: added wikilinks to architecture + learnings

### 5. Frontmatter Fixes
- Fixed `ui-conventions.md` frontmatter closing `---` merged with last related entry
- Removed 4 non-existent sub-entry references from ui-conventions related list

## Final State

- Health: **100/100** (+29)
- Orphans: **0** (-21)
- Broken links: **0** (-4)
- Entries: 182

## Graph Observations

- Hub concentration: retro knowhow files (in-degree 5-6) + spec containers (test-conventions in-degree 6, coding-conventions in-degree 4)
- Type bridge: scratch notes now cross-linked to spec/knowhow (previously isolated)
- Roadmap connected to spec/knowhow graph for first time
- ui-conventions frontmatter cleanup resolved long-standing orphan status
- `spec:project:test-conventions` became a top hub (in-degree 6) due to test-coverage scratch notes linking to it

## Related

- [[knowhow-knw-wiki-connections-2026-06-17]]
- [[knowhow-knw-wiki-connections-2026-06-18]]
- [[knowhow-knw-wiki-connections-2026-06-21]]
