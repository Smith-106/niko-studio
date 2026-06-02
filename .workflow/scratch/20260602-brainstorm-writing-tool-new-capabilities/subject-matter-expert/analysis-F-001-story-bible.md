# F-001 — Story Bible Engine

> Role: subject-matter-expert | Related decisions: SME-04, SA-02, PM-03

## Architecture

Story Bible extends the existing KnowledgeEngine with four typed entity schemas: CharacterProfile, WorldRule, PlotThread, TimelineEvent. The auto-extraction pipeline reuses Craft Analysis Services (CAS) as the primary entity recognizer, mapping CAS detector outputs to Story Bible entity types. A semantic layer sits above the typed entities, providing relationship traversal and cross-reference queries.

The extraction pipeline follows: Manuscript Text → CAS Detectors → Entity Mapper → Story Bible Store → Semantic Indexer. User edits flow through: Inline Edit → Validation → Store Update → Semantic Re-index.

## Interface Contract

- `extractEntities(manuscriptId: string): ExtractionResult` — triggers CAS-based auto-extraction, returns discovered entities with confidence scores
- `getEntity(id: string): StoryBibleEntity` — retrieves a single typed entity
- `queryRelationships(entityId: string, depth: number): RelationshipGraph` — semantic layer traversal
- `validateCompleteness(bibleId: string): CompletenessReport` — checks required fields and cross-reference integrity

Consumers: Co-Writing Engine (reads Story Bible for context), Reader Simulation (reads character/world data), Quality Control (cross-references against bible entries).

## Constraints (RFC 2119)

- Auto-extraction MUST use existing CAS detectors as the primary entity recognition mechanism (see SME-04)
- Story Bible entries MUST include confidence scores from auto-extraction; entries below a configurable threshold MUST be flagged for user review
- Required fields per entity type MUST be validated before marking an entry as "complete" — incomplete entries MUST NOT be used as hard constraints by Quality Control
- The semantic layer MUST support relationship queries across entity types (e.g., "which scenes reference this character")
- User edits to auto-extracted entries MUST preserve provenance metadata (original source text, extraction timestamp)
- Story Bible MUST be the single source of truth for all AI generation features (see SA-02); no parallel knowledge stores are permitted

## Test Approach

- Unit: Entity mapper transforms CAS detector output to typed schemas; validation catches missing required fields
- Integration: End-to-end extraction from sample manuscript; semantic relationship queries return correct cross-references
- Regression: Auto-extraction accuracy benchmarked against hand-annotated gold standard manuscripts
- Edge cases: Empty manuscript, manuscript with only dialogue (no narration), conflicting entity references across chapters

## TODOs

- Define minimum required fields per entity type (CharacterProfile, WorldRule, PlotThread, TimelineEvent)
- Determine confidence score thresholds for auto-extraction flagging
- Study CAS detector output schemas to design the Entity Mapper mapping table
- Define provenance metadata schema for user-edited entries
- Investigate how CreAgentive's Story Prototype abstraction could enhance cross-entity coherence (see design-research)
