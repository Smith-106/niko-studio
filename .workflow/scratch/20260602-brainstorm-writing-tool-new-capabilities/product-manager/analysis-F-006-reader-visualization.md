# F-006 — 读者模拟可视化（叠加现有 + 详情联动）

> Role: product-manager | Related decisions: PM-01, UX-02, SA-04

## Architecture

Reader Simulation visualization overlays on the existing narrative visualization (tension curve, timeline) rather than creating a separate panel. This design leverages the user's familiarity with existing visualizations, reducing learning cost. An independent detail panel provides depth — clicking on overlay points triggers click-through linkage to persona-specific feedback (UX-02).

The overlay approach means Reader Simulation results appear in-context: tension anomalies flagged by reader personas highlight directly on the tension curve, character inconsistency markers appear on the timeline. This spatial coupling between simulation results and narrative structure makes findings immediately actionable.

## Interface Contract

| Interface | Contract | Consumers |
|-----------|----------|-----------|
| `readerVisualization.overlay` | `{ simulationId } → OverlayData` | Narrative visualization panel |
| `readerVisualization.detail` | `{ simulationId, personaId, pointId } → DetailView` | Detail panel |
| `readerVisualization.link` | `{ overlayPointId } → DetailPanelAnchor` | Click-through linkage |

## Constraints (RFC 2119)

- Reader Simulation results MUST overlay on existing narrative visualization (UX-02).
- An independent detail panel MUST provide click-through linkage from overlay points to persona feedback (UX-02).
- The visualization MUST NOT require users to learn a new spatial layout — it extends the existing one.
- Overlay rendering SHOULD be performant enough to support real-time updates during simulation runs.
- Detail panel linkage MUST be bidirectional — clicking detail items highlights corresponding overlay points.

## Test Approach

- Unit: Overlay data transformation, click-through linkage mapping.
- Integration: Simulation result → overlay rendering → detail panel population.
- E2E: Writer views overlay, clicks point, reviews persona detail, takes action.
- Performance: Measure overlay rendering latency with multiple persona results.

## TODOs

- Design overlay visual language (markers, colors, opacity levels).
- Specify detail panel layout for multi-persona feedback display.
- Determine overlay density limits to prevent visual clutter.
- Study existing narrative visualization API for extension points.
