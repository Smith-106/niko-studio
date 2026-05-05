# TASK-101: Add PDF export via window.print()

**Status:** completed

## What was done
- Added `exportToPdf()` function to `src/utils/export.ts` — calls `window.print()` for browser-native PDF export
- Added `@media print` CSS block to `src/styles/globals.css` that hides all UI except `.niko-editor-content .ProseMirror`, with print-optimized typography (12pt font, 1.6 line-height, break-inside/after rules for code blocks, blockquotes, headings, and images)
- Added `exportPdf` i18n key to `src/i18n/translations.ts` (zh: `'导出 PDF'`, en: `'Export PDF'`)

## Files modified
- `src/utils/export.ts` — added `exportToPdf()` after `exportToHtml()`
- `src/styles/globals.css` — added print CSS block (18 lines)
- `src/i18n/translations.ts` — added 1 new key

## Verification
- All existing tests pass
- `exportToPdf` test added in TASK-104 confirms `window.print()` is called
