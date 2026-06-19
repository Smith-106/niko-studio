# F-003 — AI Guided Selection Mode (Guided Mode)

> Role: system-architect | Related decisions: SA-01, SA-03, SA-05, SA-07

## Architecture

Guided mode generates three scored continuation options using the shared context pipeline (SA-03). The key architectural difference from Auto mode is that the OutputAggregator stage produces three parallel outputs instead of one, and a ScoringStage ranks them before presenting to the user.

**Extended pipeline for Guided mode:**

`
ContextScraper (gathers chapter + SB + session)
  -> PromptAssembler (builds 3 variant prompts with creativity offsets [-0.1, 0.0, +0.1])
  -> ModelRouter (routes all 3 to creative-prose model, MAY parallelize)
  -> OutputAggregator (collects 3 continuations)
  -> ScoringStage (scores each on: plot_coherence, character_consistency, style_match, pacing)
  -> PostProcessor (runs QC hard constraints, attaches scores)
`

The PromptAssembler introduces controlled variation across the three options by adjusting the creativity parameter with small offsets around the user-selected base creativity (PM-05). This produces one conservative, one balanced, and one creative option. The ScoringStage evaluates each option against four quality dimensions (SME-01) using Craft Analysis Services, producing a composite score. The three options are presented ranked by composite score.

The three generation paths MAY execute in parallel through the ModelRouter, subject to rate limiting constraints. If parallelism is not available due to rate limits, they MUST execute sequentially with a total latency budget.

## Interface Contract

**MCP Co-Writing API — Guided mode:**

- `POST /mcp/co-writing/guided` with body `{ chapter_id, cursor_position, creativity_level?, context_scope_override? }`
- Response: `{ options: [{ continuation_text, scores: { plot_coherence, character_consistency, style_match, pacing }, composite_score, metadata }], ranked: boolean }`

Each option includes the same metadata fields as Auto mode plus per-dimension scores. The `ranked` flag indicates whether options are sorted by composite score (default true).

Streaming applies to each option independently; the frontend SHOULD display options as they complete rather than waiting for all three.

## Constraints (RFC 2119)

- Guided mode MUST generate exactly three options; no more, no fewer (SA-03, validated by Sudowrite pattern)
- The ScoringStage MUST evaluate all four quality dimensions (plot, character, style, pacing) per SME-01
- Options MUST be ranked by composite score unless the client requests unranked delivery
- Creativity offsets between options MUST be configurable; default offsets are [-0.1, 0.0, +0.1] around the base creativity
- Hard constraint violations on any option MUST be surfaced in that option's metadata; the option MUST NOT be silently removed from results (SA-05)
- The three generation paths SHOULD execute in parallel when rate limits permit
- Total latency for all three options MUST NOT exceed 3x the single-option latency; if sequential execution is required, the system SHOULD prioritize lower-creativity options first for faster initial display

## Test Approach

- **Unit**: PromptAssembler creativity offset generation, ScoringStage composite score calculation, option ranking logic
- **Integration**: Three-option parallel pipeline execution, streaming delivery of multiple options, SB grounding across all three options
- **Fuzz**: Rate limit during parallel generation (fallback to sequential), zero-entity SB, conflicting quality dimension scores
- **E2E**: User triggers guided mode -> three options appear progressively in sidebar -> user selects one -> text inserted at cursor

## TODOs

- Define composite score weighting across the four quality dimensions
- Specify parallel execution strategy in ModelRouter (batch vs. concurrent requests)
- Design fallback behavior when fewer than 3 options pass hard constraints
- Determine if ScoringStage should re-use CAS output or invoke CAS independently
