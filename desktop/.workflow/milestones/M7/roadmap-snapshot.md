# Roadmap: Niko-Studio Desktop — M7: Export & Delivery

## Overview

M7 focuses on getting content out of the app and persisting writing sessions. After M1–M6 built the full application (MVP → Intelligence → Wiring → Dashboard → Writing Experience → Performance), the most critical missing capability is **document export** — authors need to deliver their work. The app has TipTap `JSONContent` internally, translation keys for export (`exportMarkdown`, `exportHtml`), and a settings export JSON mechanism, but no actual document export pipeline. Writing session persistence is also absent — closing the app loses editor state.

## Phases

- [ ] **Phase 1: Export Pipeline** — Markdown, HTML, and PDF export with format selection UI
- [ ] **Phase 2: Session Persistence & Polish** — Auto-save, draft persistence, and batch export

---

## Phase Details

### Phase 1: Export Pipeline

**Goal**: Implement document export from TipTap editor content to Markdown, HTML, and PDF. Provide a unified export dialog with format selection, filename input, and preview.

**Depends on**: M6 complete (903 tests passing, codebase clean)

**Current State**:
- TipTap `JSONContent` is the internal editor format (`NikoEditor.tsx`)
- Translation keys exist: `exportMarkdown`, `exportHtml`, `exportSettings`
- Settings export already works (JSON blob download in `SettingsModal.tsx`)
- No export libraries installed (no jspdf, file-saver, docx, etc.)
- `@tiptap/starter-kit` includes HTML serialization via `editor.getHTML()`

**Success Criteria** (what must be TRUE):
  1. Export dialog accessible from editor toolbar with format selector (MD/HTML/PDF)
  2. Markdown export produces clean Markdown from TipTap content
  3. HTML export produces styled standalone HTML document
  4. PDF export produces paginated PDF via browser print or library
  5. Exported files download with correct MIME type and filename
  6. All 903 existing tests still pass
  7. Export i18n keys wired to zh-CN and en-US translations

**Task Waves:**

Wave 1 — Export Infrastructure:
- [ ] TASK-1.1: Create export utility module (`src/utils/export.ts`) — functions for `toMarkdown(JSONContent)`, `toHTML(JSONContent)`, `toPDF(JSONContent)` with proper error handling
- [ ] TASK-1.2: Implement Markdown export — convert TipTap JSON to clean Markdown using `@tiptap/pm` serialization or `turndown` library
- [ ] TASK-1.3: Implement HTML export — generate standalone HTML document with inline styles from TipTap HTML output

Wave 2 — PDF & UI:
- [ ] TASK-1.4: Implement PDF export — use browser `window.print()` with print-specific CSS media queries, or integrate lightweight PDF library
- [ ] TASK-1.5: Create ExportDialog component — format selector (MD/HTML/PDF), filename input, preview pane, export button
- [ ] TASK-1.6: Wire ExportDialog into editor toolbar and document context menu

Wave 3 — Validation:
- [ ] TASK-1.7: Unit tests for export utilities (Markdown/HTML output correctness)
- [ ] TASK-1.8: Component tests for ExportDialog (format selection, download trigger)
- [ ] TASK-1.9: Manual verification — export sample documents in all formats, check quality

---

### Phase 2: Session Persistence & Polish

**Goal**: Persist writing sessions so authors don't lose work. Add auto-save, draft recovery, and polish the export workflow.

**Depends on**: Phase 1 (export pipeline functional)

**Current State**:
- No session persistence mechanism exists
- `useAppUiPersistence` hook saves UI state but not editor content
- Focus mode and word count exist in `uiSlice` but no content save/restore
- No auto-save timer or recovery mechanism

**Success Criteria** (what must be TRUE):
  1. Editor content auto-saves to local storage at configurable interval (default 30s)
  2. App restores last editor content on restart
  3. Draft recovery prompt appears if unsaved changes detected
  4. Export history tracked — user can re-export previous documents
  5. No regressions: all existing + new tests pass
  6. No performance degradation from auto-save (debounced, non-blocking)

**Task Waves:**

Wave 1 — Auto-Save & Recovery:
- [ ] TASK-2.1: Create session persistence module (`src/utils/sessionPersistence.ts`) — save/load TipTap JSONContent to localStorage or IndexedDB
- [ ] TASK-2.2: Implement auto-save hook (`useAutoSave`) — debounced save of editor content with dirty tracking
- [ ] TASK-2.3: Implement draft recovery UI — prompt on app start when unsaved content detected, with restore/discard options

Wave 2 — Polish & Integration:
- [ ] TASK-2.4: Add export history — track recent exports with format, filename, timestamp in settings store
- [ ] TASK-2.5: Integrate auto-save status indicator in editor toolbar (saved/saving/unsaved state)
- [ ] TASK-2.6: Update i18n translations for all new UI strings (zh-CN + en-US)

Wave 3 — Validation:
- [ ] TASK-2.7: Unit tests for session persistence module (save/load/clear)
- [ ] TASK-2.8: Hook tests for auto-save (debounce timing, dirty tracking)
- [ ] TASK-2.9: Integration test — create content, close app, reopen, verify recovery

---

## Inherited Deferred Items (from M6)

These items were deferred from M6 and remain out of scope for M7:
- Custom TipTap extensions beyond characterCount (tables, math, collaborative cursors)
- DOCX export (requires heavy `docx` library — defer to M8 if needed)
- Localization beyond existing zh-CN/en-US support
- Multi-document project management (chapters, volumes)

---

## Out of Scope

- Backend changes (all work is frontend-only)
- New API endpoints or gateway modifications
- Changes to the Tauri Rust layer
- DOCX export (library too heavy for this milestone)
- Cloud sync or multi-device features
- Breaking changes to store shape or component interfaces

---

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Export Pipeline | ⬚ Not started | — |
| 2. Session Persistence & Polish | ⬚ Not started | — |
