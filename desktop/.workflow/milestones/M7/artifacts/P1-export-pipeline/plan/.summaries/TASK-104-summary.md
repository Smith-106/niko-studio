# TASK-104: Add tests for export pipeline

**Status:** completed

## What was done
- Created `src/utils/export.test.ts` with 10 tests across 3 describe blocks:
  - `nodeToMarkdown` (6 tests): headings with # prefix, bold/italic/strike/code marks, bullet/ordered lists, code blocks with language tag, blockquotes with > prefix, custom filename
  - `nodeToHtml` (3 tests): paragraphs with `<p>` tags, custom filename, nested lists
  - `exportToPdf` (1 test): confirms `window.print()` is called
- Created `src/components/ExportDialog.test.tsx` with 4 tests:
  - Renders with title, filename input, and format selector (MD/HTML/PDF)
  - Closes when cancel button clicked
  - Closes when backdrop clicked
  - Selects format and triggers correct export function
- Uses `captureDownload()` helper that mocks `document.body.appendChild` to intercept blob downloads without triggering jsdom Blob/navigation issues
- Stubs `URL.createObjectURL` and `URL.revokeObjectURL` at module level

## Files created
- `src/utils/export.test.ts` (175 lines)
- `src/components/ExportDialog.test.tsx` (73 lines)

## Test results
- All 14 new tests pass
- Full suite (903+ tests) passes with exit code 0
