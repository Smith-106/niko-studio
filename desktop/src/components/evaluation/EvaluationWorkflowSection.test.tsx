import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  EvaluationWorkflowSection,
  type EvaluationWorkflowPreset,
} from './EvaluationWorkflowSection'
import type {
  WorkflowAction,
  WorkflowLifecycleAction,
} from '../../hooks/useEvaluationWorkflow'

function buildLabels() {
  return {
    taskPlaceholder: '任务',
    levelPlaceholder: '等级',
    planIdPlaceholder: '计划 ID',
    stepIdPlaceholder: '步骤 ID',
    lifecycleActionLabel: '生命周期动作',
    lifecycleStatus: '状态',
    lifecycleStart: '开始',
    lifecyclePause: '暂停',
    lifecycleResume: '恢复',
    lifecycleStop: '停止',
    route: '路由',
    plan: '计划',
    execute: '执行',
    lifecycle: '生命周期',
    waitingConfirmation: '等待确认',
    gateReason: '原因',
    confirmTokenPlaceholder: '确认令牌',
    confirmAndContinue: '确认并继续',
    retry: '重试',
  }
}

function buildWorkflowStates(
  overrides: Partial<Record<WorkflowAction, { status: string; message?: string | null }>> = {},
) {
  return {
    route: { status: 'idle', message: null },
    plan: { status: 'idle', message: null },
    execute: { status: 'idle', message: null },
    lifecycle: { status: 'idle', message: null },
    ...overrides,
  }
}

function renderSection(
  overrides: Partial<React.ComponentProps<typeof EvaluationWorkflowSection>> = {},
) {
  const presetAction = vi.fn(async () => {})
  const props: React.ComponentProps<typeof EvaluationWorkflowSection> = {
    isZh: true,
    writerWorkflowTitle: '工作流',
    writerWorkflowHint: '工作流提示',
    writerAdvancedTitle: '高级工作流',
    writerAdvancedHint: '高级工作流提示',
    scopeChips: ['章节 1', '场景 A'],
    hasMeaningfulScope: true,
    onOpenAutomation: vi.fn(),
    presets: [
      {
        id: 'preset-1',
        title: '快速路由',
        description: '生成推荐路线',
        action: presetAction,
      } satisfies EvaluationWorkflowPreset,
    ],
    showAdvancedWorkflow: false,
    onToggleAdvancedWorkflow: vi.fn(),
    workflowTask: '',
    workflowLevel: '',
    workflowPlanId: '',
    workflowStepId: '',
    workflowLifecycleAction: 'status',
    workflowConfirmToken: '',
    workflowWaitingConfirmation: false,
    workflowGateReason: null,
    workflowResult: null,
    workflowStates: buildWorkflowStates(),
    setWorkflowTask: vi.fn(),
    setWorkflowLevel: vi.fn(),
    setWorkflowPlanId: vi.fn(),
    setWorkflowStepId: vi.fn(),
    setWorkflowLifecycleAction: vi.fn(),
    setWorkflowConfirmToken: vi.fn(),
    onWorkflowRoute: vi.fn(),
    onWorkflowPlan: vi.fn(),
    onWorkflowExecute: vi.fn(),
    onWorkflowLifecycle: vi.fn(),
    onWorkflowConfirmAndContinue: vi.fn(),
    onRetryWorkflowAction: vi.fn(),
    labels: buildLabels(),
    ...overrides,
  }

  render(<EvaluationWorkflowSection {...props} />)

  return { props, presetAction }
}

describe('EvaluationWorkflowSection', () => {
  it('renders scope chips, automation entry, preset cards, and collapsed advanced toggle', async () => {
    const user = userEvent.setup()
    const { props, presetAction } = renderSection({ isZh: false })

    expect(screen.getByText('工作流')).toBeInTheDocument()
    expect(screen.getByText('章节 1')).toBeInTheDocument()
    expect(screen.getByText('场景 A')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open automation tasks panel/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '高级工作流' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('任务')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Open automation tasks panel/ }))
    await user.click(screen.getByRole('button', { name: /快速路由/ }))
    await user.click(screen.getByRole('button', { name: '高级工作流' }))

    expect(props.onOpenAutomation).toHaveBeenCalledTimes(1)
    expect(presetAction).toHaveBeenCalledTimes(1)
    expect(props.onToggleAdvancedWorkflow).toHaveBeenCalledTimes(1)
  })

  it('renders and wires the advanced workflow controls, waiting confirmation, retry, and result output', async () => {
    const user = userEvent.setup()
    const { props } = renderSection({
      hasMeaningfulScope: false,
      onOpenAutomation: undefined,
      showAdvancedWorkflow: true,
      workflowTask: '当前任务',
      workflowLevel: 'L2',
      workflowPlanId: 'plan-7',
      workflowStepId: 'step-3',
      workflowLifecycleAction: 'resume' satisfies WorkflowLifecycleAction,
      workflowConfirmToken: 'token-7',
      workflowWaitingConfirmation: true,
      workflowGateReason: '需要人工批准',
      workflowResult: '{\"status\":\"ok\"}',
      workflowStates: buildWorkflowStates({
        route: { status: 'error', message: 'route failed' },
        plan: { status: 'success', message: 'plan ready' },
        execute: { status: 'success', message: 'execute ready' },
        lifecycle: { status: 'idle', message: null },
      }),
    })

    expect(screen.queryByText('章节 1')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /打开自动化任务面板/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '高级工作流' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('任务')).toHaveValue('当前任务')
    expect(screen.getByLabelText('等级')).toHaveValue('L2')
    expect(screen.getByLabelText('计划 ID')).toHaveValue('plan-7')
    expect(screen.getByLabelText('步骤 ID')).toHaveValue('step-3')
    expect(screen.getByLabelText('生命周期动作')).toHaveValue('resume')
    expect(screen.getByText('等待确认')).toBeInTheDocument()
    expect(screen.getByText('原因: 需要人工批准')).toBeInTheDocument()
    expect(screen.getByText('路由: route failed')).toBeInTheDocument()
    expect(screen.getByText('计划: plan ready')).toBeInTheDocument()
    expect(screen.getByText('执行: execute ready')).toBeInTheDocument()
    expect(screen.queryByText(/^生命周期:/)).not.toBeInTheDocument()
    expect(screen.getByText('{"status":"ok"}')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('任务'), { target: { value: '新任务' } })
    fireEvent.change(screen.getByLabelText('等级'), { target: { value: 'L3' } })
    fireEvent.change(screen.getByLabelText('计划 ID'), { target: { value: 'plan-9' } })
    fireEvent.change(screen.getByLabelText('步骤 ID'), { target: { value: 'step-8' } })
    fireEvent.change(screen.getByLabelText('生命周期动作'), { target: { value: 'stop' } })
    fireEvent.change(screen.getByLabelText('确认令牌'), { target: { value: 'confirm-1' } })

    await user.click(screen.getByRole('button', { name: '路由' }))
    await user.click(screen.getByRole('button', { name: '计划' }))
    await user.click(screen.getByRole('button', { name: '执行' }))
    await user.click(screen.getByRole('button', { name: '生命周期' }))
    await user.click(screen.getByRole('button', { name: '确认并继续' }))
    await user.click(screen.getByRole('button', { name: '重试' }))

    expect(props.setWorkflowTask).toHaveBeenLastCalledWith('新任务')
    expect(props.setWorkflowLevel).toHaveBeenLastCalledWith('L3')
    expect(props.setWorkflowPlanId).toHaveBeenLastCalledWith('plan-9')
    expect(props.setWorkflowStepId).toHaveBeenLastCalledWith('step-8')
    expect(props.setWorkflowLifecycleAction).toHaveBeenCalledWith('stop')
    expect(props.setWorkflowConfirmToken).toHaveBeenLastCalledWith('confirm-1')
    expect(props.onWorkflowRoute).toHaveBeenCalledTimes(1)
    expect(props.onWorkflowPlan).toHaveBeenCalledTimes(1)
    expect(props.onWorkflowExecute).toHaveBeenCalledTimes(1)
    expect(props.onWorkflowLifecycle).toHaveBeenCalledTimes(1)
    expect(props.onWorkflowConfirmAndContinue).toHaveBeenCalledTimes(1)
    expect(props.onRetryWorkflowAction).toHaveBeenCalledWith('route')
  })

  it('renders chinese automation helper copy when the automation entry is available', () => {
    renderSection({
      isZh: true,
      onOpenAutomation: vi.fn(),
    })

    expect(screen.getByRole('button', { name: /打开自动化任务面板/ })).toBeInTheDocument()
    expect(screen.getByText(/查看调度任务状态/)).toBeInTheDocument()
  })

  it('renders loading workflow messages without retry actions', () => {
    renderSection({
      showAdvancedWorkflow: true,
      workflowStates: buildWorkflowStates({
        lifecycle: { status: 'loading', message: 'working' },
      }),
    })

    expect(screen.getByText('生命周期: working')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
  })
})
