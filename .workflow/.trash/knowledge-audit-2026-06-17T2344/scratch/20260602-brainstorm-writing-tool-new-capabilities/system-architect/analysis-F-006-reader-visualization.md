# F-006 — Reader Simulation Visualization

> Role: system-architect | Related decisions: SA-04, UX-02

## Architecture

Reader Simulation Visualization overlays Reader Simulation Engine (F-005) results on the existing narrative visualization infrastructure (tension curve, timeline, character graph). It extends the existing visualization data contracts rather than creating new visualization components.

**Component layout:**

`
NarrativeVisualization (existing)
  +-- TensionCurve (existing) --extended--> ReaderEmotionOverlay
  +-- Timeline (existing) --extended--> ReadingFlagMarkers
  +-- CharacterGraph (existing) --extended--> PersonaReactionAnnotations
  +-- DetailPanel (new) --linked--> click-through from overlays
`

The architecture follows the overlay pattern: Reader Simulation data is rendered as additional layers on existing visualization components. The TensionCurve receives an emotion overlay per persona; the Timeline receives flag markers where readers lost interest; the CharacterGraph receives reaction annotations per persona.

The DetailPanel is a new component that provides click-through linkage (UX-02). Clicking on any overlay point opens the DetailPanel with the full persona report for that narrative position. The DetailPanel is shared across all overlay types and receives its data from the Reader Simulation API response.

Data flows from the Reader Simulation API through an adapter layer that transforms the simulation output into the existing visualization data format with extension fields. The adapter MUST NOT require changes to the base visualization component rendering logic.

## Interface Contract

**Visualization Data Adapter:**

- Input: Reader Simulation API response (see F-005)
- Output: Extended visualization data objects with `readerSim` namespace fields

Example extension for TensionCurve data points:
`{ narrative_position, tension_value, readerSim: { persona_id: emotion_value, ... } }`

**DetailPanel contract:**

- Receives `{ source: overlay_type, position: narrative_position, persona_id?, editorial_flag? }`
- Fetches detailed report segment from cached simulation results
- Renders persona-specific or editorial-specific detail view

The DetailPanel MUST link bidirectionally — selecting a persona in the panel highlights that persona's overlay across all visualizations.

## Constraints (RFC 2119)

- Reader Simulation overlays MUST extend existing visualization data contracts; new visualization components MUST NOT duplicate existing rendering (UX-02)
- The adapter layer MUST transform simulation data into the existing visualization format without requiring base component changes
- Click-through linkage MUST work bidirectionally: overlay click opens DetailPanel, panel selection highlights overlay (UX-02)
- The DetailPanel MUST support displaying both persona reports and editorial analysis for the same narrative position
- Overlay rendering MUST NOT degrade existing visualization performance; persona overlay count is capped at the number of active personas (max 8)

## Test Approach

- **Unit**: Data adapter transformation logic, overlay data point generation, DetailPanel data fetching
- **Integration**: Overlay rendering on existing TensionCurve, bidirectional linkage between overlay and DetailPanel
- **Fuzz**: Zero-persona simulation results, overlapping flag markers at same position, missing data points
- **E2E**: Simulation completes -> overlays appear on existing visualizations -> user clicks overlay -> DetailPanel opens with full report

## TODOs

- Audit existing narrative visualization data contracts to determine extension points
- Define adapter transformation rules for each visualization type
- Specify DetailPanel rendering contract for persona vs. editorial views
- Determine overlay rendering performance budget
