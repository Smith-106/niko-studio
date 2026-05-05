# TASK-102: Create ExportDialog component

**Status:** completed

## What was done
- Created `src/components/ExportDialog.tsx` — unified modal dialog replacing inline export buttons
- Features: format selector (MD/HTML/PDF radio buttons), filename input, export button with Download icon, cancel button, X close button, backdrop click dismiss
- Uses `useDialogFocusTrap` for accessibility (focus trap, escape handling, initial focus on heading, restore focus)
- Uses `useI18n` for all visible text (exportDialogTitle, exportFilename, exportFormat, exportButton, exportCancel)
- Follows project's modal overlay pattern: `fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in`

## Files created
- `src/components/ExportDialog.tsx` (133 lines)

## Design decisions
- PDF format triggers `exportToPdf()` (no filename needed since browser print dialog handles save)
- Format defaults to `'md'`
- Filename defaults to `title` prop or `'document'`
- Dialog auto-closes after export action
