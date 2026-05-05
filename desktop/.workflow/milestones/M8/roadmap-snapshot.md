# Roadmap: Niko-Studio Desktop — M8: Infrastructure & Export

## Overview

M8 builds the project infrastructure layer: multi-document project management (F-001), version history & revision tracking (F-002), DOCX & advanced export (F-003), and custom TipTap extensions (F-005). This milestone establishes the structural foundation that future intelligence features (M9) depend on — 4 of 8 planned features require F-001 as a prerequisite.

**Source**: brainstorm-next-phase-direction-20260505 (BRN-001)

## Phases

- [ ] **Phase 1: Project Structure & Safety** — Multi-document project management + version history (F-001, F-002)
- [ ] **Phase 2: Export & Editor Extensions** — DOCX export + TipTap custom extensions (F-003, F-005)

---

## Phase Details

### Phase 1: Project Structure & Safety

**Goal**: Introduce multi-document project management with Project→Volume→Chapter hierarchy, and version history with snapshot-based revision tracking.

**Depends on**: M7 complete (9.8.0, 937 tests passing)

**Features**: F-001 (Project Management), F-002 (Version History)

**Current State**:
- Single-document editing model via TipTap editor
- SQLite (better-sqlite3) available through niko-gateway
- Zustand stores for UI state, no project-level data model
- No version history or revision tracking

**Success Criteria** (what must be TRUE):
  1. Project→Volume→Chapter hierarchy created and navigable via sidebar tree
  2. Existing documents auto-migrate to a Default Project on first launch
  3. Chapter CRUD operations work (create, rename, reorder, delete)
  4. Version snapshots created on manual save + auto-save (throttled)
  5. Snapshot diff view shows changes between revisions
  6. All existing 937+ tests still pass
  7. Progressive disclosure: sidebar and history rail collapsed by default

---

### Phase 2: Export & Editor Extensions

**Goal**: Add DOCX export using docx.js, and extend the TipTap editor with table, math (KaTeX), and callout block extensions.

**Depends on**: Phase 1 (project management for multi-chapter export)

**Features**: F-003 (DOCX Export), F-005 (TipTap Extensions)

**Current State**:
- Markdown, HTML, PDF export functional from M7
- TipTap starter-kit provides basic extensions
- No DOCX support
- No table, math, or callout extensions

**Success Criteria** (what must be TRUE):
  1. DOCX export produces formatted Word document from single chapter or full project
  2. Style mapping table converts TipTap formatting to DOCX styles
  3. Table extension renders and edits tables in the editor
  4. Math/KaTeX extension renders inline and block equations
  5. Callout block extension provides info/warning/error/danger block types
  6. All extensions are collapsible/progressive — don't overwhelm the writing flow
  7. All existing + new tests pass

---

## Feature Specs

| Feature | Spec | Priority | Phase |
|---------|------|----------|-------|
| F-001: Multi-Document Project Management | `scratch/brainstorm-.../feature-specs/F-001-project-management.md` | HIGH | P1 |
| F-002: Version History & Revision Tracking | `scratch/brainstorm-.../feature-specs/F-002-version-history.md` | HIGH | P1 |
| F-003: DOCX & Advanced Export | `scratch/brainstorm-.../feature-specs/F-003-docx-export.md` | MEDIUM | P2 |
| F-005: Custom TipTap Extensions | `scratch/brainstorm-.../feature-specs/F-005-tiptap-extensions.md` | MEDIUM | P2 |

## Out of Scope

- Writing intelligence features (F-004, M9)
- Template system (F-006, M9)
- Agent workflows (F-007, M9)
- Localization expansion (F-008, M10+)
- Cloud sync or multi-device features
- Breaking changes to existing store shape or component interfaces

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Project Structure & Safety | ⬚ Not started | — |
| 2. Export & Editor Extensions | ⬚ Not started | — |
