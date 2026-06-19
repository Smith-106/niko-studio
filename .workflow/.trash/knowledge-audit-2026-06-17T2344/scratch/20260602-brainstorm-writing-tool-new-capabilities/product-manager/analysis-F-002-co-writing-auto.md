# F-002 — AI 自动续写模式（Auto mode）

> Role: product-manager | Related decisions: PM-01, PM-02, PM-04, PM-05, SA-03

## Architecture

Auto mode is the lowest-friction Co-Writing entry point. The user triggers continuation, and the system generates text that follows the current narrative direction. The shared context pipeline (SA-03) operates as: Context Scraper (reads Story Bible + recent text + session intelligence) → Prompt Assembler (builds generation prompt) → Model Router (selects optimal LLM) → Output Aggregator (assembles result) → Post-Processing (applies quality constraints).

Auto mode is the first mode implemented in the MVP (PM-02), paired with Guided mode. It targets the "stuck writer" scenario — the user has narrative momentum but needs a push forward.

## Interface Contract

| Interface | Contract | Consumers |
|-----------|----------|-----------|
| `coWriting.auto` | `{ cursor, contextWindow, creativityLevel } → GeneratedText` | Writing workspace |
| `coWriting.preview` | `{ generatedId } → PreviewResult` | Inline hint display (UX-01) |
| `coWriting.accept` | `{ generatedId, edits? } → void` | Editor integration |
| `coWriting.reject` | `{ generatedId, reason? } → void` | Feedback loop |

The `creativityLevel` parameter maps to the creativity slider (PM-05, UX-03). Default value MUST be "Balanced" to prevent over-generation.

## Constraints (RFC 2119)

- Auto mode output MUST be framed as "first draft" quality with an explicit revision path (PM-04).
- Each generation MUST include a creativity slider with sensible defaults (PM-05).
- The context pipeline MUST read from Story Bible before every generation call (SA-03).
- Auto mode MUST NOT generate text without Story Bible context — fallback to prompting user to set up Story Bible.
- Generated text MUST be tagged with metadata: generation mode, confidence score, constraint violations (SME-03).
- The system SHOULD implement automatic context summarization (Shrink Ray pattern) for chapters beyond the current context window (SA-07).

## Test Approach

- Unit: Context Scraper assembly, Prompt Assembler formatting, creativity slider parameter mapping.
- Integration: Full pipeline from trigger to generated output with mock Story Bible.
- E2E: Writer triggers Auto mode, receives suggestion, accepts/rejects, text integrates into manuscript.
- Quality: Measure generation relevance against Story Bible entities; track over-generation rate.

## TODOs

- Define "sensible defaults" for creativity slider per genre.
- Determine minimum Story Bible completeness threshold for Auto mode activation.
- Specify confidence score calculation methodology.
- Design feedback loop from reject reasons to future generation quality.
