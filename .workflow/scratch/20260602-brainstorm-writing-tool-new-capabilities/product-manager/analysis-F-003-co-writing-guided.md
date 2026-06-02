# F-003 — AI 引导选择模式（Guided mode，3 选项评分）

> Role: product-manager | Related decisions: PM-01, PM-02, PM-04, PM-05, SA-03

## Architecture

Guided mode presents the user with three scored continuation options, each taking a different narrative direction. This mode targets the "exploring possibilities" scenario — the user wants to see alternatives before committing. The shared context pipeline (SA-03) generates three outputs in parallel, each scored against the four quality dimensions (SME-01): plot coherence, character consistency, style consistency, and pacing/tension.

The three-option design follows Sudowrite's validated Guided pattern. Scoring provides objective comparison, reducing the subjective burden of choosing between alternatives.

## Interface Contract

| Interface | Contract | Consumers |
|-----------|----------|-----------|
| `coWriting.guided` | `{ cursor, contextWindow, creativityLevel } → GuidedResult{options: [ScoredOption×3]}` | Writing workspace |
| `coWriting.select` | `{ optionId } → void` | Editor integration |
| `coWriting.mix` | `{ optionIds, weights } → MixedText` | Advanced users |

Each `ScoredOption` contains: generated text, four-dimension scores, overall score, narrative direction label (e.g., "escalate tension", "introduce subplot", "deepen character").

## Constraints (RFC 2119)

- Guided mode MUST generate exactly three options per trigger, each with a distinct narrative direction.
- Each option MUST be scored on four dimensions: plot coherence, character consistency, style consistency, pacing/tension (SME-01).
- Guided mode output MUST be framed as "first draft" quality (PM-04).
- The creativity slider MUST apply to all three options uniformly (PM-05).
- Options MUST be displayed with scores visible to the user for informed selection.
- The system SHOULD support mixing elements from multiple options for advanced users.

## Test Approach

- Unit: Scoring algorithm per dimension, option differentiation logic.
- Integration: Three-option generation pipeline with Story Bible context.
- E2E: Writer triggers Guided mode, reviews three scored options, selects one, text integrates.
- Quality: Measure option differentiation (cosine similarity between options MUST be below threshold).

## TODOs

- Define narrative direction taxonomy for option labeling.
- Specify scoring algorithm weights per dimension.
- Determine whether mixing options is MVP or post-MVP.
- Design how scores are presented to non-technical users.
