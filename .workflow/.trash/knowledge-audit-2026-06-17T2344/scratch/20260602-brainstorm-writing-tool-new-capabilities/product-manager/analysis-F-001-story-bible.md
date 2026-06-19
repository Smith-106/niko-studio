# F-001 — Story Bible 引擎（扩展 KE + 自动提取 + 语义层）

> Role: product-manager | Related decisions: PM-03, SA-02, SME-04

## Architecture

Story Bible extends the existing KnowledgeEngine (KE) with four new entity types: CharacterProfile, WorldRule, PlotThread, TimelineEvent. The extension follows the established MCP endpoint pattern (see SA-01). Auto-extraction leverages existing Craft Analysis Services to populate entities from manuscript text, then users supplement deep settings via inline editing (see UX-04).

The hybrid construction model (PM-03) splits responsibility: automated extraction handles surface-level facts (character names, relationships, plot events), while user input owns subjective depth (motivations, world rules, thematic intent). This division lowers the activation barrier while preserving narrative richness.

## Interface Contract

| Interface | Contract | Consumers |
|-----------|----------|-----------|
| `storyBible.query` | `{ entityType, filters } → Entity[]` | Co-Writing Engine, Reader Simulation |
| `storyBible.extract` | `{ manuscriptRange } → ExtractionResult` | Auto-extraction pipeline |
| `storyBible.upsert` | `{ entity } → Entity` | Inline editing (UX-04) |
| `storyBible.validate` | `{ entityId } → CompletenessScore` | Quality Control (F-007) |

All endpoints MUST follow the existing MCP registration pattern. The `storyBible.query` endpoint is the primary consumer interface — Co-Writing Engine reads from it before every generation call (see SA-02).

## Constraints (RFC 2119)

- Story Bible construction MUST use hybrid mode: auto-extract first, user supplements second (PM-03).
- Auto-extraction MUST use existing Craft Analysis Services output as input (SME-04).
- Story Bible entries MUST be editable inline from the writing workspace (UX-04).
- The system MUST validate Story Bible completeness before Co-Writing generation; incomplete Bibles MUST warn the user with a quality score.
- Entity schemas MUST extend the existing KnowledgeEngine type system, not create a parallel data model (SA-02).
- Users SHOULD NOT be allowed to skip Story Bible setup entirely — Sudowrite data shows quality degrades significantly without structured story knowledge.

## Test Approach

- Unit: Entity schema validation, auto-extraction accuracy against annotated manuscripts.
- Integration: MCP endpoint round-trip (query → extract → upsert → validate).
- E2E: Full workflow — import manuscript, auto-extract, user edits, Co-Writing reads from Bible.
- Quality gate: Completeness score threshold MUST be configurable per project.

## TODOs

- Define minimum viable entity schema fields per type (CharacterProfile, WorldRule, PlotThread, TimelineEvent).
- Determine completeness score calculation weights.
- Study existing KE entity types for extension compatibility.
- Decide on Story Bible versioning strategy when manuscript changes invalidate extracted data.
