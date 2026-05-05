# F-007: Advanced AI Agent Workflows

> Priority: MEDIUM | Phase: M9-P2 | Depends: F-004 (intelligence layer)
> Roles: product-manager, system-architect

---

## Requirements Summary

Extend existing single-shot AI agents into multi-step workflow chains with human checkpoints. Writers define automated pipelines (outline → draft → revise → polish) that execute step-by-step with approval gates.

**MUST**:
- Define workflow as ordered sequence of agent steps
- Each step has configurable agent mode, prompt, and input/output mapping
- Human checkpoint between steps (review output before proceeding)
- Workflow execution history with step outputs

**SHOULD**:
- Pre-built workflow templates (novel chapter pipeline, revision pass, style adaptation)
- Workflow pausing and resuming
- Step output diff (before/after comparison)

**MAY**:
- Conditional branching (if chapter > 3000 words, run compression step)
- Parallel step execution
- Workflow scheduling (run overnight)

---

## Design Decisions (40%+)

1. **Workflow as JSON definition**: Workflows stored as JSON arrays of step objects. Simple, serializable, editable by advanced users.

2. **Sequential execution with checkpoints**: Steps execute one at a time. After each step, UI shows output and asks user to approve/modify/reject before proceeding. No background execution in V1.

3. **Step input = previous step output**: Each step receives the output of the previous step as its input context. No complex data routing in V1.

4. **Leverage existing agent infrastructure**: Steps use existing gateway agent modes (writing, analysis, evaluation). No new AI capabilities needed — just orchestration.

---

## Interface Contract

```typescript
interface Workflow {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  createdAt: string
}

interface WorkflowStep {
  id: string
  name: string
  agentMode: 'writing' | 'analysis' | 'evaluation' | 'custom'
  prompt: string
  inputSource: 'previous_step' | 'chapter_content' | 'story_bible' | 'outline'
  checkpoint: boolean  // require human approval
}

interface WorkflowExecution {
  id: string
  workflowId: string
  chapterId: string
  status: 'running' | 'paused' | 'completed' | 'failed'
  currentStep: number
  stepResults: StepResult[]
  startedAt: string
  completedAt: string | null
}
```

---

## Constraints & Risks

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| LLM context window limits | Long workflows may exceed context | Each step summarizes previous output |
| Workflow latency | 5-step workflow = 5 AI calls | Show progress, allow pause/resume |
| Output quality variability | AI-generated text quality inconsistent | Human checkpoints at every step |
| User confusion | Complex workflow editor may overwhelm | Start with pre-built templates, hide complexity |

---

## Acceptance Criteria

- [ ] User can create a workflow with ≥3 sequential steps
- [ ] Workflow executes steps sequentially with human checkpoints
- [ ] Each step's output displayed for review before proceeding
- [ ] Workflow execution history viewable after completion
- [ ] Pre-built "chapter pipeline" workflow template available

---

## Cross-Feature Dependencies

- **F-001 (Project Management)**: Workflows scoped to chapters
- **F-004 (Writing Intelligence)**: Intelligence modules available as workflow steps
