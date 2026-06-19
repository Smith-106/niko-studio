# F-004 — AI 指令驱动模式（Directed mode）

> Role: ux-expert | Related decisions: UX-01, UX-05, UX-10

## Architecture

Directed mode reuses the existing Revision Protocol (IRevisionService) with an instruction input layer. The user types a natural language instruction (e.g., "make this paragraph more suspenseful"), and the AI generates a revision that appears inline with revision annotations, following the established revision annotation pattern.

The instruction input is a text field in the sidebar panel that activates when Directed mode is selected. The user types their instruction and presses Enter or clicks a Generate button. The revision output streams inline at the target text location, annotated with revision markers (additions highlighted in green, deletions in strikethrough red). The user accepts or rejects the revision using the existing revision accept/reject controls.

Directed mode is classified as SHOULD priority (see PM-02) and is not part of the initial MVP. Its interaction patterns are derived from the existing revision system, reducing the need for new UI components. The primary UX contribution is the instruction input design and the mapping between user instructions and revision protocol parameters.

The creativity spectrum slider in Directed mode defaults to Conservative, since directed revisions are typically more constrained than free-form generation.

## Interface Contract

**DirectedModeInstructionInput** interface:
- Input: placeholderText (string), isGenerating (boolean)
- Output: onInstructionSubmit callback (instruction: string)
- Behavior: Text field with placeholder guidance text; Enter or button click submits; disabled during generation; clear button resets field

**DirectedModeRevisionDisplay** interface:
- Input: originalText (string), revisedText (string), annotations (RevisionAnnotation[])
- Output: onAccept callback, onReject callback
- Behavior: Inline revision display with diff annotations; accept applies revision; reject reverts to original; follows existing revision UI patterns

## Constraints (RFC 2119)

- Directed mode MUST reuse the existing IRevisionService annotation and display patterns
- Instruction input MUST support Enter key submission and button click submission
- Instruction input MUST be disabled during generation to prevent duplicate submissions
- Revision output MUST stream inline with diff annotations (additions and deletions)
- Accept and reject controls MUST follow existing revision UI conventions for consistency
- The creativity slider default MUST be Conservative for Directed mode
- Placeholder text in instruction input SHOULD provide example instructions to guide the user
- Mode switching to or from Directed mode MUST NOT discard in-progress revisions (see UX-05)
- Instruction history SHOULD be accessible for re-use or modification in subsequent generations

## Test Approach

**Unit tests**:
- DirectedModeInstructionInput: verify text entry, Enter submission, button submission, disabled state during generation, clear functionality
- DirectedModeRevisionDisplay: verify diff annotations, accept action, reject action, consistency with existing revision UI

**Integration tests**:
- End-to-end flow: enter instruction, generate revision, accept revision, verify text update
- Mode switch flow: start revision in Directed mode, switch to Auto mode, verify revision preservation
- Instruction history: submit multiple instructions, verify history list, verify re-use of previous instruction

**Usability tests**:
- Task: Write an instruction and generate a revision. Measure instruction clarity and revision relevance.
- Task: Use instruction history to repeat a previous instruction. Measure discoverability of history feature.
- Task: Compare Directed mode revision with existing manual revision workflow. Measure efficiency gain.

## TODOs

- Define instruction input placeholder text and example instructions for common revision types
- Specify instruction history UI (dropdown list, recent items, persistent storage)
- Design instruction input validation (minimum length, prohibited content, empty instruction handling)
- Determine how instruction text maps to revision protocol parameters (prompt construction)
- Specify revision annotation styling consistency with existing IRevisionService UI
- Design creativity slider effect on Directed mode output (how Conservative vs Experimental changes revision behavior)
- Define generation timeout for complex instructions (loading state, retry option)
- Specify how Directed mode integrates with selection-based revision (select text then instruct vs instruct then target)
- Evaluate whether instruction input belongs in sidebar or as an inline floating input near the selection
