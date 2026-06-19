# Finding: Story Bible Quality Gate

> Role: system-architect | Impact: HIGH

## Description

Story Bible completeness gates all downstream AI quality. The design research (Sudowrite data) indicates that users who skip Story Bible setup have significantly worse AI output quality — the SB is the single source of truth for grounding generation in story facts. Incomplete or incorrect SB data produces incoherent, inconsistent, or contradictory AI output.

The quality gate problem has two dimensions:

1. **Auto-extraction robustness** — The AutoExtractor must reliably identify entities from manuscript text. Low-confidence extractions that are silently included degrade SB quality. High-confidence extractions that are rejected by the user waste computational resources and create friction.

2. **Minimum viable SB** — The Co-Writing Engine requires a minimum set of SB entities before it can generate coherent output. If the SB is empty or critically incomplete, the state machine guard (see index, state machine section) should block generation and prompt the user to populate the SB first.

The design research (Sudowrite, CreAgentive) emphasizes that Story Bible construction MUST be easy, not optional. Auto-extraction from manuscript text is the primary mechanism for lowering the barrier, but it must be robust enough that users trust the extracted entities.

## Affected Features

- F-001 (Story Bible) — Auto-extraction quality directly determines SB completeness
- F-002, F-003, F-004 (Co-Writing modes) — SB completeness gates generation quality
- F-005 (Reader Simulation) — SB entities provide grounding for persona simulations
- SA-02 (KE extension) — SB schema design impacts auto-extraction feasibility
- PM-03 (hybrid mode) — Auto-extract + user supplement pattern depends on robust extraction

## Recommendation

Implement a four-part quality gate strategy:

1. **Confidence threshold tuning** — The default confidence threshold (0.6) should be validated against real manuscript data. The threshold SHOULD be adjustable per entity type (e.g., character names may require higher confidence than world rules). Entities below the threshold MUST be flagged for user review with a clear explanation of why confidence is low (e.g., "character mentioned only once in passing").

2. **Minimum SB requirements** — Define the minimum entity set required for Co-Writing: at least 1 CharacterProfile, at least 1 PlotThread, and at least 3 TimelineEvents. The state machine guard MUST check these minimums before allowing the transition from idle to context_gathering. If minimums are not met, the system MUST display a prompt: "Your Story Bible needs at least [X] before AI can help. Would you like to auto-extract from your manuscript?"

3. **SB quality score** — Compute an overall SB quality score based on entity count, confidence distribution, and relationship density. The score SHOULD be visible to users as a "Story Bible Health" indicator. Low scores (< 0.5) trigger proactive suggestions to run auto-extraction or manually add entities.

4. **Extraction feedback loop** — When users reject auto-extracted entities, the rejection SHOULD feed back into the AutoExtractor's confidence model. If a pattern of rejections emerges (e.g., a specific entity type is consistently over-extracted), the extraction rules should be adjusted. This requires logging rejection reasons and periodic model tuning.

The SB quality gate MUST be enforced at the state machine level, not just as a UI prompt. The guard condition ensures that Co-Writing cannot proceed with an insufficient SB, preventing the poor user experience documented in Sudowrite's data.
