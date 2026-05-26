import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickRollback } from './QuickRollback'

vi.mock('../api/client', () => ({
  quickRollbackWorkflow: vi.fn(),
}))

import { quickRollbackWorkflow } from '../api/client'
const mockedQuickRollbackWorkflow = vi.mocked(quickRollbackWorkflow)

const defaultProps = {
  isLoading: false,
  quickRollbackAdvancedToggle: '高级选项',
  quickRollbackSummary: '回滚摘要说明',
  quickRollbackTitle: '快速回滚',
  quickRollbackPlanIdPlaceholder: '计划 ID',
  quickRollbackCheckpointIdPlaceholder: '检查点 ID',
  quickRollbackReasonPlaceholder: '原因（可选）',
  quickRollbackAction: '执行回滚',
  quickRollbackMissingRequired: '缺少必填字段',
  quickRollbackFailed: '回滚失败',
  quickRollbackSuccess: '回滚成功',
}

describe('QuickRollback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hides rollback form by default and shows toggle button', () => {
    render(<QuickRollback {...defaultProps} />)

    expect(screen.getByRole('button', { name: '高级选项' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '执行回滚' })).not.toBeInTheDocument()
  })

  it('shows rollback form after clicking toggle', async () => {
    const user = userEvent.setup()
    render(<QuickRollback {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: '高级选项' }))

    expect(screen.getByRole('button', { name: '执行回滚' })).toBeInTheDocument()
    expect(screen.getByText('回滚摘要说明')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('计划 ID')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('检查点 ID')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('原因（可选）')).toBeInTheDocument()
  })

  it('shows error when required fields are empty', async () => {
    const user = userEvent.setup()
    render(<QuickRollback {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: '高级选项' }))
    await user.click(screen.getByRole('button', { name: '执行回滚' }))

    expect(screen.getByText('缺少必填字段')).toBeInTheDocument()
    expect(mockedQuickRollbackWorkflow).not.toHaveBeenCalled()
  })

  it('calls quickRollbackWorkflow with filled fields and shows success', async () => {
    mockedQuickRollbackWorkflow.mockResolvedValue({ success: true, data: { status: 'ok' } })
    const user = userEvent.setup()
    render(<QuickRollback {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: '高级选项' }))
    await user.type(screen.getByPlaceholderText('计划 ID'), 'plan-1')
    await user.type(screen.getByPlaceholderText('检查点 ID'), 'cp-1')
    await user.click(screen.getByRole('button', { name: '执行回滚' }))

    expect(mockedQuickRollbackWorkflow).toHaveBeenCalledWith('plan-1', 'cp-1', undefined)
    expect(screen.getByText('回滚成功')).toBeInTheDocument()
  })

  it('shows error message when rollback fails', async () => {
    mockedQuickRollbackWorkflow.mockResolvedValue({ success: false, error: 'Network error' })
    const user = userEvent.setup()
    render(<QuickRollback {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: '高级选项' }))
    await user.type(screen.getByPlaceholderText('计划 ID'), 'plan-1')
    await user.type(screen.getByPlaceholderText('检查点 ID'), 'cp-1')
    await user.click(screen.getByRole('button', { name: '执行回滚' }))

    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('disables rollback button when isLoading is true', async () => {
    const user = userEvent.setup()
    render(<QuickRollback {...defaultProps} isLoading={true} />)

    await user.click(screen.getByRole('button', { name: '高级选项' }))

    expect(screen.getByRole('button', { name: '执行回滚' })).toBeDisabled()
  })
})