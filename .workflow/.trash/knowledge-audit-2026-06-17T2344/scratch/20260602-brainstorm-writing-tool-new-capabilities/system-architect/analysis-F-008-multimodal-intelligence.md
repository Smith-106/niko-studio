# F-008 — Multi-Modal Story Intelligence

> Role: system-architect | Related decisions: SA-01, SA-06

## Architecture

Multi-Modal Story Intelligence defines operation semantics for text first, then extends to visual targets when image generation is added (SA-06). The architecture follows Vistoria's Instrumental Interaction pattern: the same interaction primitives apply uniformly regardless of the target modality.

**Component layout:**

`
MultiModalIntelligence (new, MAY priority)
  +-- OperationRegistry (maps operation names to handlers)
  +-- TextOperationHandler (initial implementation)
  |     +-- FilterOp (filter narrative by character/location/plot-thread)
  |     +-- LassoOp (select and group related text segments)
  |     +-- PerspectiveShiftOp (rewrite from different character POV)
  |     +-- CollageOp (rearrange selected segments into new order)
  +-- VisualOperationHandler (future, stub only)
  |     +-- (same operations, different target type)
  +-- OperationDispatcher (routes operation to correct handler by target type)
  +-- MCP Adapter (exposes /mcp/multimodal/* endpoints)
`

The OperationRegistry defines the canonical set of operations (filter, lasso, perspective shift, collage). Each operation has a typed interface that accepts a target type (text or visual) and target-specific parameters. The OperationDispatcher inspects the target type and routes to the appropriate handler.

For the initial text-only phase, all operations target text segments in the manuscript. FilterOp scopes the visible manuscript to entities matching criteria (e.g., show only scenes where Character A appears). LassoOp groups related paragraphs for batch operations. PerspectiveShiftOp rewrites selected text from a different character's viewpoint using the Co-Writing Engine's Directed mode as the underlying generator. CollageOp rearranges segments and checks for narrative coherence via Quality Control.

The VisualOperationHandler is a stub in the initial implementation. It registers the same operations but with visual target types. When image generation is added later, the handler implementations will process image targets using the same operation interfaces, achieving the Vistoria pattern of polymorphic operations.

## Interface Contract

**MCP Multi-Modal Intelligence API:**

- `POST /mcp/multimodal/execute` with body `{ operation: enum(filter, lasso, perspective_shift, collage), target_type: enum(text, visual), target_ref: string, parameters: Map<string,any> }`
- Response: `{ result: operation-specific, target_type, operation, metadata }`

- `GET /mcp/multimodal/operations` — list available operations with their parameter schemas
- `GET /mcp/multimodal/capabilities` — list supported target types (initially: text only)

Operation-specific parameters:

- **filter**: `{ criteria: [{ field, operator, value }] }`
- **lasso**: `{ segment_ids[], group_label }`
- **perspective_shift**: `{ target_character_id, preserve_plot: boolean }`
- **collage**: `{ segment_ids[], new_order: int[], coherence_check: boolean }`

## Constraints (RFC 2119)

- Operation semantics MUST be defined for text targets first; visual extension MAY follow when image generation is added (SA-06)
- The same operation names and parameter schemas MUST apply to both text and visual targets (Vistoria Instrumental Interaction pattern)
- The VisualOperationHandler MUST be registered as a stub; it MUST return a "not yet supported" response for visual target types in the initial implementation
- PerspectiveShiftOp MUST use the Co-Writing Engine Directed mode as its underlying generation mechanism (SA-03 reuse)
- CollageOp with `coherence_check: true` MUST invoke Quality Control hard constraints on the rearranged text (SA-05)
- Multi-Modal Intelligence is MAY priority; it MAY be deferred entirely to a post-MVP release (PM-01)

## Test Approach

- **Unit**: Operation parameter validation, dispatcher routing by target type, each text operation handler
- **Integration**: PerspectiveShiftOp integration with Directed mode pipeline, CollageOp integration with Quality Control
- **Fuzz**: Invalid operation names, visual target type requests (expect "not yet supported"), conflicting filter criteria
- **E2E**: User selects text segments -> applies filter -> filtered view displayed -> user lasso segments -> user applies perspective shift -> rewritten text appears

## TODOs

- Define detailed parameter schemas for each operation
- Specify how FilterOp interacts with the existing manuscript editor rendering
- Design the stub response format for visual target types
- Determine how CollageOp reordering propagates changes back to the manuscript data model
- Evaluate whether PerspectiveShiftOp should stream output or deliver as a batch
