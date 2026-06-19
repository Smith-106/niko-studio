# F-005 — Reader Simulation Engine

> Role: subject-matter-expert | Related decisions: SME-01, SME-02, SA-04

## Architecture

Reader Simulation implements a parallel dual-engine architecture (see SA-04): reader personas and editorial analysis execute concurrently. Each reader persona reads the manuscript through its distinct lens, producing per-section feedback. Editorial analysis runs the four-dimension quality checks independently. Results merge into a consensus report.

The persona system supports three preset personas (Suspense Enthusiast, Literary Critic, General Reader) plus custom personas with configurable parameters (age, taste, reading history). Each persona applies weighted emphasis across the four quality dimensions, producing persona-specific feedback.

## Interface Contract

- `simulateReaders(manuscriptId: string, personas: PersonaSpec[]): SimulationResult` — runs parallel reader simulation
- `PersonaSpec { type: "preset" | "custom", presetId?: string, customParams?: CustomPersonaParams }` — persona specification
- `CustomPersonaParams { age: number, taste: string[], readingHistory: string[], dimensionWeights: DimensionWeights }` — custom persona parameters
- `SimulationResult { personaResults: PersonaResult[], consensusReport: ConsensusReport, editorialAnalysis: EditorialAnalysis }` — per-persona and merged results

Consumers: Reader Visualization (overlays results on narrative visualization, see UX-02), Quality Control (feeds editorial analysis into constraint system).

## Constraints (RFC 2119)

- Reader Simulation MUST include at minimum three preset personas: Suspense Enthusiast, Literary Critic, General Reader (see SME-02)
- Custom personas MUST support configurable parameters: age, taste profile, reading history, and dimension weight overrides (see SME-02)
- Each persona MUST evaluate the manuscript across all four quality dimensions (plot coherence, character consistency, style consistency, pacing/tension) with persona-specific weighting (see SME-01)
- The dual-engine architecture MUST run reader personas and editorial analysis concurrently; neither engine MAY block the other (see SA-04)
- Consensus reporting MUST identify issues where multiple independent personas agree — multi-model consensus signals high-confidence problems (see Beta Reader AI pattern in design-research)
- Persona definitions MUST persist across sessions; custom personas MUST be saveable and reusable

## Test Approach

- Unit: Persona weight application produces dimension-weighted feedback; consensus algorithm correctly identifies agreement
- Integration: End-to-end simulation with three preset personas on reference manuscript; results overlay on narrative visualization
- Quality benchmark: Simulation feedback compared against human beta reader feedback on same manuscripts
- Edge cases: Single persona simulation, all personas agree (strong signal), personas disagree on all dimensions (weak signal), custom persona with extreme weight values

## TODOs

- Define dimension weight profiles for each preset persona
- Design consensus algorithm: simple majority, weighted agreement, or Bayesian
- Study Slima's dual-engine architecture for persona-editor interaction patterns (see design-research)
- Define persona persistence schema and storage mechanism
- Determine how editorial analysis results feed into Quality Control hard constraints
