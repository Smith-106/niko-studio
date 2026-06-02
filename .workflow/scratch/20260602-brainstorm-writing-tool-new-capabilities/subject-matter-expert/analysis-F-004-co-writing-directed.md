# F-004 — AI Directed Mode (Directed Mode)

> Role: subject-matter-expert | Related decisions: SME-01, SME-03, SA-03, PM-02

## Architecture

Directed mode implements the third tier of the Co-Writing Engine, reusing the existing Revision Protocol (IRevisionService). The user provides explicit instructions (e.g., "rewrite this scene from the antagonist's perspective"), and the system executes a structured revision pass. This mode offers maximum user control — the author directs, the AI executes.

The pipeline maps user instructions to revision operations, applies them through the existing revision service, and runs Quality Control as a validation gate. Directed mode is deferred to post-MVP per PM-02.

## Interface Contract

- `executeDirectedRevision(sessionId: string, instruction: string, target: RevisionTarget, options: DirectedOptions): DirectedResult` — executes user-directed revision
- `RevisionTarget { textRange: TextRange, scope: RevisionScope }` — target text and scope definition
- `DirectedOptions { creativityLevel: CreativitySpectrum, preserveStyle: boolean }` — user-tunable parameters
- `DirectedResult { revisedText: string, metadata: GenerationMetadata, qualityReport: QualityReport, changeSummary: ChangeSummary }` — output with diff and quality report

Consumers: Writing Workspace (displays revision with diff view), Quality Control (validates revised text), Revision Protocol (execution engine).

## Constraints (RFC 2119)

- Directed mode MUST reuse the existing IRevisionService for execution; no parallel revision engine is permitted
- Directed output MUST be tagged with metadata including: mode ("directed"), confidence score, and constraint violations (see SME-03)
- Quality Control four-dimension checks MUST run on the revised text; violations MUST be reported but SHOULD NOT block the revision (advisory, not enforced)
- The change summary MUST highlight all modifications relative to the original text, enabling the user to accept/reject individual changes
- Directed mode MUST respect the creativity slider as a soft constraint on revision style (see PM-05)
- User instructions that conflict with Story Bible entries MUST trigger a warning with the conflicting entry reference

## Test Approach

- Unit: Instruction parsing maps user text to revision operations; change summary correctly diffs original vs. revised
- Integration: End-to-end directed revision through IRevisionService; Quality Control advisory report generated
- Quality benchmark: Directed revisions evaluated for instruction adherence and four-dimension quality
- Edge cases: Ambiguous instructions, instructions that contradict established Story Bible facts, very large revision targets

## TODOs

- Define instruction parsing grammar or template system for user directives
- Determine how Directed mode integrates with existing Revision Protocol workflow
- Specify change summary format (inline diff, side-by-side, or both)
- Study how Sudowrite's Tone Shift feature handles user-directed style changes (see design-research)
- Define warning behavior when instructions conflict with Story Bible
