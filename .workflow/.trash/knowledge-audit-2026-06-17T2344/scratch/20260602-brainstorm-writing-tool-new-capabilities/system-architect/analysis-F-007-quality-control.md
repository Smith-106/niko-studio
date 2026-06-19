# F-007 — Quality Control Mechanism

> Role: system-architect | Related decisions: SA-05, SME-01

## Architecture

Quality Control implements a two-tier constraint system (SA-05): hard constraints from Craft Analysis Services (enforced) and soft constraints from the creativity spectrum (advisory). The QC module serves both the Co-Writing Engine (post-processing stage) and the Reader Simulation Engine (editorial analysis).

**Component layout:**

`
QualityControlModule (new)
  +-- HardConstraintEngine (wraps CAS)
  |     +-- PlotCoherenceChecker
  |     +-- CharacterConsistencyChecker
  |     +-- StyleConsistencyChecker
  |     +-- PacingTensionChecker
  +-- SoftConstraintEngine (new)
  |     +-- CreativitySpectrum (Conservative / Balanced / Creative / Experimental)
  |     +-- StylePersonalizationAdapter (reads Session Intelligence)
  |     +-- AdvisoryGenerator (produces non-blocking suggestions)
  +-- ConstraintAggregator
       +-- merges hard violations + soft advisories
       +-- produces annotated output with both tiers
`

Hard constraints map directly to the four Craft Analysis dimensions (SME-01). Each checker invokes the corresponding CAS endpoint and returns pass/fail with a severity score. Failures above the configured threshold (default 0.7) MUST block output from entering the `applied` state in the Co-Writing state machine.

Soft constraints operate on the creativity spectrum (PM-05, UX-03). The CreativitySpectrum defines four presets: Conservative (0.0-0.3), Balanced (0.3-0.6), Creative (0.6-0.8), Experimental (0.8-1.0). The StylePersonalizationAdapter reads Session Intelligence to learn the user's established writing patterns and generates advisory suggestions when AI output deviates significantly. Soft constraint violations are advisory — they appear as suggestions but do not block output.

The ConstraintAggregator merges both tiers into a single annotated output. Each annotation includes: tier (hard/soft), dimension, severity, description, and suggested fix.

## Interface Contract

**MCP Quality Control API:**

- `POST /mcp/quality-control/check` with body `{ text_segment, constraint_tier: hard|soft|both, context: { sb_entities, session_style_profile } }`
- Response: `{ hard_violations: [{ dimension, severity, description, suggested_fix }], soft_advisories: [{ dimension, deviation_pct, description, suggestion }], overall_score: float, metadata }`

- `GET /mcp/quality-control/creativity-presets` — returns the four creativity spectrum presets with their parameter ranges
- `POST /mcp/quality-control/creativity-custom` — create custom creativity preset

Hard constraint check is a synchronous call that MUST complete before output progresses in the pipeline. Soft constraint check MAY run asynchronously with results appended after initial output delivery.

## Constraints (RFC 2119)

- Hard constraints from CAS MUST be enforced; violations above the threshold MUST block output from the applied state (SA-05)
- Soft constraints from the creativity spectrum MUST be advisory; they MUST NOT block output generation (SA-05)
- The four quality dimensions (plot, character, style, pacing) MUST all be checked in the hard constraint tier (SME-01)
- Creativity spectrum presets MUST include Conservative, Balanced, Creative, Experimental with defined parameter ranges (UX-03)
- Hard constraint checks MUST be synchronous in the pipeline; soft constraint checks MAY be asynchronous
- The ConstraintAggregator MUST produce a single merged output with clear tier labeling for each annotation
- Style personalization MUST read from Session Intelligence; it MUST NOT maintain a separate style model

## Test Approach

- **Unit**: Each CAS dimension checker, creativity spectrum preset boundaries, severity threshold logic, advisory generation
- **Integration**: CAS endpoint invocation, Session Intelligence style profile reading, pipeline integration with Co-Writing PostProcessor
- **Fuzz**: Text segments with no SB context, extremely short segments, segments with intentional style deviation
- **E2E**: AI generates text -> hard constraint check runs -> violations surfaced -> user revises -> soft advisory suggestions available

## TODOs

- Define severity thresholds per dimension for hard constraint blocking
- Specify Session Intelligence style profile data contract for soft constraint engine
- Determine CAS endpoint mapping for each of the four dimensions
- Design custom creativity preset schema
