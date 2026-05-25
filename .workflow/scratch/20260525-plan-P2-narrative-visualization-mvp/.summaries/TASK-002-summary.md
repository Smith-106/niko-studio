# TASK-002: TimelineView 添加 SVG 缩放和事件类型筛选交互

**Status:** completed
**Wave:** 2

## What was done

### useVisualizationState.ts
- Added `zoomScale` (number, default 1.0), `zoomOffset` ({x, y}, default {0,0}), and `eventFilters` (string[], default all 3 types) to state
- Added setters: `setZoomScale`, `setZoomOffset`, `setEventFilters`, `resetZoom`
- Exported `ALL_EVENT_TYPES` constant and `NarrativeVisualizationEventType` type

### TimelineView.tsx
- Added optional props: `zoomScale`, `zoomOffset`, `onZoomChange`, `eventFilters`
- `viewBox` computed from zoom state: `${offsetX} ${offsetY} ${width/scale} ${height/scale}`
- `onWheel` handler on SVG: deltaY>0 multiplies scale by 0.9, else 1.1, clamped [0.3, 5.0]
- Events filtered by `eventFilters` before rendering
- Events rendered as colored markers (line + circle) above timeline, type-colored
- Selected chapter highlighted with stroke ring behind main circle

### VisualizationToolbar.tsx
- Added optional props: `zoomScale`, `onZoomIn`, `onZoomOut`, `onResetZoom`, `eventFilters`, `onToggleEventFilter`
- Zoom controls section (+/-/Reset + percentage display) — only shown when zoom callbacks provided
- Event type checkbox group (Turning Point, Conflict, Warning) — only shown when filter props provided

## Verification

- All 131 desktop test files pass (1196 tests)
- All new props are optional — existing consumers (NarrativeVisualizationPanelContent) work unchanged