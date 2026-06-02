# F-008 — Multi-Modal Story Intelligence

> Role: subject-matter-expert | Related decisions: SA-06, PM-01

## Architecture

Multi-Modal Intelligence defines operation semantics (filter, lasso, perspective shift) for text first, then extends to visual targets when image generation is added (see SA-06). This feature is the lowest priority per PM-01 and is deferred to post-MVP. The SME role contributes domain knowledge about which operations are meaningful for fiction writing and how they should behave on text targets.

The core operations map to writing-domain concepts: filter (show only character X's scenes), lasso (select a scene cluster for batch operation), perspective shift (rewrite from a different character's viewpoint). These operations MUST be defined with text-only semantics first, ensuring the interaction model is sound before adding visual targets.

## Interface Contract

- `executeOperation(operation: TextOperation, target: TextTarget): OperationResult` — applies a semantic operation to text
- `TextOperation { type: "filter" | "lasso" | "perspective_shift", params: OperationParams }` — typed operation with parameters
- `TextTarget { textRange: TextRange, context: OperationContext }` — target text with context

Consumers: Writing Workspace (operation UI), Story Bible (cross-reference queries for filter/lasso), Co-Writing Engine (perspective shift triggers directed revision).

## Constraints (RFC 2119)

- Operation semantics MUST be defined for text targets first; visual target extension MUST NOT alter text operation behavior (see SA-06)
- The filter operation MUST support filtering by character, plot thread, location, and time period
- The lasso operation MUST support selecting contiguous and non-contiguous scene clusters
- The perspective shift operation MUST trigger a Directed mode revision with the target character's viewpoint as the instruction
- All operations MUST preserve Story Bible cross-references; operations that would break entity relationships MUST warn the user

## Test Approach

- Unit: Each operation type correctly transforms text targets; filter produces correct subsets
- Integration: Perspective shift triggers Directed mode revision pipeline
- Edge cases: Filter returns empty set, lasso on single scene, perspective shift on omniscient narration

## TODOs

- Define complete operation catalog beyond the three core operations
- Study Vistoria's Instrumental Interaction pattern for polymorphic operation design (see design-research)
- Specify how operations interact with Story Bible entity relationships
- Design operation composability (can filter + lasso be combined)
