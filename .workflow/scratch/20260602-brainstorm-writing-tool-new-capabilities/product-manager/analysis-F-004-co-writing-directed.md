# F-004 — AI 指令驱动模式（Directed mode，复用 revision protocol）

> Role: product-manager | Related decisions: PM-01, SA-03

## Architecture

Directed mode gives the user explicit control over AI output through natural language instructions. It reuses the existing Revision Protocol (IRevisionService) as its execution backbone, extending it from revision-only to generation-with-instruction. The user provides a directive (e.g., "rewrite this scene from the antagonist's perspective"), and the system executes it within the shared context pipeline (SA-03).

Directed mode is classified as SHOULD priority (not MUST) in the MVP. It is the most powerful but also the most complex mode, requiring users to formulate effective instructions. Per PM-01 and PM-02, MVP delivers Auto + Guided; Directed follows in the next release.

## Interface Contract

| Interface | Contract | Consumers |
|-----------|----------|-----------|
| `coWriting.directed` | `{ cursor, instruction, contextWindow, creativityLevel } → DirectedResult` | Writing workspace |
| `coWriting.refine` | `{ resultId, refinedInstruction } → DirectedResult` | Iterative refinement |

The `instruction` parameter is a free-form natural language directive. The system MUST parse and validate it against Story Bible constraints before execution.

## Constraints (RFC 2119)

- Directed mode MUST reuse the existing Revision Protocol as its execution backbone.
- Directed mode SHOULD be deferred to post-MVP; MVP scope includes Auto + Guided only (PM-02).
- User instructions MUST be validated against Story Bible context to prevent contradictory generation.
- Directed mode output MUST be framed as "first draft" quality (PM-04).
- The creativity slider MUST apply to Directed mode generation (PM-05).
- The system SHOULD provide instruction templates for common directives to lower the learning curve.

## Test Approach

- Unit: Instruction parsing and validation, Revision Protocol integration.
- Integration: Full pipeline with instruction + Story Bible context.
- E2E: Writer provides directive, system generates, writer refines iteratively.
- Quality: Measure instruction adherence rate (output matches directive intent).

## TODOs

- Define instruction template library for common directives.
- Determine instruction validation rules against Story Bible.
- Specify iterative refinement UX flow.
- Assess Revision Protocol extension scope for generation use cases.
