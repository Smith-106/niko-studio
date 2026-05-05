# Six-Dimension Analysis — M8 Phase 1: Project Structure & Safety

> Session: 20260505-analyze-P1-project-structure-safety
> Date: 2026-05-05

## Scoring Summary

| Dimension | Score | Confidence |
|-----------|-------|------------|
| Feasibility | 7/10 | High |
| Impact | 9/10 | High |
| Risk | 6/10 | Medium |
| Complexity | 7/10 | High |
| Dependencies | 5/10 | Medium |
| Alternatives | 3/10 | Low |

**Overall Recommendation**: **GO** — Phase 1 is strategically essential (4 of 8 future features depend on F-001). Risks are manageable with careful execution.

---

## 1. Feasibility: 7/10

**Evidence FOR:**
- `ProjectWorkspaceContext` already defines `projectId`, `chapterId`, `manuscriptId` fields
- `tauri_plugin_fs` already loaded — filesystem access available with zero setup
- `normalizeProjectWorkspaceContext` handles legacy field migration robustly
- Workspace model is well-abstracted with clear extension points
- Existing 937 tests provide regression safety net

**Evidence AGAINST:**
- No SQLite integration exists — must be added to gateway or Rust layer
- Current persistence is entirely localStorage — complete rewrite required
- TipTap JSON is not currently persisted (only text) — format change for all documents
- No tree/sidebar component exists — significant new UI

**Gap**: File format change from plain text to TipTap JSON during migration. Current `useDraftCache` stores only `text`, not the structured `JSONContent`. Migration must handle plain-text-to-TipTap conversion.

---

## 2. Impact: 9/10

**Strategic impact:**
- F-001 is prerequisite for 4 of 8 planned features (F-002, F-003, F-004, F-006)
- Multi-document support transforms the app from "single document editor" to "project workspace"
- Version history (F-002) is a top user request for writing tools
- DOCX export (F-003, Phase 2) requires project hierarchy for multi-chapter export

**User impact:**
- Current limitation: one document per conversation is confusing for long-form writing
- Project hierarchy aligns with how writers actually organize work (book → part → chapter)
- Version history provides safety net — users can experiment without fear of losing work

**Technical impact:**
- Fixes the existing bug where TipTap JSON formatting is lost on reload
- Establishes filesystem persistence layer that all future features build on
- Workspace model already designed for project context — fills in the null fields

---

## 3. Risk: 6/10

**Data loss risk (HIGH):**
- Migration from localStorage to filesystem is one-shot, must not fail
- Current localStorage drafts have no backup mechanism
- Mitigation: (a) backup localStorage before migration, (b) validate each file write, (c) keep localStorage as fallback for one version

**Store breaking change (HIGH):**
- DocumentEditor, NikoEditor, StoryBiblePanel all depend on `currentConversationId`
- Changing document resolution to `currentChapterId` affects rendering
- Mitigation: adapter layer that resolves chapter → conversation for backward compat

**Performance risk (MEDIUM):**
- File I/O on every save (currently debounced at 1500ms in DocumentEditor)
- Version snapshot creation must not block editor
- Mitigation: async saves, worker thread for snapshot compression

**Scope creep risk (MEDIUM):**
- Sidebar tree with drag-reorder is complex UI
- Diff viewer for version history is non-trivial
- Mitigation: Phase the UI — tree display first, CRUD second; basic diff first, visual diff later

---

## 4. Complexity: 7/10

**Estimated effort areas:**

| Component | Effort | Notes |
|-----------|--------|-------|
| Project data model + store | Medium | New Zustand slice, straightforward |
| SQLite schema + gateway APIs | Medium | New table, CRUD endpoints |
| Filesystem chapter storage | Low-Medium | Read/write JSON files via Tauri FS |
| Sidebar tree component | High | Tree rendering, drag-drop, context menu, inline edit |
| Migration script | High | localStorage → filesystem, handle edge cases |
| Version snapshot storage | Medium | Compressed JSON, retention policy |
| Diff viewer component | High | Myers diff on text, UI for displaying diffs |
| History rail component | Medium | Timeline UI, snapshot list, restore action |
| Store integration | Medium | Workspace resolution, chapter → conversation adapter |

**Total complexity**: 8 significant new components + 4 modified components. Plan should use 2+ waves.

---

## 5. Dependencies: 5/10

**Internal dependencies:**
- F-002 depends on F-001 (chapters must exist before snapshots)
- Sidebar depends on project store (needs tree data)
- Diff viewer depends on snapshot storage (needs two snapshots)
- All F-001 components can be built in parallel within the wave

**External dependencies:**
- `tauri_plugin_fs` — already available (zero risk)
- SQLite integration — either `rusqlite` (Rust) or `better-sqlite3` (gateway Node.js)
- Myers diff library — `diff` npm package or custom implementation
- Tree component — build custom (matches existing TailwindCSS style) or use headless UI

**No external dependencies that don't already exist or have clear solutions.**

---

## 6. Alternatives: 3/10

**Alternative A: Skip F-001, keep single-document model**
- Rejected: 4 of 8 features require project hierarchy, would block M9 entirely
- Single-document is the core UX limitation users complain about

**Alternative B: SQLite-only (no filesystem)**
- Store TipTap JSON as BLOB in SQLite instead of files
- Rejected: Brainstorm ADR-001 specifies filesystem for content (faster reads, portable, backup-friendly)
- SQLite BLOBs grow fast with version history (50 snapshots × 300 chapters)

**Alternative C: Cloud storage first**
- Store projects in cloud instead of local filesystem
- Rejected: Out of scope for M8, adds network dependency, privacy concerns for creative writing

**No viable alternative to the planned approach — the design is well-aligned with requirements.**
