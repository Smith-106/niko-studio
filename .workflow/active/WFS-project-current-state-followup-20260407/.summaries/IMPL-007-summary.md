## Summary
Closed the non-skill knowledge-tab dead ends by adding a shared selected-item detail surface in `KnowledgeModal`, wiring the three tab card clicks into it, and turning empty-state add CTAs into explicitly disabled controls.

## Files Modified
- `desktop/src/components/KnowledgeModal.tsx`
- `desktop/src/components/knowledge/CharacterTab.tsx`
- `desktop/src/components/knowledge/LocationTab.tsx`
- `desktop/src/components/knowledge/PlotTab.tsx`

## Key Decisions
- Kept the feature read-only; no create APIs or backend mutations were added.
- Reused a modal-level detail card instead of inventing three tab-specific detail panels.
- Left full behavior assertions to `IMPL-008`; this task establishes the interaction and visual boundary.

## Tests
- `npm --prefix desktop run typecheck`
- `npm --prefix desktop run test -- src/components/KnowledgeModal.test.tsx`
