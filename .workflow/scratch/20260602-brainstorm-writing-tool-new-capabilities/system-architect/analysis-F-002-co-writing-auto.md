# F-002 — AI Auto Continuation Mode (Auto Mode)

> Role: system-architect | Related decisions: SA-01, SA-03, SA-05, SA-07

## Architecture

Auto mode is the simplest co-writing mode — it generates a free continuation from the current cursor position using the shared context pipeline (SA-03). It follows the full pipeline but with minimal user configuration: the system selects context scope automatically based on Session Intelligence.

**Component layout within the shared pipeline:**

`
ContextScraper (gathers current chapter + SB entities + session context)
  -> PromptAssembler (builds continuation prompt with creativity=0.5 default)
  -> ModelRouter (routes to creative-prose model)
  -> OutputAggregator (collects single continuation)
  -> PostProcessor (runs Quality Control hard constraints, SA-05)
`

Auto mode reuses Session Intelligence to determine the current narrative state (tension level, character focus, plot thread status) without requiring explicit user input. The creativity slider defaults to 0.5 (Balanced) per PM-05. The PostProcessor stage runs hard constraint checks via the Quality Control API; if violations are detected, the output enters the `review` state with violation annotations rather than being silently filtered.

The Context Scraper invokes the Shrink Ray summarizer (SA-07) when the current chapter plus referenced SB entities exceed the context window budget. Summarized chapters retain entity references so the PromptAssembler can still ground continuation in story facts.

## Interface Contract

**MCP Co-Writing API — Auto mode:**

- `POST /mcp/co-writing/auto` with body `{ chapter_id, cursor_position, creativity_level?, context_scope_override? }`
- Response: `{ continuation_text, metadata: { mode, model_id, creativity_used, sb_entities_referenced, constraint_violations[] } }`

The endpoint MUST accept optional `context_scope_override` for advanced users who want to narrow or broaden the gathered context. When omitted, the Context Scraper uses Session Intelligence defaults.

Auto mode MUST stream the continuation text token-by-token to the frontend via the existing streaming infrastructure (see useChatStreaming pattern). The OutputAggregator emits partial results as they arrive, and the final metadata is appended on stream completion.

## Constraints (RFC 2119)

- Auto mode MUST use the shared context pipeline (SA-03); it MUST NOT implement a separate generation path
- The creativity slider default MUST be 0.5 (Balanced); the user MAY override it per request (PM-05)
- Hard constraint violations MUST be surfaced in response metadata; the system MUST NOT silently discard violating output (SA-05)
- The Context Scraper MUST invoke Shrink Ray summarization when context exceeds the configured window budget (SA-07)
- Auto mode output MUST be tagged with generation mode, confidence score, and constraint violation metadata (SME-03)
- The system SHOULD complete context gathering within 2 seconds for manuscripts under 50K words with a populated Story Bible

## Test Approach

- **Unit**: Context Scraper entity selection logic, Shrink Ray threshold detection, creativity parameter validation, constraint violation annotation
- **Integration**: Full pipeline execution from chapter input to continuation output, streaming token delivery, SB entity reference grounding
- **Fuzz**: Empty chapter input, cursor at edge positions, extremely long chapters exceeding summarization threshold, SB with zero entities
- **E2E**: User triggers auto continuation from writing workspace -> streamed output appears inline -> metadata visible in sidebar

## TODOs

- Define context window budget allocation strategy (how much for current chapter vs. SB entities vs. session context)
- Specify streaming protocol details for partial output delivery
- Determine minimum SB entity count required before auto mode can generate (guard condition for state machine)
- Benchmark context gathering latency target
