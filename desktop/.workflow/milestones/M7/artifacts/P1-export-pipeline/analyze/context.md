# M7 Phase 1 — Context & Decisions

## Analysis Date: 2026-05-05
## Scope: Export Pipeline (Phase 1 of M7: Export & Delivery)

---

## Current State Summary

### Already Implemented (discovered during analysis)

The roadmap significantly overestimates the work needed. Most Phase 1 and significant Phase 2 functionality already exists in the codebase:

1. **`src/utils/export.ts`** (192 lines) — Complete Markdown and HTML export utilities:
   - `exportToMarkdown(json, filename)` — TipTap JSON → clean Markdown with full node coverage (doc, paragraph, heading 1-3, text with bold/italic/underline/strike/code marks, bulletList, orderedList, listItem, blockquote, codeBlock, horizontalRule, hardBreak)
   - `exportToHtml(json, filename)` — TipTap JSON → standalone HTML document with embedded CSS styling (Georgia serif, max-width 680px, responsive, proper code/blockquote styling)
   - `downloadFile(content, filename, mimeType)` — Blob-based download with proper cleanup

2. **`src/components/DocumentEditor.tsx`** — Already imports and wires both export functions:
   - Two buttons in the editor toolbar: "Export Markdown" and "Export HTML"
   - Connected to `editorJson` state and `title` for filenames
   - Shows after editor has content

3. **`src/hooks/useDraftCache.ts`** — Text-level auto-save per conversation:
   - Saves to localStorage with `niko.draft:{conversationId}` keys
   - 24h TTL for draft entries
   - Auto-loads on conversation change
   - `DocumentEditor` passes `persistedText` as `initialContent` to NikoEditor
   - `persist(text)` called on every `handleEditorUpdate`

4. **i18n** — Translation keys exist:
   - `exportMarkdown` / `exportHtml` — zh-CN: "导出 Markdown" / "导出 HTML", en-US: "Export Markdown" / "Export HTML"
   - `exportSettings` — zh-CN: "导出设置", en-US: "Export Settings"
   - `editorAutoSaved` — zh-CN: "已保存", en-US: "Saved"

### Actual Gaps (what remains)

**Phase 1 — Export Pipeline:**
- PDF export (no implementation — no print CSS, no jspdf, no browser.print() call)
- Unified ExportDialog component (current inline buttons work but roadmap calls for format selector dialog)
- `exportPdf` i18n key (missing from both locales)

**Phase 2 — Session Persistence & Polish:**
- Draft recovery prompt on app start (no unsaved changes detection UI)
- Export history tracking (no record of past exports in store)
- Proper auto-save status indicator (current `showSaved` is a 1.5s debounce indicator, not dirty/saving/saved states)
- JSON-level persistence (only text is saved via `useDraftCache`, not TipTap JSONContent — loses formatting on restore)

---

## Decision Record

### Locked Decisions (cannot change)

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| L1 | TipTap `JSONContent` is the internal editor format | All editor operations use JSONContent | NikoEditor.tsx |
| L2 | Zustand for state management | appStore pattern established across M1-M6 | src/stores/appStore.ts |
| L3 | i18n via custom hook (`useI18n`) with `translations.ts` | Not react-i18next — custom implementation | src/i18n/ |
| L4 | Tauri 2 desktop shell, no backend API changes | Out of scope per roadmap | roadmap.md |
| L5 | No new npm dependencies for Markdown/HTML export | Already implemented with pure TypeScript | src/utils/export.ts |
| L6 | Blob-based file download pattern | Established in export.ts, SettingsModal, StoryBiblePanel | 3 existing implementations |
| L7 | `useDraftCache` for text persistence with localStorage | Already working, per-conversationId isolation | src/hooks/useDraftCache.ts |

### Free Decisions (to be decided during planning)

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| F1 | PDF export approach | a) `window.print()` with print CSS<br>b) jspdf library<br>c) html2pdf.js | **a)** — simplest, no deps, native quality. Print CSS is a few lines |
| F2 | ExportDialog vs inline buttons | a) Keep current inline buttons, add PDF<br>b) Create unified dialog with format selector | **b)** — roadmap requires it, better UX, allows filename input and preview |
| F3 | Export history storage | a) Zustand store slice (in-memory + localStorage)<br>b) Separate IndexedDB store | **a)** — consistent with existing pattern, export history is small |
| F4 | Auto-save status granularity | a) Simple "Saved" indicator (current)<br>b) Three-state: unsaved/saving/saved | **b)** — roadmap calls for it, low effort |
| F5 | JSONContent persistence | a) Extend `useDraftCache` to also save JSON<br>b) Separate hook `useJsonDraftCache`<br>c) Save JSON in useDraftCache alongside text | **a)** — extend existing hook to dual-persist (text + JSON) |

### Deferred Decisions (out of scope for M7)

| # | Decision | Why Deferred |
|---|----------|--------------|
| D1 | DOCX export | Library too heavy, explicitly out of scope in roadmap |
| D2 | Cloud sync / multi-device | Requires backend, out of scope |
| D3 | Multi-document project management (chapters, volumes) | Complex feature, defer to M8+ |
| D4 | TipTap extensions beyond current set (tables, math, collaborative cursors) | Deferred from M6, remains out of scope |
| D5 | Localization beyond zh-CN/en-US | Current i18n system supports it but no demand yet |

---

## Key Files Reference

| File | Role | Lines |
|------|------|-------|
| `src/utils/export.ts` | Export utilities (MD, HTML, download) | 192 |
| `src/components/DocumentEditor.tsx` | Editor container, wires export buttons | ~150 |
| `src/components/NikoEditor.tsx` | TipTap editor wrapper, exposes JSONContent | 478 |
| `src/hooks/useDraftCache.ts` | Text-level auto-save per conversation | 61 |
| `src/hooks/useAppUiPersistence.ts` | UI state persistence (sidebar, panels) | 167+ |
| `src/stores/appStore.ts` | Zustand store (conversations, settings) | — |
| `src/i18n/translations.ts` | Translation strings (zh-CN, en-US) | 2756+ |
| `src/components/SettingsModal.tsx` | Settings export (JSON blob) pattern | — |
| `src/components/StoryBiblePanel.tsx` | Story Bible draft export pattern | — |

---

## Gray Areas

1. **Print CSS scope**: `window.print()` would print the entire page, not just the editor content. Need a strategy: either isolate editor in a print-only iframe, or add print CSS that hides everything except the editor. Recommendation: print-specific CSS with `.ProseMirror` as the only visible element.

2. **JSONContent persistence size**: TipTap JSON is larger than plain text. For very long documents, localStorage (5MB limit) could be a concern. Mitigation: use `JSON.stringify` compression or cap at 4MB with fallback to text-only.

3. **Export dialog placement**: The current toolbar is compact with word count + export buttons + saved indicator. Adding a dialog trigger may require redesigning the toolbar layout slightly.
