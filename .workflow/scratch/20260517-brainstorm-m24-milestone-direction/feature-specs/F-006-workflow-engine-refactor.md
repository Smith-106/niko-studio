# F-006: Workflow Engine Refactor

## 1. Requirements Summary

The monolithic `workflow-engine.ts` (1970 lines) MUST be decomposed into layered modules separating orchestration logic from business rules. All public API methods (route, plan, execute, run, stream) MUST retain identical signatures. The refactor MUST NOT introduce new external dependencies and MUST pass all existing workflow integration tests.

## 2. Design Decisions [CORE]

### Architecture: Three-Layer Decomposition + Strategy Pattern

**Target structure**:
```
src-ts/workflow/
├── workflow-engine.ts        (facade, ~300 lines — delegates to layers)
├── engine/
│   ├── orchestrator.ts       (task scheduling, dependency resolution)
│   ├── state-machine.ts      (workflow state transitions)
│   ├── checkpoint.ts         (state persistence, resume)
│   └── types.ts              (internal engine types)
├── strategies/
│   ├── routing-strategy.ts   (level selection logic)
│   ├── planning-strategy.ts  (task decomposition logic)
│   └── execution-strategy.ts (step execution logic)
├── adapters/                 (existing, unchanged)
├── levels/                   (existing, unchanged)
├── modes/                    (existing, unchanged)
├── session/                  (existing, unchanged)
└── types.ts                  (public types, unchanged)
```

**Three layers**:
1. **Facade** (`workflow-engine.ts`): Public API surface. Delegates to orchestrator. Maintains backward compatibility.
2. **Engine** (`engine/`): Pure orchestration — scheduling, state transitions, checkpointing. No business logic.
3. **Strategies** (`strategies/`): Business rules extracted as strategy pattern implementations. Swappable, testable in isolation.

**Why strategy pattern over event sourcing** (conflict resolution):
- Strategy pattern achieves the primary goal (separation of concerns) with minimal risk
- Event sourcing is a larger architectural change better suited for M25
- Product-manager's interface freeze constraint is easier to satisfy with strategy extraction
- The data-architect's hybrid event sourcing recommendation is noted for Phase 2 (M25)

### State Machine Formalization

Extract implicit state transitions into an explicit state machine:

```typescript
enum WorkflowState {
  IDLE = 'idle',
  ROUTING = 'routing',
  PLANNING = 'planning',
  EXECUTING = 'executing',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

interface StateTransition {
  from: WorkflowState;
  to: WorkflowState;
  trigger: string;
  guard?: () => boolean;
}
```

**Valid transitions** (from system-architect analysis):
```
IDLE → ROUTING (on: start)
ROUTING → PLANNING (on: level_selected)
PLANNING → EXECUTING (on: plan_ready)
EXECUTING → PAUSED (on: pause | budget_exceeded)
EXECUTING → COMPLETED (on: all_tasks_done)
EXECUTING → FAILED (on: unrecoverable_error)
PAUSED → EXECUTING (on: resume)
FAILED → IDLE (on: reset)
```

### Migration Strategy: Strangler Fig Pattern

1. **Phase A**: Extract strategies (routing, planning, execution) into separate files. `workflow-engine.ts` calls them.
2. **Phase B**: Extract orchestrator (scheduling, dependency resolution). Engine becomes thin facade.
3. **Phase C**: Extract state machine. All state transitions go through formal machine.
4. **Phase D**: Reduce `workflow-engine.ts` to pure delegation (~300 lines).

Each phase MUST pass all integration tests before proceeding to next.

### Interface Freeze Contract

```typescript
// These signatures MUST NOT change
class WorkflowEngine {
  route(input: WorkflowInput): Promise<WorkflowLevel>;
  plan(level: WorkflowLevel, input: WorkflowInput): Promise<WorkflowPlan>;
  execute(plan: WorkflowPlan): Promise<WorkflowResult>;
  run(input: WorkflowInput): Promise<WorkflowResult>;
  stream(input: WorkflowInput): AsyncGenerator<WorkflowEvent>;
}
```

## 3. Interface Contract

Public API unchanged (see above). New internal interfaces:

```typescript
// Strategy interfaces (internal)
interface RoutingStrategy {
  selectLevel(input: WorkflowInput, context: RoutingContext): Promise<WorkflowLevel>;
}

interface PlanningStrategy {
  decompose(level: WorkflowLevel, input: WorkflowInput): Promise<TaskAssignment[]>;
}

interface ExecutionStrategy {
  executeStep(task: TaskAssignment, context: ExecutionContext): Promise<TaskResult>;
}
```

## 4. Constraints & Risks

- **Risk (High)**: Implicit state dependencies between functions may not be obvious → mitigate with comprehensive integration test coverage before starting
- **Risk (Medium)**: Performance regression from additional indirection → benchmark before/after
- **Constraint**: MUST NOT change any public method signatures
- **Constraint**: MUST NOT introduce new npm dependencies
- **Constraint**: Each extraction phase MUST be independently deployable
- **EP-004 applied**: Metrics `workflow.engine.step.duration` and `workflow.engine.error.rate`

## 5. Acceptance Criteria

- [ ] `workflow-engine.ts` reduced to < 400 lines (facade only)
- [ ] All existing workflow integration tests pass
- [ ] State machine transitions are explicit and validated
- [ ] Strategy implementations are independently unit-testable
- [ ] No performance regression (P95 step duration within 10% of baseline)
- [ ] Checkpoint/resume functionality preserved

## 6. Detailed Analysis References

- @system-architect/analysis-F-006-workflow-engine-refactor.md — Strategy pattern, state machine, phased extraction
- @product-manager/analysis-F-006-workflow-engine-refactor.md — Interface freeze, risk control
- @data-architect/analysis-F-006-workflow-engine.md — State machine data model, event sourcing (M25)

## 7. Cross-Feature Dependencies

- **Depends on**: F-003 (type safety provides refactoring safety net)
- **Produces**: Clean engine interface for F-007 (visualization data pipeline) and F-008 (revision workflow)
- **Highest risk feature**: Requires dedicated testing phase and rollback plan
- **EP-005 applied**: Migrate-on-access for workflow state format changes
