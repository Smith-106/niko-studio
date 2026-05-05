# TASK-004 Summary: Sidebar Tree Component

**Status:** Completed

## What was done
Created `desktop/src/components/ProjectSidebar.tsx` with collapsible tree navigation for Project → Volume → Chapter hierarchy.

### Features:
- Three-level tree: Project (root) → Volume (expandable) → Chapter (leaf)
- Expand/collapse state tracked per project and volume node
- Chapter selection calls `selectChapter()` from ProjectSlice
- Add project, add volume, add chapter actions
- New chapters get empty TipTap JSON written to filesystem immediately
- Collapsed state shows a toggle button icon; expanded shows full tree
- Dark theme matching existing Sidebar.tsx patterns

### Store changes:
- `uiSlice.ts` — Added `sidebarExpanded` (boolean, default false), `toggleSidebar()`, `setSidebarExpanded()`

### Layout integration:
- `App.tsx` — Added `<ProjectSidebar />` between `<Sidebar>` and `<AppMainContent>`

## Files modified
- `desktop/src/components/ProjectSidebar.tsx` — **created**
- `desktop/src/stores/uiSlice.ts` — added sidebarExpanded state + actions
- `desktop/src/App.tsx` — integrated ProjectSidebar into layout
