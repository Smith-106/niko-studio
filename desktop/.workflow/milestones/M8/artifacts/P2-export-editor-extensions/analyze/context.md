# Phase 2 Analysis: Export & Editor Extensions

**Milestone:** M8 — Infrastructure & Export
**Phase:** 2 — Export & Editor Extensions
**Features:** F-003 (DOCX Export), F-005 (TipTap Extensions)

---

## Locked Decisions

### L-001: DOCX generation via `docx` npm package
- **Decision:** Use `docx` (docx.js) library for DOCX generation in the renderer process
- **Rationale:** Pure JS, runs in browser/renderer, no native deps, well-maintained, synchronous API for <100k words
- **Evidence:** F-003 spec specifies docx.js; current export pipeline runs synchronously in renderer; no Web Worker needed for V1

### L-002: Extend existing ExportDialog for DOCX + scope
- **Decision:** Add 'docx' format and 'current'/'project' scope to existing ExportDialog
- **Rationale:** ExportDialog already handles format selection for md/html/pdf; adding docx follows same pattern; scope selector leverages Phase 1 project structure
- **Evidence:** `src/components/ExportDialog.tsx` has format radio group; `src/utils/export.ts` has `nodeToMarkdown`/`nodeToHtml` pattern

### L-003: Parallel `nodeToDocx()` converter in export.ts
- **Decision:** Add `nodeToDocx()` alongside existing `nodeToMarkdown()`/`nodeToHtml()` using same recursive pattern
- **Rationale:** Matches existing architecture; docx.js provides Paragraph/TextRun/HeadingLevel/TableRow/TableCell building blocks
- **Evidence:** `src/utils/export.ts:1-120` — recursive `nodeToMarkdown()` with switch on `node.type`

### L-004: Community TipTap table extension
- **Decision:** Use `@tiptap/extension-table` + row/cell/header packages
- **Rationale:** Official TipTap community extensions, well-tested, provides table editing UI out of the box
- **Evidence:** TipTap ecosystem standard; spec F-005 references community extensions

### L-005: KaTeX for math rendering
- **Decision:** Use KaTeX (faster than MathJax, no network dependency) with lazy loading
- **Rationale:** ~300KB — must lazy load; KaTeX renders synchronously; spec F-005 recommends KaTeX
- **Evidence:** F-005 spec: "KaTeX — faster than MathJax, no network dependency"

### L-006: Custom callout node extension
- **Decision:** Build custom TipTap Node extension for callout blocks (info/warning/tip/important)
- **Rationale:** No community callout extension matches spec requirements; custom Node with data attributes for variant
- **Evidence:** F-005 spec defines 4 variants with distinct colors/icons; TipTap Node API well-documented

### L-007: Multi-chapter export via Phase 1 project slice
- **Decision:** `generateProjectDocx()` iterates all chapters via `getChaptersForProject()` from projectSlice
- **Rationale:** Phase 1 established project structure (volumes, chapters, projectFileService); export reads chapter content for each
- **Evidence:** `projectSlice.getChaptersForProject()` returns all chapters across volumes; `readChapterContent()` reads from disk

---

## Free Decisions

### F-001: Callout styling approach
- **Options:** CSS classes with data-variant attribute, or inline styles, or Tailwind utilities
- **Default:** CSS classes with data-variant (matches existing editor styling pattern)
- **How to resolve:** During execute — follow existing component styling conventions

### F-002: Math extension architecture
- **Options:** Single MathExtension with `inline: boolean` attribute, or separate MathInline + MathBlock
- **Default:** Separate extensions (cleaner TipTap patterns, independent serialization)
- **How to resolve:** During execute — check TipTap best practices for inline vs block nodes

### F-003: Slash command integration
- **Options:** Extend existing SlashCommandMenu items array, or refactor to plugin system
- **Default:** Extend items array (simplest, matches how heading/list items are added)
- **How to resolve:** During execute — add to existing `slashItems` array in NikoEditor

### F-004: DOCX style mapping for new node types
- **Options:** Table → Word table, math → image fallback, callout → styled paragraph
- **Default:** Direct mapping for table, text placeholder for math, styled paragraph for callout
- **How to resolve:** During execute — DOCX has native table support; math renders as text/image placeholder

---

## Deferred Decisions

### D-001: Web Worker for large DOCX exports
- **Reason:** Spec says synchronous is fine for <100k words V1; can add Worker later if needed
- **Trigger:** User reports UI freeze on large project exports

### D-002: MathJax as alternative renderer
- **Reason:** KaTeX covers most LaTeX; MathJax only needed for advanced notation
- **Trigger:** User requests LaTeX features KaTeX doesn't support

### D-003: Virtual rendering for large tables
- **Reason:** Spec mentions virtual rendering for >20 rows; premature for V1
- **Trigger:** Performance issues with large tables in editor

### D-004: DOCX import / round-trip editing
- **Reason:** Only export is in scope for F-003; import is a separate feature
- **Trigger:** User requests DOCX import capability

---

## Gray Areas

### GA-001: Math rendering in DOCX export
- KaTeX renders to HTML; DOCX cannot embed rendered math directly
- **Resolution:** Export math as plain LaTeX text in DOCX (with potential future OMML conversion)
- **Impact:** Low — math in DOCX will be readable but not rendered

### GA-002: Table cell editing UX
- Community table extension provides basic editing but may need custom styling
- **Resolution:** Use default table extension UI, apply project styling via CSS
- **Impact:** Low — functional editing with consistent visual design

### GA-003: Callout icon rendering
- Need icon component for each variant (info, warning, tip, important)
- **Resolution:** Use emoji or simple SVG icons matching existing UI patterns
- **Impact:** Minimal — cosmetic choice

---

## Implementation Scope

### New npm dependencies
- `docx` — DOCX generation
- `katex` — Math rendering
- `@tiptap/extension-table` — Table support
- `@tiptap/extension-table-row` — Table rows
- `@tiptap/extension-table-cell` — Table cells
- `@tiptap/extension-table-header` — Table headers

### Files to create
- `src/components/editor/extensions/MathInline.ts` — Inline math extension
- `src/components/editor/extensions/MathBlock.ts` — Block math extension
- `src/components/editor/extensions/Callout.ts` — Callout node extension
- `src/utils/exportDocx.ts` — DOCX export utilities

### Files to modify
- `src/utils/export.ts` — Add nodeToDocx for new node types (table, math, callout)
- `src/components/NikoEditor.tsx` — Register new extensions + slash commands
- `src/components/ExportDialog.tsx` — Add docx format + scope selector
- `package.json` — Add new dependencies

### Files to test
- `src/utils/exportDocx.test.ts` — DOCX generation tests
- `src/components/editor/extensions/MathInline.test.ts`
- `src/components/editor/extensions/MathBlock.test.ts`
- `src/components/editor/extensions/Callout.test.ts`
