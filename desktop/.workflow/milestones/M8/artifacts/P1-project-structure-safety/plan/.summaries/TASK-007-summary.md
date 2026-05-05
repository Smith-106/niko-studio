# TASK-007 Summary: History Rail & Diff Viewer

**Status:** Completed

## What was done
Created `desktop/src/components/HistoryPanel.tsx` with snapshot timeline, diff viewer, and restore confirmation.

### Features:
- Snapshot list showing timestamp, label (if named), file size
- Multi-select two snapshots for comparison via `diffSnapshots()`
- `DiffViewer` sub-component renders inline diff with color-coded additions (green) and deletions (red)
- `DiffLine` renders individual diff lines with line numbers
- `RestoreConfirmDialog` modal before restoring snapshot content
- Restore triggers `window.location.reload()` to refresh editor with restored content
- Panel toggles from status bar "History" button

### Store changes:
- `uiSlice.ts` — Added `historyPanelOpen` (boolean, default false), `toggleHistoryPanel()`, `setHistoryPanelOpen()`

### Layout changes:
- `DocumentEditor.tsx` — Outer container changed to horizontal flex row; editor + status bar on left, HistoryPanel on right (320px). HistoryPanel renders null when closed.

## Files modified
- `desktop/src/components/HistoryPanel.tsx` — **created**
- `desktop/src/stores/uiSlice.ts` — added historyPanelOpen state + actions
- `desktop/src/components/DocumentEditor.tsx` — integrated HistoryPanel, restructured layout to flex row
