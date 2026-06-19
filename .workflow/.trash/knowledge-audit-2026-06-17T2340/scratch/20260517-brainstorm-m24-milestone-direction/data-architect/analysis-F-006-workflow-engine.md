# F-006: Workflow Engine Decomposition

## Data Model Design

### State Machine Data Model

The workflow engine (1970 lines) mixes state management, orchestration, and I/O. The data model MUST separate these concerns:

**WorkflowStateMachine** — Pure state + transitions:
```typescript
interface WorkflowStateMachine {
  $schema_version: string;
  machine_id: string;
  current_state: WorkflowMachineState;
  history: StateTransition[];
  context: WorkflowContext;
}

type WorkflowMachineState = 
  | 'idle'
  | 'routing'
  | 'planning'
  | 'plan_review'
  | 'executing'
  | 'step_complete'
  | 'paused'
  | 'waiting_confirmation'
  | 'completed'
  | 'failed'
  | 'stopped';

interface StateTransition {
  from: WorkflowMachineState;
  to: WorkflowMachineState;
  event: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface WorkflowContext {
  session_id: string;
  level: number;                // WorkflowLevelValue
  plan_id?: string;
  current_step_id?: string;
  runner_status: 'pending' | 'running' | 'paused' | 'stopped';
  budget: BudgetState;
  observability: ObservabilityState;
}
```

**Transition Table** — Allowed state transitions (formalizing existing `RUNNER_ALLOWED_TRANSITIONS`):

```
idle → routing (on: task_received)
routing → planning (on: level_determined)
routing → executing (on: level_L1, skip planning)
planning → plan_review (on: plan_created)
plan_review → executing (on: plan_approved)
plan_review → planning (on: plan_rejected)
executing → step_complete (on: step_done)
step_complete → executing (on: next_step)
step_complete → completed (on: all_steps_done)
executing → waiting_confirmation (on: destructive_step)
waiting_confirmation → executing (on: confirmed)
waiting_confirmation → stopped (on: rejected)
executing → paused (on: pause_requested)
paused → executing (on: resume_requested)
paused → stopped (on: stop_requested)
* → failed (on: unrecoverable_error)
* → stopped (on: force_stop)
```

### Event Sourcing Considerations

The system SHOULD adopt event sourcing for workflow state:

**WorkflowEvent** — Immutable event record:
```typescript
interface WorkflowEvent {
  event_id: string;
  machine_id: string;
  event_type: string;           // e.g. "task_received", "level_determined"
  timestamp: string;
  payload: Record<string, unknown>;
  causation_id?: string;        // event that caused this event
}
```

Benefits for this use case:
- Full audit trail (already partially implemented via `audit.jsonl`)
- State reconstruction from events (enables replay/debug)
- Natural fit for the existing `RUNNER_ALLOWED_TRANSITIONS` pattern

However, full event sourcing adds complexity. Recommendation: **event log for audit + snapshot for current state** (hybrid approach). The system MUST persist current state as a snapshot and SHOULD append events to an audit log. State reconstruction from events is a MAY (useful for debugging, not required for normal operation).

### Decomposed Data Boundaries

| Module | Data Owned | Persistence |
|--------|-----------|-------------|
| `engine/state-machine.ts` | StateMachine, transitions | In-memory + snapshot |
| `engine/orchestrator.ts` | Step execution order, dependencies | Derived from plan |
| `engine/risk.ts` | Gate decisions, risk scores | Per-step, ephemeral |
| `engine/observability.ts` | Metrics, budget tracking | In-memory + periodic flush |
| `engine/persistence.ts` | Snapshots, checkpoints | File system |
| `session/session-manager.ts` | Session metadata, content paths | File system |

## Storage Strategy

- **State snapshot**: `{session}/.data/state.json` (existing path, enriched schema)
- **Event log**: `{session}/.data/audit.jsonl` (existing path, formalized schema)
- **Plan data**: `{session}/.data/plans/{plan_id}.json`
- **Step results**: `{session}/.data/steps/{step_id}.json`

The event log uses JSONL (one JSON object per line) for append-only efficiency. Each line is a `WorkflowEvent`.

## Migration Path

Current state: `workflow-engine.ts` is a 1970-line monolith importing from 10+ engine sub-modules. State transitions are implicit in method calls.

Migration:
1. **Extract state machine**: Define `WorkflowStateMachine` interface, extract transition logic from `applyWorkflowRunnerTransition`, `applyWorkflowStepTransition`, `applyWorkflowTriageTransition`
2. **Formalize transitions**: Convert `RUNNER_ALLOWED_TRANSITIONS` Record into a proper transition table with event triggers
3. **Event wrapper**: Wrap existing audit writes (`buildWorkflowStatePersistedAuditEvent`) into `WorkflowEvent` format
4. **Snapshot enrichment**: Add `$schema_version` and `history` to persisted state
5. **Orchestrator extraction**: Move step execution logic out of engine into dedicated orchestrator

### Phasing

- Phase 1: Define interfaces, add `$schema_version` to state files (non-breaking)
- Phase 2: Extract state machine logic into `engine/state-machine.ts` (refactor)
- Phase 3: Formalize event log schema (enrich existing audit.jsonl)
- Phase 4: Thin down `workflow-engine.ts` to facade over sub-modules

## Backward Compatibility

- All existing exports from `workflow-engine.ts` MUST remain available
- `TEMPLATE_METADATA_MAP`, `RUNNER_ALLOWED_TRANSITIONS`, `RUNNER_TO_SESSION_STATUS` remain exported
- The `WorkflowLevel` const object and `WorkflowDecision` enum are unchanged
- `LEGACY_CONTRACT_FIELD_MAP` and `LEGACY_DECISION_MAP` continue to function
- Existing session files are readable (new fields are optional)
- The `ensureContractPayload` function continues to normalize legacy formats
