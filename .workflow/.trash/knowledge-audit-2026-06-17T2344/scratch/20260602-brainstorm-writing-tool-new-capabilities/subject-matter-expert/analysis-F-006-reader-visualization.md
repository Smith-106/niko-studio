# F-006 — Reader Simulation Visualization

> Role: subject-matter-expert | Related decisions: SME-01, SA-04, UX-02

## Architecture

Reader Visualization overlays simulation results on the existing narrative visualization (tension curve, timeline). An independent detail panel provides per-section deep analysis with click-through linkage between overlay markers and detail entries. This feature is primarily a UX concern; the SME role contributes domain knowledge about what reader feedback dimensions map to which visual elements.

## Interface Contract

- `getVisualizationData(simulationId: string): VisualizationOverlay` — returns overlay data for narrative visualization
- `getSectionDetail(simulationId: string, sectionId: string): SectionDetail` — returns deep analysis for a specific section
- Consumers: Narrative Visualization (renders overlay), Detail Panel (renders section detail)

## Constraints (RFC 2119)

- Overlay markers MUST distinguish between persona-specific feedback and consensus feedback visually
- Click-through linkage MUST connect overlay markers to the corresponding detail panel entries bidirectionally (see UX-02)
- The four quality dimensions MUST map to distinct visual channels in the overlay (e.g., color, shape, position)
- Consensus-level issues (multiple personas agree) MUST be visually prioritized over single-persona feedback

## Test Approach

- Unit: Visualization data mapping correctly translates simulation results to overlay format
- Integration: Click-through linkage works bidirectionally between overlay and detail panel
- Visual regression: Overlay rendering matches design specifications

## TODOs

- Define visual channel mapping for four quality dimensions
- Specify overlay marker design for persona-specific vs. consensus feedback
- Coordinate with UX role on detail panel layout
