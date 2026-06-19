# TASK-004: CharacterGraphView 添加互动频率视觉编码和关系类型动态展示

**Status:** completed
**Wave:** 2

## What was done

### CharacterGraphView.tsx (only file modified)

1. **Edge weight visual encoding** — `strokeWidth = 1 + weight * 2`, `opacity = 0.3 + weight * 0.7` — thicker/more opaque = higher interaction frequency

2. **Relationship type color mapping** — `typeColors` record: ally=#22c55e, rival=#ef4444, family=#3b82f6, mentor=#a855f7, other=#9ca3af. `getEdgeColor()` helper falls back to gray for unknown types.

3. **Hover tooltip** — `hoveredEdge` state keyed by `${source}-${target}`. `onMouseEnter/onMouseLeave` on edge `<line>`. Absolute positioned `<div>` at edge midpoint showing: capitalized relationship type + interaction count (weight * 10 rounded to int). Tooltip is pointer-events-none with white bg, rounded, shadow.

4. **Simplified force-directed layout** — `computeForceLayout()` in `useMemo`:
   - Nodes initialized in circle around center with small random offset
   - 50 iterations: repulsion (push close pairs apart), attraction (pull connected nodes closer), centering (pull toward center)
   - Cooling factor alpha decreases linearly
   - Height increased from 220 to 360 for better space

## Verification

- Desktop typecheck: 0 errors