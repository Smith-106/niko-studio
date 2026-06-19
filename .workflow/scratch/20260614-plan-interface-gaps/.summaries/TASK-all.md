# Execution Summary — Interface Gaps Fix

## Wave 1: P0 Security Fixes (all completed)

### TASK-001: SEC-001 — writing-craft.ts API key header transmission
- **Status**: DONE
- **Changes**: 
  - `desktop/src/api/writing-craft.ts`: Extracted api_key/base_url from llmConfig → X-LLM-API-Key/X-LLM-Base-Url headers via callApi extraHeaders
  - Added extraHeaders parameter to unwrapWritingCraftResponse
- **Verification**: TypeScript compiles, 24 writing-craft tests pass

### TASK-002: SEC-002 — graphAddEntity validateEntityType
- **Status**: DONE
- **Changes**:
  - `src-ts/mcp/services/graph.ts`: Added `import { validateEntityType } from '../../utils/cypher-safety.js'`
  - Added `validateEntityType(entityType)` call at start of graphAddEntity
- **Verification**: TypeScript compiles, 5 graph-service tests pass

### TASK-003: SEC-003 — graphQueryEndpoint Cypher safety guard
- **Status**: DONE
- **Changes**:
  - `src-ts/mcp/endpoints/graph.ts`: Added BLOCKED_CYPHER_PATTERNS regex array and isCypherSafe() function
  - graphQueryEndpoint now validates Cypher before execution, returns 403 for destructive patterns
  - Also fixed foreshadowPlantEndpoint to use 'Foreshadow' (matching validateEntityType allowlist casing)
- **Verification**: TypeScript compiles, 4 graph-endpoints tests pass

## Wave 2: P1 Architecture Consistency (all completed)

### TASK-004: ARCH-004 — foreshadow/character workspace context
- **Status**: DONE
- **Changes**:
  - `desktop/src/api/knowledge.ts`: Added workspace?: ProjectWorkspaceContext to plantForeshadow, getForeshadowStats, analyzeCharacterDepth, getCharacterProfile, getCharacterRelationships
  - Wired via appendWorkspacePayload
- **Verification**: TypeScript compiles clean

### TASK-005: ARCH-005 — story-bible workspace wiring
- **Status**: DONE
- **Changes**:
  - `desktop/src/api/story-bible.ts`: Added `import { appendWorkspacePayload } from './workspace'`
  - sbGetEntities, sbCreateEntity, sbUpdateEntity, sbExtractFromManuscript — workspace wired via appendWorkspacePayload
  - sbGetEntity, sbDeleteEntity — kept _workspace (GET/DELETE can't pass workspace in body)
- **Verification**: TypeScript compiles clean

### TASK-006: CORR-002 — foreshadowPlantEndpoint workspace scope
- **Status**: DONE
- **Changes**:
  - `src-ts/mcp/endpoints/graph.ts`: foreshadowPlantEndpoint now calls resolveGraphScope(body) and includes workspaceId/projectId in entity properties
  - Changed entityType from 'foreshadow' to 'Foreshadow' to match validateEntityType allowlist
- **Verification**: TypeScript compiles, 4 graph-endpoints tests pass
