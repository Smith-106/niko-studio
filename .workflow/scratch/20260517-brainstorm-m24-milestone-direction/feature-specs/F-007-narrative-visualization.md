# F-007: Narrative Structure Visualization

## 1. Requirements Summary

A new visualization panel MUST be implemented providing interactive visual representations of narrative structure: story timeline, character relationship graph, and tension/pacing curve. The visualization MUST consume existing analysis data from the backend (no new analysis engines required) and SHOULD support incremental updates as the user writes.

## 2. Design Decisions [CORE]

### Architecture: Data Pipeline + Rendering Layer

```
Backend Analysis Data → Transform Pipeline → Visualization State → Render Components
     (existing)           (new adapter)        (Zustand slice)      (Canvas/SVG)
```

**Three visualization modes** (MVP scope):

1. **Timeline View**: Chapter sequence with key events, plot points, and arc markers
2. **Tension Curve**: Line chart showing pacing/tension scores per chapter (from EvaluationPanel data)
3. **Character Graph**: Force-directed graph showing character relationships and interaction frequency

**Why not a single complex visualization**: Each mode serves a different analytical need. Users switch between them based on their current editing focus. Separate modes also enable incremental delivery.

### Component Architecture (follows F-002 pattern)

```
NarrativeVisualizationPanel.tsx (container, ~200 lines)
├── VisualizationToolbar.tsx (mode switcher, controls)
├── TimelineView.tsx (chapter timeline)
├── TensionCurveView.tsx (pacing chart)
├── CharacterGraphView.tsx (relationship graph)
├── useVisualizationData.ts (data fetching + transform)
└── useVisualizationState.ts (view state management)
```

### Rendering Technology

| View | Technology | Rationale |
|------|-----------|-----------|
| Timeline | SVG (inline) | Simple shapes, good accessibility, CSS-styleable |
| Tension Curve | Canvas (via lightweight chart lib) | Performance for many data points |
| Character Graph | Canvas + force simulation | Complex layout, many nodes |

**Library choice**: Prefer existing project dependencies. If none suitable, consider:
- D3.js force simulation (character graph only, tree-shakeable)
- Or pure Canvas API with custom force layout (zero dependencies)

MUST NOT introduce heavy charting libraries (no Chart.js, no Recharts full bundle).

### Data Pipeline

```typescript
interface VisualizationDataSource {
  getTimelineData(): Promise<TimelineData>;
  getTensionData(): Promise<TensionCurveData>;
  getCharacterData(): Promise<CharacterGraphData>;
}

// Transforms existing analysis results into visualization-ready format
interface TimelineData {
  chapters: Array<{
    id: string;
    title: string;
    events: PlotEvent[];
    arcPosition: number; // 0-1 normalized
  }>;
}

interface TensionCurveData {
  points: Array<{
    chapterId: string;
    tension: number;    // from existing pacing analysis
    engagement: number; // from reader-state model (M23)
  }>;
}

interface CharacterGraphData {
  nodes: Array<{ id: string; name: string; importance: number }>;
  edges: Array<{ source: string; target: string; weight: number }>;
}
```

### Incremental Computation

Visualization data SHOULD be cached per chapter hash (from data-architect caching strategy). When a chapter changes:
1. Invalidate only that chapter's cache entry
2. Re-fetch analysis for changed chapter
3. Merge into existing visualization state
4. Re-render affected view region only

## 3. Interface Contract

```typescript
// New panel — no backward compatibility constraint
export interface NarrativeVisualizationPanelProps {
  projectId: string;
  activeChapterId?: string;
  onChapterSelect?: (chapterId: string) => void;
}

// Data source interface (bridges to existing analysis API)
export interface VisualizationDataSource {
  getTimelineData(): Promise<TimelineData>;
  getTensionData(): Promise<TensionCurveData>;
  getCharacterData(): Promise<CharacterGraphData>;
  subscribe(callback: () => void): () => void;
}
```

Visual constraints: If `.workflow/impeccable/DESIGN.md` exists, panel MUST follow established design tokens.

## 4. Constraints & Risks

- **Risk (Medium)**: Performance with large novels (100+ chapters, 50+ characters) → mitigate with virtualization and level-of-detail rendering
- **Risk (Medium)**: Data availability depends on user having run analysis → show empty state with CTA to run analysis
- **Constraint**: MUST NOT require new backend analysis engines (consume existing data only)
- **Constraint**: MUST work offline (no external API calls for rendering)
- **Constraint**: Accessibility: timeline and curve MUST have text alternatives (aria-labels, data table fallback)

## 5. Acceptance Criteria

- [ ] Timeline view renders chapter sequence with plot events
- [ ] Tension curve displays pacing scores from existing analysis
- [ ] Character graph shows relationships with force-directed layout
- [ ] Panel integrates into existing right-panel system (AppRightPanels)
- [ ] Performance: renders 100-chapter novel in < 2s
- [ ] Empty state shown when no analysis data available
- [ ] Incremental update works (edit chapter → visualization updates)
- [ ] Accessibility: screen reader can access all data points

## 6. Detailed Analysis References

- @system-architect/analysis-F-007-narrative-visualization.md — Data pipeline, incremental computation, rendering tech
- @product-manager/analysis-F-007-narrative-visualization.md — User value, MVP scope, differentiation
- @data-architect/analysis-F-007-config-model.md — Configuration parameters, caching strategy
- @design-research.md — Editor virtualization patterns, Tiptap performance

## 7. Cross-Feature Dependencies

- **Depends on**: F-002 (clean panel architecture), F-006 (stable engine interface for data access)
- **Consumes**: Existing narrative analysis results (M13-M16), reader-state model (M23)
- **Produces**: Reusable visualization components for future features
- **EP-004 applied**: Metric `visualization.render.duration` (not in original 7, added for this feature)
