# F-001 — Story Bible Engine

> Role: system-architect | Related decisions: SA-01, SA-02, SA-07

## Architecture

The Story Bible Engine extends the existing KnowledgeEngine (KE) with four new entity types and a semantic layer. It operates as a KE submodule registered through the existing MCP endpoint infrastructure (SA-01).

**Component layout:**

`
KnowledgeEngine (existing)
  +-- StoryBibleModule (new)
       +-- EntityStore (CharacterProfile, WorldRule, PlotThread, TimelineEvent)
       +-- AutoExtractor (calls Craft Analysis Services)
       +-- SemanticLayer (relationship inference, consistency checks)
       +-- MCP Adapter (registers /mcp/story-bible/* endpoints)
`

The AutoExtractor consumes Craft Analysis Services output to populate entities from manuscript text (SME-04, PM-03). It runs as a background pipeline triggered on manuscript save or explicit user request. The SemanticLayer provides relationship inference between entities (e.g., detecting that a character references a world rule) and consistency validation (e.g., flagging contradictory character traits).

The extension MUST NOT introduce a separate persistence layer; entities are stored in the existing KE storage with a `story_bible` namespace prefix. The MCP Adapter follows the existing registration pattern so that other modules (Co-Writing Engine, Reader Simulation) discover SB endpoints through the same service registry.

## Interface Contract

**MCP Story Bible API:**

- `GET /mcp/story-bible/{entity_type}` — list all entities of given type
- `GET /mcp/story-bible/{entity_type}/{id}` — get single entity with relationships
- `POST /mcp/story-bible/{entity_type}` — create or update entity
- `DELETE /mcp/story-bible/{entity_type}/{id}` — remove entity (soft delete)
- `POST /mcp/story-bible/extract` — trigger auto-extraction from manuscript segment
- `GET /mcp/story-bible/consistency` — run consistency check across all entities
- `GET /mcp/story-bible/export` — export full SB as structured document

**Entity schemas** are defined in the Data Model section of the index document. Each entity type MUST have a JSON Schema registered with the MCP endpoint for request/response validation.

**Auto-Extract contract:** Input is a manuscript segment (chapter text) plus target entity types. Output is an array of proposed entities with confidence scores, awaiting user confirmation before merging into the EntityStore.

## Constraints (RFC 2119)

- The Story Bible MUST extend the existing KnowledgeEngine; a parallel knowledge store MUST NOT be created (SA-02)
- All SB operations MUST be exposed through MCP endpoints (SA-01)
- Auto-extracted entities below the confidence threshold (default 0.6) MUST be flagged for user review
- Entity mutations MUST be atomic — a character update with relationship changes MUST succeed or fail as a unit
- The SB MUST snapshot its state before each co-writing session for disaster recovery
- The SemanticLayer consistency check MUST run before the Co-Writing Engine enters the generating state (see state machine in index)
- Story Bible API responses MUST include `confidence_score` and `source_chapters` metadata for every entity

## Test Approach

- **Unit**: Entity schema validation, confidence threshold filtering, atomic mutation rollback, auto-extract entity parsing from sample text
- **Integration**: MCP endpoint registration and discovery, auto-extract pipeline from CAS output to EntityStore, consistency check across entity types
- **Fuzz**: Malformed manuscript input to AutoExtractor, oversized entity payloads, concurrent mutation requests
- **E2E**: Full flow — manuscript save triggers auto-extract -> user confirms entities -> SB populated -> co-writing reads SB entities

## TODOs

- Map existing KE schema to determine namespace prefix strategy for SB entities
- Define CAS output-to-EntityStore mapping rules for AutoExtractor
- Specify consistency check rules (what constitutes a contradiction between entities)
- Design user confirmation UX for auto-extracted entities (deferred to UX role)
- Benchmark auto-extract latency on typical chapter sizes
