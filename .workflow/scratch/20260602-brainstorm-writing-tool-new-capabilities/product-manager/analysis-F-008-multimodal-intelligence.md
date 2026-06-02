# F-008 — 多模态故事智能（文本操作语义 + 可视化扩展）

> Role: product-manager | Related decisions: SA-06, PM-01

## Architecture

Multi-Modal Intelligence defines operation semantics (filter, lasso, perspective shift) for text first, then extends to visual targets when image generation is added (SA-06). This follows Vistoria's Instrumental Interaction pattern — same operations apply uniformly to both text and images, enabling future image-text co-editing without architectural rework.

This feature is classified as MAY priority (PM-01). It is the most complex capability and is deferred until Co-Writing and Reader Simulation are stable. The text-only operation semantics, however, SHOULD be defined early to avoid painting into a corner — the operation vocabulary is the foundation that both current text features and future visual features build upon.

## Interface Contract

| Interface | Contract | Consumers |
|-----------|----------|-----------|
| `mmi.filter` | `{ target, predicate } → FilteredResult` | Writing workspace, visualization |
| `mmi.lasso` | `{ target, region } → LassoResult` | Scene selection |
| `mmi.perspectiveShift` | `{ target, perspective } → ShiftedResult` | Perspective rewriting |
| `mmi.operations` | `→ Operation[]` | Operation registry |

Operations are polymorphic — `target` can be text range or (future) visual element. The operation registry enables extensibility.

## Constraints (RFC 2119)

- Operation semantics MUST be defined for text first, then extended to visual targets (SA-06).
- Multi-Modal Intelligence MUST NOT be prioritized above Co-Writing Engine or Reader Simulation (PM-01).
- Operations MUST be polymorphic — same operation applies to both text and visual targets.
- The operation vocabulary SHOULD be designed with future visual extension in mind, even in text-only MVP.
- Text-only operations MUST demonstrate clear value independent of visual capabilities.

## Test Approach

- Unit: Operation execution on text targets, polymorphic dispatch logic.
- Integration: Operation results feeding into Co-Writing context or Reader Simulation.
- E2E: Writer uses filter operation, receives filtered view, takes action.
- Forward-compatibility: Validate operation schema supports visual target extension without breaking changes.

## TODOs

- Define complete operation vocabulary beyond the three core operations.
- Specify polymorphic target schema supporting both text and visual elements.
- Study Vistoria's interaction model for operation design patterns.
- Determine minimum text-only operation set that demonstrates value.
