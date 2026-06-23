# Debug: interface-gaps

## Status
resolved

## Issue
Security + architecture gaps in frontend-backend interface layer identified during quality-review + security regression verification

## Symptoms
- SEC-001: writing-craft.ts sends api_key/base_url in POST body (not headers)
- SEC-002: graphAddEntity() passes entityType without validateEntityType()
- SEC-003: /graph/query endpoint accepts raw Cypher without guard
- ARCH-004: foreshadow/character frontend APIs don't pass workspace context
- ARCH-005: story-bible _workspace parameter declared but never wired

## Hypotheses

### H1: writing-craft.ts was not updated when header pattern was introduced [CONFIRMED]
Evidence:
- writing.ts processWritingHelper (line 59-80) extracts api_key/base_url to X-LLM-API-Key/X-LLM-Base-Url headers
- writing-craft.ts analyzeWritingCraftLLM (line 220-230) still spreads `...llmConfig` into POST body
- callApi() supports extraHeaders (4th param) at core.ts:109-114
- Backend writing-craft-llm.ts:50-54 reads headers with body fallback — so backend is ready, frontend is not
Root cause: writing-craft.ts was missed during the ISS-002 fix pass

### H2: graphAddEntity service layer was not included in validateEntityType rollout [CONFIRMED]
Evidence:
- validateEntityType() added to cypher-safety.ts (line 26-32) with 6 allowed types
- PersistedEntityTab.tsx:113 calls validateEntityType before queryGraph
- graphAddEntity() at services/graph.ts:119-127 passes entityType directly to engine.createEntity()
- foreshadowPlantEndpoint at endpoints/graph.ts:117 hardcodes 'foreshadow' (safe) but service layer is defenseless
Root cause: validateEntityType was only applied at the frontend/component level, not at the service layer (defense-in-depth gap)

### H3: /graph/query was designed as raw pass-through without safety consideration [CONFIRMED]
Evidence:
- graphQueryEndpoint at endpoints/graph.ts:68-73 forwards body.cypher directly
- graphQuery() at services/graph.ts:74-81 passes cypher directly to engine.executeCypher()
- Frontend PersistedEntityTab constructs safe Cypher via knowledgeUtils.ts builders
- No DETACH DELETE / DROP / CREATE pattern blocking anywhere in the chain
Root cause: endpoint designed for flexibility, no guardrails added for safety. Defense-in-depth principle not applied at boundary layer.

### H4: foreshadow/character APIs missing workspace context — incomplete migration [CONFIRMED]
Evidence:
- plantForeshadow() at knowledge.ts:161-177 sends no workspace field
- getForeshadowStats() at knowledge.ts:179-181 sends no workspace field
- analyzeCharacterDepth(), getCharacterProfile(), getCharacterRelationships() — same pattern
- Backend graph endpoints support resolveGraphScope() (endpoints/graph.ts:39-66)
- queryGraph() and getCharacter() in knowledge.ts DO pass workspace via appendWorkspacePayload
Root cause: These 5 API functions were added after the workspace context pattern was established, but the pattern wasn't applied to them

### H5: story-bible _workspace unused — same incomplete migration [CONFIRMED]
Evidence:
- sbGetEntities() at story-bible.ts:136-144 declares _workspace but never uses it
- sbGetEntity(), sbCreateEntity(), sbUpdateEntity(), sbDeleteEntity(), sbExtractFromManuscript() — same
- All 6 functions call callApi without appendWorkspacePayload
- Backend story-bible-endpoints.ts supports workspace scoping (has validateEntityType)
Root cause: _workspace parameter was stubbed for future use but never wired. Same migration gap as H4.

## Root Cause Summary

All gaps share a common pattern: **safety/context features were applied to some call sites but not all**. The root cause is incomplete rollout rather than design omission — the infrastructure (validateEntityType, header transmission, workspace context) exists, it just wasn't applied uniformly.

## Fix Directions

| ID | Fix | Affected Files |
|----|-----|----------------|
| SEC-001 | Extract api_key/base_url from llmConfig → X-LLM-API-Key/X-LLM-Base-Url headers via callApi extraHeaders param | desktop/src/api/writing-craft.ts |
| SEC-002 | Add validateEntityType(entityType) at start of graphAddEntity() | src-ts/mcp/services/graph.ts |
| SEC-003 | Add Cypher safety check in graphQueryEndpoint: block destructive patterns (DETACH DELETE, DROP, CREATE constraint) or restrict to READ-only | src-ts/mcp/endpoints/graph.ts |
| ARCH-004 | Add workspace param + appendWorkspacePayload to plantForeshadow, getForeshadowStats, analyzeCharacterDepth, getCharacterProfile, getCharacterRelationships | desktop/src/api/knowledge.ts |
| ARCH-005 | Wire _workspace via appendWorkspacePayload in all sb* functions | desktop/src/api/story-bible.ts |

## Related
- [[spec:project:coding-conventions-025]]
- [[spec:project:review-standards-001]]
