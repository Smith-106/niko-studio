# F-005 — 读者模拟引擎（预设 + 自定义角色，4 维度检查）

> Role: product-manager | Related decisions: PM-01, PM-02, SA-04, SME-01, SME-02

## Architecture

Reader Simulation runs as a parallel dual-engine (SA-04): reader personas execute alongside editorial analysis, neither blocks the other. Three preset personas (Suspense Enthusiast, Literary Critic, General Reader) provide out-of-the-box coverage, while custom parameters (age, taste, reading history) enable niche audience analysis (SME-02).

Each persona evaluates the manuscript across four dimensions (SME-01): plot coherence, character consistency, style consistency, and pacing/tension. Multi-model consensus (Beta Reader AI pattern) identifies high-confidence findings — when independent personas agree, the signal is reliable.

The MVP includes a basic version with 3 preset personas (PM-02), demonstrating the linkage between Co-Writing output and Reader Simulation feedback.

## Interface Contract

| Interface | Contract | Consumers |
|-----------|----------|-----------|
| `readerSimulation.run` | `{ manuscriptRange, personas[] } → SimulationResult` | Visualization (F-006) |
| `readerSimulation.personas` | `→ Persona[]` | Persona management UI |
| `readerSimulation.consensus` | `{ simulationId } → ConsensusReport` | Quality Control (F-007) |
| `readerSimulation.feedback` | `{ simulationId, personaId } → PersonaFeedback` | Detail panel (UX-02) |

## Constraints (RFC 2119)

- Reader Simulation MUST run reader personas and editorial analysis in parallel (SA-04).
- The system MUST provide at minimum three preset personas: Suspense Enthusiast, Literary Critic, General Reader (SME-02).
- Each persona MUST evaluate on four dimensions: plot coherence, character consistency, style consistency, pacing/tension (SME-01).
- Custom personas MUST support configurable parameters: age, taste, reading history (SME-02).
- The system SHOULD implement multi-model consensus — when independent personas agree, the finding is flagged as high-confidence.
- MVP MUST include Reader Simulation basic version with 3 preset personas (PM-02).

## Test Approach

- Unit: Persona parameter configuration, four-dimension scoring per persona.
- Integration: Dual-engine parallel execution with mock manuscript data.
- E2E: Writer runs simulation, reviews persona feedback, identifies consensus issues.
- Quality: Validate that consensus findings correlate with known manuscript issues.

## TODOs

- Define persona parameter schema and default values for presets.
- Specify consensus algorithm (simple majority vs weighted agreement).
- Determine how Reader Simulation feedback feeds back into Co-Writing constraints.
- Design custom persona creation UX flow.
