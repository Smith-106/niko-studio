import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { QuickRollback } from './QuickRollback'

vi.mock('../api/client', () => ({
  quickRollbackWorkflow: vi.fn(),
}))

import { quickRollbackWorkflow } from '../api/client'

const mockedQuickRollbackWorkflow = vi.mocked(quickRollbackWorkflow)

const defaultProps = {
  isLoading: false,
  quickRollbackAdvancedToggle: 'Advanced options',
  quickRollbackSummary: 'Rollback summary guidance',
  quickRollbackTitle: 'Quick rollback',
  quickRollbackPlanIdPlaceholder: 'Plan ID',
  quickRollbackCheckpointIdPlaceholder: 'Checkpoint ID',
  quickRollbackReasonPlaceholder: 'Reason (optional)',
  quickRollbackAction: 'Run rollback',
  quickRollbackMissingRequired: 'Missing required fields',
  quickRollbackFailed: 'Rollback failed',
  quickRollbackSuccess: 'Rollback succeeded',
}

describe('QuickRollback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hides rollback form by default and shows toggle button', () => {
    render(<QuickRollback {...defaultProps} />)

    expect(screen.getByRole('button', { name: defaultProps.quickRollbackAdvancedToggle })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: defaultProps.quickRollbackAction })).not.toBeInTheDocument()
  })

  it('shows rollback form after clicking toggle', async () => {
    const user = userEvent.setup()
    render(<QuickRollback {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: defaultProps.quickRollbackAdvancedToggle }))

    expect(screen.getByRole('button', { name: defaultProps.quickRollbackAction })).toBeInTheDocument()
    expect(screen.getByText(defaultProps.quickRollbackSummary)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(defaultProps.quickRollbackPlanIdPlaceholder)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(defaultProps.quickRollbackCheckpointIdPlaceholder)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(defaultProps.quickRollbackReasonPlaceholder)).toBeInTheDocument()
  })

  it('shows error when required fields are empty', async () => {
    const user = userEvent.setup()
    render(<QuickRollback {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: defaultProps.quickRollbackAdvancedToggle }))
    await user.click(screen.getByRole('button', { name: defaultProps.quickRollbackAction }))

    expect(screen.getByText(defaultProps.quickRollbackMissingRequired)).toBeInTheDocument()
    expect(mockedQuickRollbackWorkflow).not.toHaveBeenCalled()
  })

  it('calls quickRollbackWorkflow with filled fields and shows success', async () => {
    mockedQuickRollbackWorkflow.mockResolvedValue({ success: true, data: { status: 'ok' } })
    const user = userEvent.setup()
    render(<QuickRollback {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: defaultProps.quickRollbackAdvancedToggle }))
    await user.type(screen.getByPlaceholderText(defaultProps.quickRollbackPlanIdPlaceholder), 'plan-1')
    await user.type(screen.getByPlaceholderText(defaultProps.quickRollbackCheckpointIdPlaceholder), 'cp-1')
    await user.click(screen.getByRole('button', { name: defaultProps.quickRollbackAction }))

    expect(mockedQuickRollbackWorkflow).toHaveBeenCalledWith('plan-1', 'cp-1', undefined)
    expect(screen.getByText(defaultProps.quickRollbackSuccess)).toBeInTheDocument()
  })

  it('shows error message when rollback fails', async () => {
    mockedQuickRollbackWorkflow.mockResolvedValue({ success: false, error: 'Network error' })
    const user = userEvent.setup()
    render(<QuickRollback {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: defaultProps.quickRollbackAdvancedToggle }))
    await user.type(screen.getByPlaceholderText(defaultProps.quickRollbackPlanIdPlaceholder), 'plan-1')
    await user.type(screen.getByPlaceholderText(defaultProps.quickRollbackCheckpointIdPlaceholder), 'cp-1')
    await user.click(screen.getByRole('button', { name: defaultProps.quickRollbackAction }))

    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('auto-expands advanced controls when requested', async () => {
    render(<QuickRollback {...defaultProps} autoExpand={true} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: defaultProps.quickRollbackAction })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: defaultProps.quickRollbackAdvancedToggle }).className).toContain('text-amber-500')
  })

  it('shows the generic failure message when rollback throws unexpectedly', async () => {
    mockedQuickRollbackWorkflow.mockRejectedValue(new Error('unexpected failure'))
    const user = userEvent.setup()
    render(<QuickRollback {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: defaultProps.quickRollbackAdvancedToggle }))
    await user.type(screen.getByPlaceholderText(defaultProps.quickRollbackPlanIdPlaceholder), 'plan-1')
    await user.type(screen.getByPlaceholderText(defaultProps.quickRollbackCheckpointIdPlaceholder), 'cp-1')
    await user.type(screen.getByPlaceholderText(defaultProps.quickRollbackReasonPlaceholder), '  reason from user  ')
    await user.click(screen.getByRole('button', { name: defaultProps.quickRollbackAction }))

    expect(mockedQuickRollbackWorkflow).toHaveBeenCalledWith('plan-1', 'cp-1', 'reason from user')
    await waitFor(() => {
      expect(screen.getByText(defaultProps.quickRollbackFailed)).toBeInTheDocument()
    })
  })

  it('disables rollback button when isLoading is true', async () => {
    const user = userEvent.setup()
    render(<QuickRollback {...defaultProps} isLoading={true} />)

    await user.click(screen.getByRole('button', { name: defaultProps.quickRollbackAdvancedToggle }))

    expect(screen.getByRole('button', { name: defaultProps.quickRollbackAction })).toBeDisabled()
  })
})
