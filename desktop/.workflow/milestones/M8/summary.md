---
milestone: M8
name: Infrastructure & Export
completed_at: 2026-05-05T19:00:00Z
verdict: PASS
---

# M8 Milestone Summary

## Overview

Infrastructure & Export — project structure management, filesystem persistence, version history, TipTap editor extensions, and DOCX export pipeline.

## Phases

### Phase 1: Project Structure & Safety (7 tasks)

- **TASK-001**: Project/Volume/Chapter types + Zustand slice
- **TASK-002**: Tauri FS persistence (projectFileService)
- **TASK-003**: localStorage migration service — idempotent migration with backup/restore
- **TASK-004**: Project sidebar tree navigation — 3-level collapsible tree
- **TASK-005**: Editor-chapter wiring + chapterAdapter — replaced useDraftCache with projectFileService
- **TASK-006**: Version snapshots + auto-save — Myers diff via `diff` npm package
- **TASK-007**: History panel + diff viewer — snapshot timeline, DiffViewer, RestoreConfirmDialog

**Tests**: 68/68 pass. Coverage: projectFileService 95.87%, projectSlice 96.62%, migrationService 95.41%, versionService 100%, project.test 100%, chapterAdapter 100%.

### Phase 2: Export & Editor Extensions (2 tasks)

- **TASK-001**: TipTap extensions — Table, MathInline, MathBlock, Callout (info/warning/tip/important)
- **TASK-002**: DOCX export pipeline — nodeToDocx recursive converter + ExportDialog with scope selector

**Tests**: 63/63 pass. export.test.ts 18/18, exportDocx.test.ts 25/25, SlashCommandMenu.test.tsx 20/20.

## Metrics

- **Total tests**: 131 (68 P1 + 63 P2)
- **Success criteria**: 14/14 met
- **Cross-artifact integration**: 9 interfaces verified
- **Anti-pattern scan**: Clean (no TODO/FIXME/stubs/empty returns)
- **Review**: PASS (1 medium i18n issue, 4 low — no blockers)

## Key Deliverables

- `src/stores/projectSlice.ts` — Zustand slice for project CRUD
- `src/services/projectFileService.ts` — Tauri FS persistence layer
- `src/services/migrationService.ts` — localStorage → filesystem migration
- `src/services/versionService.ts` — Snapshot management with auto-save
- `src/components/sidebar/ProjectSidebar.tsx` — 3-level tree navigation
- `src/components/editor/HistoryPanel.tsx` — Diff viewer + snapshot timeline
- `src/utils/exportDocx.ts` — Full DOCX export pipeline
- `src/components/editor/extensions/MathInline.ts` — KaTeX inline math
- `src/components/editor/extensions/MathBlock.ts` — KaTeX block math
- `src/components/editor/extensions/Callout.ts` — Callout block types
- `src/components/editor/SlashCommandMenu.tsx` — Added table/math/callout commands

## Deferred Issues

1. **ISS-R01** (medium) — Slash command labels not i18n'd
2. **ISS-R02** (low) — ExportDialog scope label hardcoded
3. **ISS-R03** (low) — MathBlock dual atom/content config
4. **ISS-R04** (low) — Callout markdown single-line edge case
5. **ISS-R05** (low) — MathView defaults to edit mode
