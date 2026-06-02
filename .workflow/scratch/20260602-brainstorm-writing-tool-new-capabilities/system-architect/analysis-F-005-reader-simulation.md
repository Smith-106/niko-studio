# F-005 — Reader Simulation Engine

> Role: system-architect | Related decisions: SA-01, SA-04, SA-05

## Architecture

The Reader Simulation Engine implements a parallel dual-engine architecture (SA-04): the Reader Persona Engine and the Editorial Analysis Engine run concurrently. Each engine produces independent results that are merged into a consensus report.

**Component layout:**

`
ReaderSimulationOrchestrator (new)
  +-- ReaderPersonaEngine (new)
  |     +-- PersonaStore (preset + custom persona definitions)
  |     +-- PersonaRunner (per-persona analysis pass)
  |     +-- EmotionMapper (maps persona reactions to narrative positions)
  +-- EditorialAnalysisEngine (wraps existing Craft Analysis Services)
  |     +-- DimensionAnalyzer (plot, character, style, pacing per SME-01)
  |     +-- ViolationReporter (produces hard constraint violations)
  +-- ConsensusMerger (new)
       +-- AgreementDetector (identifies where engines agree)
       +-- DiscrepancyHighlighter (flags where they disagree)
       +-- ReportGenerator (produces unified output)
`

The Reader Persona Engine runs 3-8 persona simulations in parallel (Slima validates this range). Each PersonaRunner receives the manuscript segment plus the persona definition (age, taste, reading history, attention pattern) and produces a reading experience report: where the persona lost interest, where they were surprised, emotional response curve.

The Editorial Analysis Engine wraps existing Craft Analysis Services, running the four quality dimensions (SME-01) as hard constraints (SA-05). It operates independently of persona simulation, providing objective craft quality assessment.

The ConsensusMerger combines both engine outputs. When reader persona feedback and editorial analysis agree on a problem, it is flagged as high-confidence. Discrepancies (e.g., readers love a section that editorial analysis flags) are highlighted as creative tension points rather than problems.

## Interface Contract

**MCP Reader Simulation API:**

- `POST /mcp/reader-simulation/run` with body `{ persona_ids[], chapter_range, dimensions[] }`
- Response: `{ persona_reports: [{ persona_id, experience: EmotionCurve[], flags: ReadingFlag[] }], editorial_report: { violations[], scores: DimensionScores }, consensus: { high_confidence_issues[], creative_tensions[] }, metadata }`

- `GET /mcp/reader-simulation/personas` — list available preset personas
- `POST /mcp/reader-simulation/personas` — create custom persona
- `GET /mcp/reader-simulation/health` — per-engine health status

The dual-engine results MUST be independently accessible; the `persona_reports` and `editorial_report` are returned as separate objects, and the `consensus` provides the merged view.

## Constraints (RFC 2119)

- Reader personas and editorial analysis MUST execute concurrently; neither engine MAY block the other (SA-04)
- If the Reader Persona Engine fails, the Editorial Analysis Engine MUST continue and return results independently, and vice versa
- The system SHOULD support up to 8 concurrent persona simulations without degradation
- Preset personas MUST include at minimum: Suspense Enthusiast, Literary Critic, General Reader (SME-02)
- Custom personas MUST accept configurable parameters: age, taste profile, reading history, attention pattern
- Consensus merging MUST distinguish between high-confidence issues (engines agree) and creative tensions (engines disagree)
- All simulation results MUST include per-engine health status in response metadata

## Test Approach

- **Unit**: Persona definition validation, emotion curve generation logic, consensus merging agreement/discrepancy detection
- **Integration**: Dual-engine parallel execution, CAS integration for editorial engine, MCP endpoint registration
- **Fuzz**: Conflicting persona definitions, extremely long chapters, zero-dimension analysis request
- **E2E**: User triggers simulation with 3 personas -> dual engines run -> consensus report with high-confidence issues and creative tensions -> results visualized on narrative panel

## TODOs

- Define persona definition schema (age range, taste vocabulary, attention model parameters)
- Specify emotion curve data format for integration with narrative visualization (F-006)
- Design CAS wrapping strategy for the Editorial Analysis Engine
- Determine consensus algorithm — simple majority voting vs. weighted agreement
- Benchmark parallel persona simulation latency and resource usage
