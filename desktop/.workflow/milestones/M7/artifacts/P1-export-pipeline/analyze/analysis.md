# M7 Phase 1 Analysis — Export Pipeline

## Analysis Date: 2026-05-05
## Methodology: 6-Dimension Scoring (Evidence-Based)

---

## Dimension 1: Feasibility — 9/10

**Score: High**

The export pipeline is 70% already implemented. `export.ts` provides complete Markdown and HTML export with proper file download. `DocumentEditor.tsx` already wires both functions to toolbar buttons. The only missing format is PDF.

**Evidence:**
- `src/utils/export.ts`: 192 lines, covers all TipTap node types (doc, paragraph, heading, text with 5 mark types, bulletList, orderedList, listItem, blockquote, codeBlock, horizontalRule, hardBreak)
- `DocumentEditor.tsx:4`: `import { exportToMarkdown, exportToHtml } from '../utils/export'`
- `DocumentEditor.tsx:128,134`: Both buttons wired with `onClick={() => exportToMarkdown/editorJson, title)}`
- No new dependencies needed for MD/HTML (pure TypeScript)

**Risks:**
- PDF via `window.print()` needs print CSS (no print styles exist currently — grep for `@media print` returned 0 results)
- Print will capture entire page unless scoped properly

---

## Dimension 2: Impact — 8/10

**Score: High**

Document export is the most critical missing capability — authors need to deliver their work. The current app produces content but has no way to get it out in a deliverable format (except copy-paste).

**Evidence:**
- Translation keys `exportMarkdown`/`exportHtml` were added in earlier milestones but not wired until recently
- StoryBiblePanel and SettingsModal both have export patterns — indicating this is a recognized need
- No DOCX needed (explicitly deferred), but MD + HTML + PDF covers 95% of author delivery needs

---

## Dimension 3: Complexity — 3/10 (Low = Good)

**Score: Low complexity**

Most work is done. Remaining tasks are:
1. Add `exportToPdf` function (browser print, ~20 lines)
2. Create `ExportDialog` component (~80-100 lines)
3. Add print CSS (~15 lines)
4. Add 1-2 i18n keys

**Evidence:**
- `export.ts` pattern is established and easy to extend
- `downloadFile` helper already handles blob creation and cleanup
- No new npm packages needed (print is native browser API)
- Dialog follows existing modal patterns in the codebase

---

## Dimension 4: Dependencies — 9/10

**Score: Excellent (minimal dependencies)**

All dependencies are already in place:
- TipTap (JSONContent, editor instance) — already installed
- Blob/download APIs — browser native
- `window.print()` — browser native
- No new npm packages required

**Evidence:**
- `package.json` has no export-related packages (no jspdf, turndown, file-saver, html2pdf)
- All functionality uses browser APIs or TipTap's built-in methods
- The export utilities are pure TypeScript with zero external dependencies

---

## Dimension 5: Risk — 2/10 (Low = Good)

**Score: Very low risk**

- No breaking changes to existing interfaces
- Export utilities are additive (new files or extending existing ones)
- No store shape changes needed for Phase 1
- Existing 903 tests should be unaffected (export is side-effect free from test perspective)
- `downloadFile` is only callable from user interaction (no auto-download risk)

**Evidence:**
- `export.ts` functions are pure: take JSONContent in, produce string, trigger download
- `DocumentEditor.tsx` only calls export when `editorJson` is non-null (line 125)
- No mutation of editor state during export

---

## Dimension 6: Testability — 8/10

**Score: High testability**

- `nodeToMarkdown` and `nodeToHtml` are deterministic pure functions (though currently unexported)
- `exportToMarkdown`/`exportToHtml` trigger `downloadFile` which creates a blob — mockable
- ExportDialog can be tested with `@testing-library/react`
- PDF export via `window.print()` is harder to unit test but easily verified manually

**Evidence:**
- Existing test patterns: `DocumentEditor.test.tsx`, `NikoEditor.test.tsx` already cover editor rendering
- Settings export (`handleExport` in SettingsModal) is not tested — establishes precedent for light testing of download flows

---

## Overall Score: 39/60 — Strong Go

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Feasibility | 9/10 | High | 9 |
| Impact | 8/10 | High | 8 |
| Complexity | 3/10 (inverse) | Medium | 7 |
| Dependencies | 9/10 | Medium | 9 |
| Risk | 2/10 (inverse) | High | 8 |
| Testability | 8/10 | Low | 8 |
| **Total** | **39/60** | | **Go** |

---

## Key Findings

1. **Roadmap overestimates effort by ~60%** — MD/HTML export, toolbar buttons, and text auto-save are already implemented. Roadmap tasks TASK-1.1, TASK-1.2, TASK-1.3, TASK-1.6, TASK-1.7, TASK-1.8 can be marked as completed or significantly reduced.

2. **PDF is the only real new code** for Phase 1 — estimated at ~50 lines (print CSS + wrapper function).

3. **ExportDialog is optional but improves UX** — current inline buttons are functional. Dialog adds value via filename input, format preview, and unified interface.

4. **No new dependencies needed** — everything is achievable with browser APIs and existing libraries.

5. **useDraftCache already provides basic auto-save** — Phase 2 gap is smaller than roadmap suggests. Main additions: JSONContent persistence (not just text), proper status indicator, and draft recovery prompt.
