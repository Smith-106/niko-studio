# F-002: Giant Component Split

## 1. Requirements Summary

EvaluationPanel (1783 lines) and StoryBiblePanel (1788 lines) MUST be decomposed into smaller, single-responsibility components. The split MUST preserve all existing functionality, maintain identical props interfaces, and introduce no visual regressions. Resulting sub-components SHOULD each be under 400 lines.

## 2. Design Decisions [CORE]

### Architecture: Container/Presentation + Custom Hooks

The decomposition follows a three-layer pattern:
1. **Container** (orchestrator): Manages data fetching, state coordination, and layout
2. **Presentation** (leaf): Pure rendering with props-only dependencies
3. **Custom Hooks**: Extract stateful logic into reusable hooks

**EvaluationPanel decomposition target**:
```
EvaluationPanel.tsx (container, ~200 lines)
├── EvaluationHeader.tsx (score summary, actions)
├── EvaluationDimensionList.tsx (dimension cards)
├── EvaluationDimensionCard.tsx (single dimension detail)
├── EvaluationSuggestions.tsx (improvement suggestions)
├── useEvaluationState.ts (state management hook)
└── useEvaluationActions.ts (action handlers hook)
```

**StoryBiblePanel decomposition target**:
```
StoryBiblePanel.tsx (container, ~200 lines)
├── StoryBibleTabs.tsx (tab navigation)
├── StoryBibleEntityList.tsx (entity listing)
├── StoryBibleEntityDetail.tsx (entity detail view)
├── StoryBibleRelationships.tsx (relationship graph)
├── useStoryBibleState.ts (state management hook)
└── useStoryBibleFilters.ts (filter/search logic)
```

**Why container/presentation over compound components**: The existing panels are data-heavy with complex state. Container/presentation provides clear testing boundaries — containers test data flow, presentations test rendering.

### Migration Strategy: Inside-Out Extraction

1. Extract hooks first (pure logic, easy to test)
2. Extract leaf presentations (pure render, snapshot testable)
3. Reduce container to orchestration only
4. Verify with existing integration tests + new snapshots

**Critical constraint**: The `EvaluationPanel` and `StoryBiblePanel` export names and props interfaces MUST NOT change. The container component retains the original name and serves as the public API.

### Testing Strategy

- Snapshot tests for each new presentation component
- Unit tests for extracted hooks (renderHook)
- Existing integration tests MUST pass unchanged
- Visual regression: compare before/after screenshots

## 3. Interface Contract

```typescript
// MUST NOT change — backward compatibility
export interface EvaluationPanelProps {
  // existing props preserved exactly
}
export interface StoryBiblePanelProps {
  // existing props preserved exactly
}

// New internal interfaces (not exported from package)
interface EvaluationDimensionCardProps {
  dimension: WritingCraftDimension;
  score: number;
  expanded: boolean;
  onToggle: () => void;
}
```

Visual constraints reference: If DESIGN.md exists, sub-components MUST follow established design tokens for spacing, typography, and color.

## 4. Constraints & Risks

- **Risk (Medium)**: State coupling between sections may be tighter than apparent → mitigate with careful dependency mapping before extraction
- **Risk (Low)**: Performance regression from additional component boundaries → mitigate with React.memo on leaf components
- **Constraint**: MUST NOT introduce new state management libraries
- **Constraint**: File organization follows existing `components/` flat structure (no nested folders unless 5+ sub-components)

## 5. Acceptance Criteria

- [ ] EvaluationPanel container < 300 lines
- [ ] StoryBiblePanel container < 300 lines
- [ ] All sub-components < 400 lines
- [ ] Existing test suite passes (zero failures)
- [ ] Snapshot tests added for all new components
- [ ] No visual regressions (manual verification)
- [ ] Props interfaces unchanged (TypeScript compilation passes)

## 6. Detailed Analysis References

- @system-architect/analysis-F-002-giant-component-split.md — Container/presentation pattern, hook extraction
- @product-manager/analysis-F-002-giant-component-split.md — User stories, DX impact
- @data-architect/analysis-F-002-knowledge-model.md — Entity data model context

## 7. Cross-Feature Dependencies

- **Depends on**: F-001 (new sub-components use LogService, not console)
- **Produces**: Clean panel architecture for F-007 (new visualization panel follows same pattern)
- **EP-004 applied**: Observability metric `component.render.duration` histogram
