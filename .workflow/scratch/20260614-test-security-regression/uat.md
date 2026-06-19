---
status: complete
target: security-regression-ISS-001-ISS-002
source:
  - .workflow/scratch/20260614-review-frontend-backend-interface/review.json
started: "2026-06-14T15:00:00Z"
updated: "2026-06-14T15:30:00Z"
---

## Current Test

number: 6
name: SEC-003 raw Cypher endpoint guard
expected: |
  graphQueryEndpoint should validate or sanitize incoming Cypher before execution
awaiting: completed

## Tests

### 1. ISS-001 Cypher injection — validateEntityType allowlist
expected: validateEntityType() in cypher-safety.ts blocks disallowed entity types
result: pass
evidence: src-ts/utils/cypher-safety.ts:26-32 — ALLOWED_ENTITY_TYPES Set with 6 types, throws on mismatch

### 2. ISS-001 Cypher injection — escapeCypherString escaping
expected: escapeCypherString() doubles single-quotes and escapes backslashes
result: pass
evidence: src-ts/utils/cypher-safety.ts:38-40 — .replace(/\\/g, '\\\\').replace(/'/g, "\\'")

### 3. ISS-001 Cypher injection — PersistedEntityTab uses validateEntityType
expected: Frontend calls validateEntityType before graph queries
result: pass
evidence: desktop/src/components/knowledge/PersistedEntityTab.tsx:113 — validateEntityType(entityType) called before queryGraph

### 4. ISS-001 Cypher injection — PersistedEntityTab uses escapeCypherString
expected: Frontend escapes user input in rename queries
result: pass
evidence: desktop/src/components/knowledge/PersistedEntityTab.tsx:190 — escapeCypherString(matchName), escapeCypherString(wid)

### 5. ISS-001 Cypher injection — SEC-002 gap: graphAddEntity no validation
expected: graphAddEntity should call validateEntityType before createEntity
result: issue
reported: "graphAddEntity in src-ts/mcp/services/graph.ts:119-127 passes entityType directly to engine.createEntity() without calling validateEntityType()"
severity: major

### 6. ISS-001 Cypher injection — SEC-003 gap: raw Cypher endpoint no guard
expected: graphQueryEndpoint should validate/sanitize incoming Cypher before execution
result: issue
reported: "graphQueryEndpoint in src-ts/mcp/endpoints/graph.ts:68-73 passes raw client-supplied Cypher to graphQuery() with no validation or sanitization guard"
severity: major

### 7. ISS-002 API key — processWritingHelper uses X-LLM-API-Key header
expected: Frontend extracts api_key from payload and sends via X-LLM-API-Key header
result: pass
evidence: desktop/src/api/writing.ts:62-78 — extracts apiKey, sets headers['X-LLM-API-Key'], removes from body

### 8. ISS-002 API key — streamWritingHelper uses headers
expected: Streaming endpoint also sends API key via headers
result: pass
evidence: desktop/src/api/writing.ts:265-320 — same header pattern for stream

### 9. ISS-002 API key — gateway/models uses X-Goog-Api-Key header
expected: Google API key sent via header not URL param
result: pass
evidence: desktop/src/api/gateway/models.ts:120-123 — headers: { 'X-Goog-Api-Key': trimmedApiKey }

### 10. ISS-002 API key — backend writing.ts reads X-LLM-API-Key with priority
expected: Backend prefers header over body for API key
result: pass
evidence: src-ts/mcp/endpoints/writing.ts:72-76 — headers?.['X-LLM-API-Key']?.trim() ?? (body.api_key as string)

### 11. ISS-002 API key — backend writing-craft-llm.ts reads X-LLM-API-Key with priority
expected: Backend craft endpoint prefers header over body for API key
result: pass
evidence: src-ts/mcp/endpoints/writing-craft-llm.ts:50-54 — headers?.['x-llm-api-key']?.trim() ?? headers?.['X-LLM-API-Key']?.trim() ?? (body.api_key as string)

### 12. ISS-002 API key — SEC-001 gap: writing-craft.ts spreads into body
expected: Frontend writing-craft.ts should extract api_key/base_url to headers like writing.ts
result: issue
reported: "analyzeWritingCraftLLM in desktop/src/api/writing-craft.ts:220-230 spreads ...llmConfig (api_key, base_url) into POST body. Backend reads headers as priority but frontend never sends via headers, so key always arrives in body."
severity: major

## Summary

total: 12
passed: 9
issues: 3
pending: 0
skipped: 0

## Gaps

- test: 5
  truth: "graphAddEntity should call validateEntityType before createEntity"
  status: failed
  reason: "graphAddEntity in src-ts/mcp/services/graph.ts:119-127 passes entityType directly to engine.createEntity() without calling validateEntityType()"
  severity: major
  root_cause: "graphAddEntity service function was not updated when validateEntityType was introduced for the frontend"
  fix_direction: "Add validateEntityType(entityType) call at the start of graphAddEntity before engine.createEntity()"
  affected_files: ["src-ts/mcp/services/graph.ts"]

- test: 6
  truth: "graphQueryEndpoint should validate/sanitize incoming Cypher before execution"
  status: failed
  reason: "graphQueryEndpoint passes raw client-supplied Cypher to graphQuery() with no guard"
  severity: major
  root_cause: "The /graph/query endpoint is a raw Cypher pass-through — intended for power users but lacking any safety rail"
  fix_direction: "Add a Cypher safety check: either restrict to READ-only queries (no CREATE/MERGE/DELETE/SET/REMOVE) or require allowlisted query patterns"
  affected_files: ["src-ts/mcp/endpoints/graph.ts"]

- test: 12
  truth: "Frontend writing-craft.ts should extract api_key/base_url to headers"
  status: failed
  reason: "analyzeWritingCraftLLM spreads ...llmConfig into POST body instead of extracting to headers"
  severity: major
  root_cause: "writing-craft.ts was not updated when the header-based API key transmission pattern was introduced in writing.ts"
  fix_direction: "Refactor analyzeWritingCraftLLM to extract api_key/base_url from llmConfig and send via X-LLM-API-Key/X-LLM-Base-Url headers, matching the pattern in writing.ts processWritingHelper"
  affected_files: ["desktop/src/api/writing-craft.ts"]
