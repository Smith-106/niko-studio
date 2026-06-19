import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { WorkflowEditorPanel } from './WorkflowEditorPanel'
import type { Workflow, WorkflowExecution } from '../types/workflow'

const { resetWorkflowStoreMock, useAppStoreMock, workflowStoreState } = vi.hoisted(() => {
  const workflowStoreState = {
    workflows: [] as Workflow[],
    activeExecution: null as WorkflowExecution | null,
    workflowsLoading: false,
    workflowsError: null as string | null,
    fetchWorkflows: vi.fn(async () => {}),
    saveWorkflow: vi.fn(async (workflow: Workflow) => {
      const next = [...workflowStoreState.workflows]
      const index = next.findIndex((item) => item.id === workflow.id)
      if (index >= 0) {
        next[index] = workflow
      } else {
        next.push(workflow)
      }
      workflowStoreState.workflows = next
    }),
    deleteWorkflow: vi.fn(async (workflowId: string) => {
      workflowStoreState.workflows = workflowStoreState.workflows.filter((item) => item.id !== workflowId)
    }),
    startExecution: vi.fn(async () => {}),
    approveStep: vi.fn(() => {}),
    rejectStep: vi.fn(() => {
      workflowStoreState.activeExecution = null
    }),
  }

  const resetWorkflowStoreMock = () => {
    workflowStoreState.workflows = []
    workflowStoreState.activeExecution = null
    workflowStoreState.workflowsLoading = false
    workflowStoreState.workflowsError = null
    workflowStoreState.fetchWorkflows = vi.fn(async () => {})
    workflowStoreState.saveWorkflow = vi.fn(async (workflow: Workflow) => {
      const next = [...workflowStoreState.workflows]
      const index = next.findIndex((item) => item.id === workflow.id)
      if (index >= 0) {
        next[index] = workflow
      } else {
        next.push(workflow)
      }
      workflowStoreState.workflows = next
    })
    workflowStoreState.deleteWorkflow = vi.fn(async (workflowId: string) => {
      workflowStoreState.workflows = workflowStoreState.workflows.filter((item) => item.id !== workflowId)
    })
    workflowStoreState.startExecution = vi.fn(async () => {})
    workflowStoreState.approveStep = vi.fn(() => {})
    workflowStoreState.rejectStep = vi.fn(() => {
      workflowStoreState.activeExecution = null
    })
  }

  const useAppStoreMock = Object.assign(
    <T,>(selector?: (state: typeof workflowStoreState) => T) => (
      selector ? selector(workflowStoreState) : (workflowStoreState as T)
    ),
    {
      getState: () => workflowStoreState,
      setState: (
        partial:
          | Partial<typeof workflowStoreState>
          | ((state: typeof workflowStoreState) => Partial<typeof workflowStoreState>),
      ) => {
        Object.assign(
          workflowStoreState,
          typeof partial === 'function' ? partial(workflowStoreState) : partial,
        )
      },
    },
  )

  return {
    resetWorkflowStoreMock,
    useAppStoreMock,
    workflowStoreState,
  }
})

vi.mock('../stores/appStore', () => ({
  useAppStore: useAppStoreMock,
}))

vi.mock('../i18n', () => {
  const t = {
    workflowTitle: 'Workflows',
    workflowBackToList: 'Back to list',
    workflowCreateNew: '+ New workflow',
    workflowUnnamed: 'Unnamed workflow',
    workflowStepCount: '{count} steps',
    workflowDelete: 'Delete',
    workflowRun: 'Run',
    workflowEmpty: 'No workflows yet',
    workflowLoading: 'Loading...',
    workflowNamePlaceholder: 'Workflow name',
    workflowDescriptionPlaceholder: 'Description',
    workflowSteps: 'Steps',
    workflowAddStep: '+ Add step',
    workflowUnnamedStep: 'Unnamed step',
    workflowModeLabel: 'Mode',
    workflowModeWriting: 'Writing',
    workflowModeAnalysis: 'Analysis',
    workflowModeEvaluation: 'Evaluation',
    workflowModeCustom: 'Custom',
    workflowPromptLabel: 'Prompt',
    workflowPromptPlaceholder: 'Step prompt',
    workflowInputSourceLabel: 'Input source',
    workflowInputPreviousStep: 'Previous step output',
    workflowInputChapterContent: 'Chapter content',
    workflowInputStoryBible: 'Story bible',
    workflowInputOutline: 'Outline',
    workflowCheckpointLabel: 'Checkpoint',
    workflowCheckpointNone: 'None',
    workflowCheckpointReview: 'Review',
    workflowCheckpointApprove: 'Approve',
    workflowEnableStep: 'Enable this step',
    workflowSave: 'Save workflow',
    workflowConfirmDelete: 'Delete this workflow?',
    workflowConfirmDeleteYes: 'Delete',
    workflowConfirmDeleteNo: 'Cancel',
    workflowExecutionStep: 'Step {step}',
    workflowCheckpointReviewOutput: 'Checkpoint review output',
    workflowApproveContinue: 'Approve & continue',
    workflowSubmitModifiedContinue: 'Submit changes & continue',
    workflowModify: 'Edit',
    workflowReject: 'Reject',
  }

  return {
    useI18n: () => ({
      t,
      language: 'en',
      translate: (key: keyof typeof t, params?: Record<string, string | number>) => {
        let text = t[key] ?? String(key)
        if (params) {
          for (const [name, value] of Object.entries(params)) {
            text = text.replace(`{${name}}`, String(value))
          }
        }
        return text
      },
    }),
  }
})

function createWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: 'workflow-alpha',
    name: 'Alpha workflow',
    description: 'Workflow description',
    steps: [
      {
        id: 'step-1',
        name: 'Draft scene',
        agentMode: 'writing',
        prompt: 'Write a draft',
        inputSource: 'chapter_content',
        checkpoint: 'none',
        enabled: true,
      },
    ],
    isBuiltin: false,
    createdAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:00.000Z',
    ...overrides,
  }
}

describe('WorkflowEditorPanel', () => {
  beforeEach(() => {
    resetWorkflowStoreMock()
  })

  it('creates and saves a workflow with additional steps', async () => {
    const user = userEvent.setup()

    render(<WorkflowEditorPanel onClose={vi.fn()} />)

    expect(workflowStoreState.fetchWorkflows).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: '+ New workflow' }))
    await user.type(screen.getAllByPlaceholderText('Workflow name')[0], 'Fresh flow')
    await user.type(screen.getByPlaceholderText('Description'), 'Created from the editor panel')
    await user.click(screen.getByRole('button', { name: '+ Add step' }))

    expect(screen.getAllByText('Unnamed step').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Save workflow' }))

    await waitFor(() => expect(workflowStoreState.saveWorkflow).toHaveBeenCalledTimes(1))

    const savedWorkflow = vi.mocked(workflowStoreState.saveWorkflow).mock.calls[0]?.[0]
    expect(savedWorkflow?.name).toBe('Fresh flow')
    expect(savedWorkflow?.description).toContain('Created from the editor panel')
    expect(savedWorkflow?.steps).toHaveLength(2)
    expect(screen.getByText('Fresh flow')).toBeInTheDocument()
  })

  it('confirms deletion for custom workflows', async () => {
    const user = userEvent.setup()
    workflowStoreState.workflows = [createWorkflow()]

    render(<WorkflowEditorPanel onClose={vi.fn()} />)

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]!)
    expect(screen.getByText('Delete this workflow?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(workflowStoreState.deleteWorkflow).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Back to list' }))

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]!)
    const confirmDialog = screen.getByText('Delete this workflow?').parentElement?.parentElement
    expect(confirmDialog).toBeTruthy()
    await user.click(within(confirmDialog!).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(workflowStoreState.deleteWorkflow).toHaveBeenCalledWith('workflow-alpha'))
    expect(screen.queryByText('Alpha workflow')).not.toBeInTheDocument()
  })

  it('runs a paused execution and supports approve, edit, and reject actions', async () => {
    const user = userEvent.setup()
    const workflow = createWorkflow()
    const pausedExecution: WorkflowExecution = {
      id: 'execution-1',
      workflowId: workflow.id,
      chapterId: '',
      status: 'paused',
      currentStepIndex: 0,
      stepResults: [
        {
          stepIndex: 0,
          input: 'input',
          output: 'Original output',
          status: 'completed',
          timestamp: '2026-06-03T00:00:00.000Z',
        },
      ],
      startedAt: '2026-06-03T00:00:00.000Z',
      completedAt: null,
    }

    workflowStoreState.workflows = [workflow]
    workflowStoreState.startExecution = vi.fn(async () => {
      workflowStoreState.activeExecution = pausedExecution
    })

    render(<WorkflowEditorPanel onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Approve & continue' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    const outputEditor = screen.getByRole('textbox')
    await user.clear(outputEditor)
    await user.type(outputEditor, 'Revised output')

    await user.click(screen.getByRole('button', { name: 'Submit changes & continue' }))

    await waitFor(() => {
      expect(workflowStoreState.approveStep).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        'Revised output',
      )
    })

    await user.click(screen.getByRole('button', { name: 'Reject' }))

    expect(workflowStoreState.rejectStep).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Alpha workflow')).toBeInTheDocument()
  })

  it('approves a paused execution without edits when the user continues immediately', async () => {
    const user = userEvent.setup()
    const workflow = createWorkflow({
      steps: [
        {
          id: 'step-1',
          name: 'Draft scene',
          agentMode: 'writing',
          prompt: 'Draft the scene',
          inputSource: 'chapter_content',
          checkpoint: 'none',
          enabled: true,
        },
        {
          id: 'step-2',
          name: 'Review scene',
          agentMode: 'analysis',
          prompt: 'Review the draft',
          inputSource: 'previous_step',
          checkpoint: 'review',
          enabled: true,
        },
      ],
    })
    const pausedExecution: WorkflowExecution = {
      id: 'execution-approve-direct',
      workflowId: workflow.id,
      chapterId: '',
      status: 'paused',
      currentStepIndex: 1,
      stepResults: [
        {
          stepIndex: 0,
          input: 'input',
          output: 'Original output',
          status: 'completed',
          timestamp: '2026-06-03T00:00:00.000Z',
        },
      ],
      startedAt: '2026-06-03T00:00:00.000Z',
      completedAt: null,
    }

    workflowStoreState.workflows = [workflow]
    workflowStoreState.startExecution = vi.fn(async () => {
      workflowStoreState.activeExecution = pausedExecution
    })

    render(<WorkflowEditorPanel onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Approve & continue' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Approve & continue' }))

    expect(workflowStoreState.approveStep).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      undefined,
    )
  })

  it('shows loading and error states for the workflow list', () => {
    workflowStoreState.workflowsLoading = true
    workflowStoreState.workflowsError = 'Failed to load workflows'

    render(<WorkflowEditorPanel onClose={vi.fn()} />)

    expect(screen.getByText('Failed to load workflows')).toBeInTheDocument()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows the empty state when there are no workflows to render', () => {
    render(<WorkflowEditorPanel onClose={vi.fn()} />)

    expect(screen.getByText('No workflows yet')).toBeInTheDocument()
  })

  it('does not start execution when every workflow step is disabled', async () => {
    const user = userEvent.setup()
    workflowStoreState.workflows = [
      createWorkflow({
        steps: [
          {
            id: 'step-disabled',
            name: 'Disabled draft',
            agentMode: 'writing',
            prompt: 'Skip execution',
            inputSource: 'chapter_content',
            checkpoint: 'none',
            enabled: false,
          },
        ],
      }),
    ]

    render(<WorkflowEditorPanel onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Run' }))

    expect(workflowStoreState.startExecution).not.toHaveBeenCalled()
    expect(screen.getByText('Alpha workflow')).toBeInTheDocument()
  })

  it('updates step fields, switches active steps, removes a step, and saves the workflow', async () => {
    const user = userEvent.setup()
    workflowStoreState.workflows = [
      createWorkflow({
        steps: [
          {
            id: 'step-1',
            name: 'Draft scene',
            agentMode: 'writing',
            prompt: 'Write a draft',
            inputSource: 'chapter_content',
            checkpoint: 'none',
            enabled: true,
          },
          {
            id: 'step-2',
            name: 'Review scene',
            agentMode: 'analysis',
            prompt: 'Review the draft',
            inputSource: 'previous_step',
            checkpoint: 'review',
            enabled: true,
          },
        ],
      }),
    ]

    render(<WorkflowEditorPanel onClose={vi.fn()} />)

    await user.click(screen.getByText('Alpha workflow'))
    await user.click(screen.getByRole('button', { name: /Review scene/ }))

    const nameInputs = screen.getAllByPlaceholderText('Workflow name')
    await user.clear(nameInputs[1]!)
    await user.type(nameInputs[1]!, 'Final polish')

    await user.selectOptions(screen.getAllByRole('combobox')[0]!, 'custom')

    const promptInput = screen.getByPlaceholderText('Step prompt')
    await user.clear(promptInput)
    await user.type(promptInput, 'Polish the final output')

    await user.selectOptions(screen.getAllByRole('combobox')[1]!, 'outline')
    await user.selectOptions(screen.getAllByRole('combobox')[2]!, 'approve')
    await user.click(screen.getByLabelText('Enable this step'))

    await user.click(screen.getByRole('button', { name: '+ Add step' }))
    await user.click(screen.getAllByRole('button', { name: /Unnamed step/ }).at(-1)!)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await user.click(screen.getByRole('button', { name: 'Save workflow' }))

    await waitFor(() => expect(workflowStoreState.saveWorkflow).toHaveBeenCalledTimes(1))

    const savedWorkflow = vi.mocked(workflowStoreState.saveWorkflow).mock.calls[0]?.[0]
    const updatedStep = savedWorkflow?.steps.find((step) => step.id === 'step-2')

    expect(savedWorkflow?.steps).toHaveLength(2)
    expect(updatedStep).toMatchObject({
      name: 'Final polish',
      agentMode: 'custom',
      prompt: 'Polish the final output',
      inputSource: 'outline',
      checkpoint: 'approve',
      enabled: false,
    })
  })

  it('renders running execution progress for active workflows', async () => {
    const user = userEvent.setup()
    const workflow = createWorkflow({
      steps: [
        {
          id: 'step-1',
          name: 'Draft scene',
          agentMode: 'writing',
          prompt: 'Draft the scene',
          inputSource: 'chapter_content',
          checkpoint: 'none',
          enabled: true,
        },
        {
          id: 'step-2',
          name: 'Revise scene',
          agentMode: 'analysis',
          prompt: 'Revise the scene',
          inputSource: 'previous_step',
          checkpoint: 'review',
          enabled: true,
        },
      ],
    })
    const runningExecution: WorkflowExecution = {
      id: 'execution-running',
      workflowId: workflow.id,
      chapterId: '',
      status: 'running',
      currentStepIndex: 1,
      stepResults: [
        {
          stepIndex: 0,
          input: 'seed',
          output: 'Draft completed',
          status: 'completed',
          timestamp: '2026-06-03T00:00:00.000Z',
        },
      ],
      startedAt: '2026-06-03T00:00:00.000Z',
      completedAt: null,
    }

    workflowStoreState.workflows = [workflow]
    workflowStoreState.startExecution = vi.fn(async () => {
      workflowStoreState.activeExecution = runningExecution
    })

    const { container } = render(<WorkflowEditorPanel onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Step progress pipeline')).toBeInTheDocument()
    })

    expect(screen.getByText('Draft completed')).toBeInTheDocument()
    expect(screen.getByText('Revise scene')).toBeInTheDocument()
    expect(container.querySelectorAll('.animate-spin').length).toBeGreaterThan(0)
  })

  it('renders the fallback execution log when workflow details are unavailable', async () => {
    const user = userEvent.setup()
    const workflow = createWorkflow()
    const missingWorkflowExecution: WorkflowExecution = {
      id: 'execution-missing',
      workflowId: 'workflow-missing',
      chapterId: '',
      status: 'failed',
      currentStepIndex: 1,
      stepResults: [
        {
          stepIndex: 0,
          input: 'input-1',
          output: 'Recovered draft',
          status: 'completed',
          timestamp: '2026-06-03T00:00:00.000Z',
        },
        {
          stepIndex: 1,
          input: 'input-2',
          output: 'Execution failed',
          status: 'failed',
          timestamp: '2026-06-03T00:01:00.000Z',
        },
      ],
      startedAt: '2026-06-03T00:00:00.000Z',
      completedAt: null,
    }

    workflowStoreState.workflows = [workflow]
    workflowStoreState.startExecution = vi.fn(async () => {
      workflowStoreState.activeExecution = missingWorkflowExecution
      workflowStoreState.workflows = []
    })

    render(<WorkflowEditorPanel onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => {
      expect(screen.getByText('Recovered draft')).toBeInTheDocument()
    })

    expect(screen.queryByLabelText('Step progress pipeline')).not.toBeInTheDocument()
    expect(screen.getByText('Execution failed')).toBeInTheDocument()
    expect(screen.getByText('completed')).toBeInTheDocument()
    expect(screen.getByText('failed')).toBeInTheDocument()
  })

  it('renders failed and waiting step states inside the execution pipeline', async () => {
    const user = userEvent.setup()
    const workflow = createWorkflow({
      steps: [
        {
          id: 'step-1',
          name: 'Draft scene',
          agentMode: 'writing',
          prompt: 'Draft the scene',
          inputSource: 'chapter_content',
          checkpoint: 'none',
          enabled: true,
        },
        {
          id: 'step-2',
          name: 'Review scene',
          agentMode: 'analysis',
          prompt: 'Review the scene',
          inputSource: 'previous_step',
          checkpoint: 'review',
          enabled: true,
        },
        {
          id: 'step-3',
          name: 'Publish scene',
          agentMode: 'custom',
          prompt: 'Publish the scene',
          inputSource: 'outline',
          checkpoint: 'approve',
          enabled: true,
        },
      ],
    })
    const failedExecution: WorkflowExecution = {
      id: 'execution-state-matrix',
      workflowId: workflow.id,
      chapterId: '',
      status: 'failed',
      currentStepIndex: 1,
      stepResults: [
        {
          stepIndex: 0,
          input: 'seed',
          output: 'Draft completed',
          status: 'completed',
          timestamp: '2026-06-03T00:00:00.000Z',
        },
        {
          stepIndex: 1,
          input: 'draft',
          output: 'Review failed',
          status: 'failed',
          timestamp: '2026-06-03T00:01:00.000Z',
        },
      ],
      startedAt: '2026-06-03T00:00:00.000Z',
      completedAt: null,
    }

    workflowStoreState.workflows = [workflow]
    workflowStoreState.startExecution = vi.fn(async () => {
      workflowStoreState.activeExecution = failedExecution
    })

    const { container } = render(<WorkflowEditorPanel onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Step progress pipeline')).toBeInTheDocument()
    })

    expect(screen.getByText('Review failed')).toBeInTheDocument()
    expect(screen.getByText('Publish scene')).toBeInTheDocument()
    expect(container.querySelector('.bg-red-500.border-red-400')).toBeTruthy()
    expect(container.querySelector('.border-transparent.opacity-40')).toBeTruthy()
  })
})
