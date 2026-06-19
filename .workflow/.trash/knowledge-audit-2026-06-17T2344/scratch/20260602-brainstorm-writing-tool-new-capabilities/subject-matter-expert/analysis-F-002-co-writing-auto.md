# F-002 — AI Auto-Continuation Mode (Auto Mode)

> Role: subject-matter-expert | Related decisions: SME-01, SME-03, SA-03, PM-04, PM-05

## Architecture

Auto mode implements the first tier of the Co-Writing Engine's three-mode architecture. It operates as a free continuation generator: given the current writing context (session intelligence + Story Bible + recent text), it produces a continuation draft. The shared context pipeline (see SA-03) feeds: Context Scraper → Prompt Assembler → Model Router → Output Aggregator → Post-Processing.

Auto mode's distinguishing characteristic is minimal user intervention — the system infers continuation direction from session context and Story Bible state. Quality Control runs as a post-processing gate, checking the four dimensions before presenting output.

## Interface Contract

- `generateAutoContinuation(sessionId: string, options: AutoOptions): ContinuationResult` — produces continuation text with metadata
- `AutoOptions { creativityLevel: CreativitySpectrum, maxLength: number, contextWindowOverride?: number }` — user-tunable parameters
- `ContinuationResult { text: string, metadata: GenerationMetadata, qualityReport: QualityReport }` — output with required metadata tagging (see SME-03)

Consumers: Writing Workspace (displays inline hints + sidebar detail, see UX-01), Quality Control (receives generated text for constraint checking).

## Constraints (RFC 2119)

- Auto-generated text MUST be tagged with metadata including: generation mode ("auto"), confidence score, and any constraint violations detected by Quality Control (see SME-03)
- Auto mode MUST apply Quality Control four-dimension checks (plot coherence, character consistency, style consistency, pacing/tension) as a post-processing gate (see SME-01)
- Auto mode MUST frame output as "first draft" quality with an explicit revision path, not publication-ready text (see PM-04)
- The creativity slider MUST have sensible defaults that constrain output style to prevent over-generation and purple prose (see PM-05)
- Auto mode MUST read from Story Bible as the primary context source; missing or incomplete Story Bible entries MUST trigger a warning before generation
- Context window management MUST implement automatic summarization for chapters beyond the current window (see SA-07)

## Test Approach

- Unit: Context Scraper assembles correct context from session + Story Bible; Prompt Assembler formats prompts per model requirements
- Integration: End-to-end Auto continuation with mock LLM; Quality Control gate blocks low-quality output
- Quality benchmark: Generated continuations evaluated against four-dimension quality criteria on reference manuscripts
- Edge cases: Empty Story Bible, very long manuscript exceeding context window, genre-switching mid-chapter

## TODOs

- Define confidence score calculation methodology for Auto mode output
- Determine Quality Control threshold for blocking vs. warning on constraint violations
- Study Sudowrite's Auto mode implementation for context assembly patterns (see design-research)
- Define "sensible defaults" for creativity slider per genre
- Specify how session intelligence feeds into Auto mode context assembly
