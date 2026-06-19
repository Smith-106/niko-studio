# F-003 — AI Guided Selection Mode (Guided Mode)

> Role: subject-matter-expert | Related decisions: SME-01, SME-03, SA-03, PM-05

## Architecture

Guided mode implements the second tier of the Co-Writing Engine. It generates three scored continuation options, each evaluated against the four-dimension quality criteria. The user selects one option or requests regeneration. This mode balances AI initiative with user control — the system proposes, the author disposes.

The pipeline extends Auto mode's shared context pipeline with a multi-candidate generation loop and a scoring/ranking stage. Each candidate runs through Quality Control independently, producing per-option quality reports that inform the scoring.

## Interface Contract

- `generateGuidedOptions(sessionId: string, options: GuidedOptions): GuidedResult` — produces three scored continuation options
- `GuidedOptions { creativityLevel: CreativitySpectrum, focusDimension?: QualityDimension, maxLength: number }` — user-tunable parameters with optional dimension focus
- `GuidedResult { options: ScoredOption[], metadata: GenerationMetadata }` — three options with scores and quality reports
- `ScoredOption { text: string, score: number, dimensionScores: DimensionScores, qualityReport: QualityReport }` — per-option detail

Consumers: Writing Workspace (displays option cards in sidebar, see UX-01), Quality Control (scores each option).

## Constraints (RFC 2119)

- Guided mode MUST generate exactly three continuation options per request, each independently scored against the four quality dimensions (see SME-01)
- Each option MUST be tagged with generation metadata including: mode ("guided"), confidence score, per-dimension scores, and constraint violations (see SME-03)
- The scoring system MUST weight the four dimensions (plot coherence, character consistency, style consistency, pacing/tension) with configurable weights; default weights MUST be equal
- Options that fail hard constraints MUST be marked as "constraint-violating" and presented with lower visual prominence than compliant options
- The creativity slider MUST apply to all three options uniformly; the system SHOULD NOT generate options at different creativity levels within a single request
- Guided mode MUST read from Story Bible for character/world consistency checking across all three options

## Test Approach

- Unit: Scoring function correctly weights and ranks three options; constraint-violating options are flagged
- Integration: End-to-end Guided generation with mock LLM; three options produced with distinct quality profiles
- Quality benchmark: Option quality distribution measured across reference manuscripts — at least one option SHOULD pass all hard constraints
- Edge cases: All three options fail hard constraints (trigger regeneration prompt), Story Bible missing key character data

## TODOs

- Define scoring algorithm: weighted sum vs. multi-criteria decision analysis
- Determine how dimension weights are configured (per-user, per-genre, per-session)
- Study Sudowrite's Guided mode scoring for reference (see design-research)
- Specify regeneration behavior when all options fail constraints
- Define how focusDimension parameter affects generation and scoring
