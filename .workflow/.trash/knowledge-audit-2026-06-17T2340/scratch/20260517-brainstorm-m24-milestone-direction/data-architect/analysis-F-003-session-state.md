# F-003: Session State Persistence

## Data Model Design

### Core Entities

**SessionState** — Complete session snapshot (extends existing `BaseState`):
```typescript
interface SessionState extends BaseState {
  $schema_version: string;
  session_id: string;
  status: 'active' | 'archived';
  domain: 'novel' | 'code' | 'knowledge' | 'custom';
  
  // Workflow binding
  workflow_level?: number;
  plan_id?: string;
  checkpoint_id?: string;
  
  // Content references (not inline content)
  content_refs: ContentReference[];
  
  // Resume metadata
  resume_metadata?: ResumeMetadata;
}

interface ContentReference {
  type: ContentType;            // from existing ContentType enum
  path: string;                 // relative to session base
  hash?: string;                // content hash for change detection
  last_modified: string;
}

interface ResumeMetadata {
  last_active_step: string;
  pending_actions: string[];
  context_snapshot: Record<string, unknown>;
  resume_strategy: 'continue' | 'replay' | 'restart';
}
```

**SessionCheckpoint** — Point-in-time recovery marker:
```typescript
interface SessionCheckpoint {
  $schema_version: string;
  checkpoint_id: string;
  session_id: string;
  created_at: string;
  trigger: 'manual' | 'auto' | 'pre_destructive';
  state_snapshot: Partial<SessionState>;
  git_ref?: string;             // git commit hash if git-based
  content_hashes: Record<string, string>;  // path → hash
}
```

### Relationships

- Session 1:N Checkpoint (ordered by created_at)
- Session 1:N ContentReference (current content set)
- Session 1:1 WorkflowPlan (via plan_id, optional)

## Storage Strategy

Session data uses the existing `SessionManager` path routing pattern:
```
{base}/.data/state.json                    → SessionState
{base}/.data/checkpoints/{id}.json         → SessionCheckpoint
{base}/.data/snapshot-index.json           → checkpoint index
{base}/.data/audit.jsonl                   → append-only event log
```

This aligns with the existing `PATH_ROUTES` in `session-manager.ts`. No structural change to file layout.

Access patterns:
- **Read state**: On session resume (cold start)
- **Write state**: After each workflow step completion
- **Read checkpoint**: On explicit restore action
- **Write checkpoint**: Before destructive operations, periodic auto-save

State writes MUST use atomic write (temp file + rename) to prevent corruption.

## Migration Path

Current state: `SessionManager` already implements path-based storage with `ContentType` routing. The `BaseState` interface in `workflow/state.ts` defines the core fields.

Migration:
1. Add `$schema_version` to existing state files (additive field)
2. Introduce `ResumeMetadata` as optional field on `BaseState`
3. Formalize `SessionCheckpoint` schema (currently ad-hoc in `revision-checkpoints/`)
4. Add content hash tracking to `ContentReference`

This is primarily a schema formalization — the storage layout already exists.

## Data Flow Changes

Current: `WorkflowEngine → SessionManager.write() → file`
Target: `WorkflowEngine → StateManager.transition() → validate → SessionManager.write() → file`

A new `StateManager` layer SHOULD sit between workflow engine and session I/O, responsible for:
- Validating state transitions
- Computing content hashes
- Triggering auto-checkpoints
- Maintaining resume metadata

## Backward Compatibility

- Existing `BaseState` fields remain unchanged (all optional)
- New fields (`$schema_version`, `resume_metadata`, `content_refs`) are optional
- Existing session files without `$schema_version` are treated as v0 and read without migration
- The `PATH_ROUTES` mapping is unchanged — no file relocation needed
- `LEGACY_CONTRACT_FIELD_MAP` pattern applies: old field names continue to work
