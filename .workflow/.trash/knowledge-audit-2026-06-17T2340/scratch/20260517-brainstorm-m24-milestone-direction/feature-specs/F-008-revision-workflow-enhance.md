# F-008: Intelligent Revision Workflow Enhancement

## 1. Requirements Summary

An enhanced revision workflow SHOULD be designed (spec-only in M24) that leverages M23's reader-state model to provide targeted revision suggestions, before/after comparison analysis, and iterative revision tracking with effect quantification. Full implementation is deferred to M25 pending F-005 and F-006 completion.

## 2. Design Decisions [CORE]

### M24 Scope: Design Only (No Implementation)

Per cross-role consensus, F-008 is **design-only** in M24:
- Produce detailed technical specification
- Define data models and API contracts
- Identify integration points with F-005 (catalog) and F-006 (engine)
- Implementation begins in M25 after dependencies are stable

### Architecture: Revision Session State Machine

```
┌─────────┐    analyze    ┌──────────┐   suggest   ┌───────────┐
│  IDLE   │──────────────>│ ANALYZED │────────────>│ SUGGESTED │
└─────────┘               └──────────┘             └───────────┘
                                                        │
                              ┌──────────┐   apply     │
                              │ REVISED  │<────────────┘
                              └──────────┘
                                   │
                          compare  │
                                   v
                              ┌──────────┐
                              │ COMPARED │──> (loop back to ANALYZED)
                              └──────────┘
```

**States**:
- `IDLE`: No active revision session
- `ANALYZED`: Reader-state analysis complete, weak points identified
- `SUGGESTED`: Targeted revision suggestions generated per weak point
- `REVISED`: User has applied revisions (manual or AI-assisted)
- `COMPARED`: Before/after analysis complete, effect quantified

### Data Model

```typescript
interface RevisionSession {
  $schema_version: string;
  id: string;
  chapterId: string;
  createdAt: string;
  state: RevisionState;
  iterations: RevisionIteration[];
  baselineScores: DimensionScores;
}

interface RevisionIteration {
  iterationNumber: number;
  weakPoints: WeakPoint[];
  suggestions: RevisionSuggestion[];
  appliedAt?: string;
  resultScores?: DimensionScores;
  improvement?: DimensionDelta;
}

interface WeakPoint {
  dimensionId: WritingCraftDimension;
  location: TextRange;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  readerImpact: string; // from M23 reader-state model
}

interface RevisionSuggestion {
  weakPointId: string;
  strategy: string;
  example?: string;
  catalogReference?: string; // links to externalized craft-catalog (F-005)
}
```

### Integration Points

| Dependency | What It Provides | Status |
|-----------|-----------------|--------|
| F-005 Craft Catalog | Revision strategies linked to catalog entries | M24 (parallel) |
| F-006 Workflow Engine | New `revision` task type in engine | M24 (prerequisite) |
| M23 Reader-State Model | Baseline analysis + weak point detection | Completed |
| M13-M16 Dimensions | Scoring framework for before/after comparison | Completed |

### Effect Quantification Pipeline

```
Before Text → Analyze (M23 model) → Baseline Scores
                                          ↓
After Text → Analyze (same model) → Result Scores
                                          ↓
                                    Delta Calculation
                                          ↓
                                    Improvement Report
```

Quantification MUST use the same analysis parameters for before/after to ensure fair comparison.

## 3. Interface Contract

```typescript
// Proposed API (M25 implementation)
interface RevisionWorkflowService {
  startSession(chapterId: string): Promise<RevisionSession>;
  analyzeWeakPoints(sessionId: string): Promise<WeakPoint[]>;
  generateSuggestions(sessionId: string, weakPointIds: string[]): Promise<RevisionSuggestion[]>;
  markRevised(sessionId: string, iterationNumber: number): Promise<void>;
  compareResults(sessionId: string): Promise<RevisionComparison>;
  getHistory(chapterId: string): Promise<RevisionSession[]>;
}
```

## 4. Constraints & Risks

- **Risk (Medium)**: Reader-state model accuracy may not be sufficient for actionable suggestions → validate with user testing in M25
- **Risk (Low)**: Revision loop may not converge (scores don't improve) → cap iterations (configurable, default 5)
- **Constraint**: MUST NOT modify existing analysis engines (consume their output only)
- **Constraint**: Revision suggestions MUST reference craft-catalog entries (traceability)

## 5. Acceptance Criteria (M24 — Design Only)

- [ ] Technical specification document complete
- [ ] Data models defined with JSON Schema
- [ ] API contract defined with TypeScript interfaces
- [ ] Integration points with F-005 and F-006 documented
- [ ] State machine transitions formally specified
- [ ] M25 implementation plan outlined

## 6. Detailed Analysis References

- @system-architect/analysis-F-008-revision-workflow-enhance.md — State machine, effect quantification pipeline
- @product-manager/analysis-F-008-revision-workflow-enhance.md — User value, M25 priority, MVP definition
- @data-architect/analysis-F-008-data-contract.md — Contract versioning, API schema typing

## 7. Cross-Feature Dependencies

- **Depends on**: F-005 (catalog data access), F-006 (engine supports revision task type)
- **Consumes**: M23 reader-state model, M13-M16 dimension scoring
- **Deferred to**: M25 (design-only in M24)
- **Enables**: Writing knowledge personalization (future), writing session intelligence (future)
