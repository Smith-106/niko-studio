# TASK-103: Wire ExportDialog into DocumentEditor

**Status:** completed

## What was done
- Replaced two inline export buttons (Markdown, HTML) in DocumentEditor status bar with single "Export Document" button + ExportDialog modal
- Added `showExportDialog` state and `setShowExportDialog` toggle
- Added imports: `ExportDialog` component, `exportToPdf` from utils
- Export button only renders when `editorJson` is available (existing behavior preserved)

## Files modified
- `src/components/DocumentEditor.tsx` — replaced inline buttons with ExportDialog integration

## Verification
- Existing DocumentEditor tests continue to pass
- ExportDialog.test.tsx (TASK-104) validates full interaction flow
