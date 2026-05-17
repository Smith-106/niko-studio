import type { WorkflowAction } from '../../hooks/useEvaluationWorkflow'

export function getWorkflowActionLabel(action: WorkflowAction, labels: {
  route: string
  plan: string
  execute: string
  lifecycle: string
}): string {
  if (action === 'route') return labels.route
  if (action === 'plan') return labels.plan
  if (action === 'execute') return labels.execute
  return labels.lifecycle
}

export function pickWorkflowStateMessage(state: { status: string; message?: string | null }): string | null {
  if (state.status === 'idle' || !state.message) {
    return null
  }
  return state.message
}
