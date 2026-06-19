import { describe, expect, it } from 'vitest'

import { getWorkflowActionLabel, pickWorkflowStateMessage } from './workflowUiUtils'

const labels = {
  route: 'Route',
  plan: 'Plan',
  execute: 'Execute',
  lifecycle: 'Lifecycle',
}

describe('workflowUiUtils', () => {
  it('maps every workflow action to the correct label', () => {
    expect(getWorkflowActionLabel('route', labels)).toBe('Route')
    expect(getWorkflowActionLabel('plan', labels)).toBe('Plan')
    expect(getWorkflowActionLabel('execute', labels)).toBe('Execute')
    expect(getWorkflowActionLabel('lifecycle', labels)).toBe('Lifecycle')
  })

  it('suppresses idle or empty state messages and returns active messages', () => {
    expect(pickWorkflowStateMessage({ status: 'idle', message: 'hidden' })).toBeNull()
    expect(pickWorkflowStateMessage({ status: 'loading', message: '' })).toBeNull()
    expect(pickWorkflowStateMessage({ status: 'error', message: null })).toBeNull()
    expect(pickWorkflowStateMessage({ status: 'success', message: 'Ready' })).toBe('Ready')
  })
})
