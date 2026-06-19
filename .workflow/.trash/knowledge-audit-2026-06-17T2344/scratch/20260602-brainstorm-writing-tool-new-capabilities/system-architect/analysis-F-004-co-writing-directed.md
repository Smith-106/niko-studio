# F-004 — AI Directed Mode (Directed Mode, Reuses Revision Protocol)

> Role: system-architect | Related decisions: SA-01, SA-03, SA-05

## Architecture

Directed mode allows users to provide explicit instructions that drive generation. It reuses the existing Revision Protocol (IRevisionService) infrastructure rather than building a separate instruction-handling pipeline. The shared context pipeline feeds into a revision-style request where the user instruction becomes the revision directive.

**Pipeline for Directed mode:**

`
ContextScraper (gathers chapter + SB + session)
  -> PromptAssembler (builds instruction-grounded prompt: user_instruction + context + creativity)
  -> ModelRouter (routes to logic-optimized model per routing rules)
  -> OutputAggregator (collects instruction-following output)
  -> RevisionValidator (validates output against user instruction intent)
  -> PostProcessor (runs QC hard constraints)
`

The key differentiator is the RevisionValidator stage, which checks whether the generated output actually follows the user's instruction. This stage leverages the existing IRevisionService validation logic — the user instruction is treated as a revision directive, and the generated output is treated as a revision result.

Directed mode targets the SHOULD priority tier per PM-02; the MVP implements Auto + Guided first, and Directed follows by extending the Revision Protocol integration point. The model routing favors logic-optimized models over creative-prose models because instruction following requires stronger reasoning.

## Interface Contract

**MCP Co-Writing API — Directed mode:**

- `POST /mcp/co-writing/directed` with body `{ chapter_id, cursor_position, instruction: string, creativity_level?, context_scope_override? }`
- Response: `{ continuation_text, instruction_followed: boolean, instruction_analysis: { intent_detected, directives_found[], coverage_pct }, metadata }`

The `instruction` field is mandatory for Directed mode. The `instruction_analysis` block provides transparency on how the system interpreted the user instruction and what percentage of detected directives were followed in the output.

The RevisionValidator returns `instruction_followed: false` when coverage_pct falls below a configurable threshold (default 80%), entering the `review` state with a warning annotation.

## Constraints (RFC 2119)

- Directed mode MUST reuse the existing IRevisionService for instruction validation (SA-03 + PM-02 cross-reference)
- The `instruction` field MUST be mandatory; requests without it MUST be rejected with a 400 error
- The RevisionValidator MUST detect at least the intent of the user instruction; partial coverage below 80% MUST generate a warning
- Directed mode SHOULD route to logic-optimized models rather than creative-prose models for better instruction following
- Hard constraint violations MUST be surfaced identically to Auto and Guided modes (SA-05)
- Directed mode is SHOULD priority for MVP; the MVP MAY defer this mode to a post-MVP release (PM-02)

## Test Approach

- **Unit**: Instruction parsing and intent detection, RevisionValidator coverage calculation, mandatory field validation
- **Integration**: Revision Protocol integration, instruction-grounded prompt assembly, model routing for logic-optimized selection
- **Fuzz**: Ambiguous instructions, conflicting instructions with SB entities, very long instructions exceeding prompt budget
- **E2E**: User types instruction -> Directed mode generates -> instruction_followed flag shown -> user accepts or revises instruction

## TODOs

- Audit IRevisionService interface to confirm compatibility with Directed mode instruction validation
- Define instruction parsing grammar — what constitutes a directive vs. context
- Specify model routing rule for logic-optimized model selection
- Determine interaction between Directed mode and Revision Protocol's existing diff/accept workflow
