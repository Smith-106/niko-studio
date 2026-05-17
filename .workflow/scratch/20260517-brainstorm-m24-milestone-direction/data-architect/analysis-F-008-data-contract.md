# F-008: Frontend-Backend Data Contract

## Data Model Design

### Contract Registry

All frontend-backend communication MUST be governed by typed contracts. A contract defines the request shape, response shape, and versioning:

```typescript
interface DataContract<TReq, TRes> {
  $contract_id: string;         // e.g. "workflow.route"
  $contract_version: string;    // semver: "1.0.0"
  request: TReq;
  response: TRes;
}
```

### Core Contracts (derived from existing codebase)

**Workflow Contracts** (from `engine-contracts.ts`):
```typescript
// Already well-defined:
// - WorkflowRouteRequest → WorkflowRouteResult
// - WorkflowPlanRequest → WorkflowPlanResult
// - WorkflowExecuteRequest → WorkflowExecuteResult
// - WorkflowRunRequest → WorkflowRunResult
// - WorkflowStreamRequest → WorkflowStreamEvent (SSE)
```

**Analysis Contracts** (to be formalized):
```typescript
interface AnalyzeRequest {
  chapter_id: string;
  content: string;
  dimensions?: string[];        // which analyzers to run
  options?: {
    depth?: 'quick' | 'standard' | 'deep';
    include_evidence?: boolean;
  };
}

interface AnalyzeResponse {
  $schema_version: string;
  request_id: string;
  results: AnalysisResult[];    // from F-001 schema
  summary: {
    overall_score: number;
    dimension_scores: Record<string, number>;
    top_findings: Finding[];
  };
}
```

**Session Contracts**:
```typescript
interface SessionCreateRequest {
  domain: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

interface SessionCreateResponse {
  session_id: string;
  status: string;
  created_at: string;
}
```

### Contract Versioning

Contracts MUST follow semver:
- **Patch** (1.0.x): Bug fixes, documentation changes
- **Minor** (1.x.0): New optional fields in response, new optional parameters in request
- **Major** (x.0.0): Breaking changes (field removal, type changes, required field additions)

The backend MUST support the current major version and one previous major version simultaneously. Version negotiation happens via request header or query parameter.

### Error Contract

All endpoints MUST use a unified error shape:
```typescript
interface ContractError {
  error: {
    code: string;               // machine-readable: "WORKFLOW_PLAN_FAILED"
    message: string;            // human-readable
    details?: Record<string, unknown>;
    retry_after?: number;       // seconds, for rate limiting
  };
  $contract_version: string;
}
```

## Storage Strategy

Contract definitions are code artifacts (TypeScript interfaces), not runtime data. They live in:
```
src-ts/contracts/
  workflow.ts                   → workflow-related contracts
  analysis.ts                  → analysis contracts
  session.ts                   → session contracts
  common.ts                    → shared types (ContractError, pagination, etc.)
  index.ts                     → barrel export
```

The desktop frontend imports these types directly (shared package or generated client).

### JSON Schema Generation

From TypeScript contract interfaces, a build step SHOULD generate JSON Schema files for:
- Runtime request validation (backend)
- API documentation generation
- Client SDK generation (if needed in future)

## Migration Path

Current state: Contracts are partially defined in `engine-contracts.ts` for workflow. Other modules (analysis, session, knowledge) lack formal contracts — the frontend calls backend functions directly via IPC.

Migration:
1. **Inventory**: Map all existing IPC/API calls between desktop and src-ts
2. **Extract**: For each call, define request/response TypeScript interfaces
3. **Consolidate**: Move to `src-ts/contracts/` directory
4. **Validate**: Add runtime validation (Zod or JSON Schema) at API boundaries
5. **Version**: Add `$contract_version` to all responses

### Existing Patterns to Preserve

The `engine-contracts.ts` file already demonstrates good contract design:
- Clear request/response pairs
- Normalizer functions (`normalizeWorkflowRouteRequest`, etc.)
- Response builders (`buildWorkflowRouteResponse`, etc.)

This pattern SHOULD be adopted by other modules.

## Data Flow Changes

Current: `Frontend component → IPC call → backend function → raw return`
Target: `Frontend component → typed client → validate request → IPC → validate response → typed result`

A thin contract validation layer sits at both ends:
- Backend: validates incoming requests, wraps responses in contract envelope
- Frontend: validates responses, provides typed access

## Backward Compatibility

- Existing IPC calls continue to work (validation layer is additive)
- New `$contract_version` field in responses is ignored by old clients (additionalProperties)
- Backend normalizer functions (already existing for workflow) handle legacy request formats
- The `LEGACY_CONTRACT_FIELD_MAP` pattern generalizes to all contracts
- Frontend can adopt typed clients incrementally (per-module migration)
- No wire format change — still JSON over IPC. Only adding type safety and validation.
