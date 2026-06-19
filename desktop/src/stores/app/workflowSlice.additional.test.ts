import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Workflow, WorkflowExecution } from '../../types/workflow'

import { createWorkflowSlice, type WorkflowSlice } from './workflowSlice'

type SetFn = Parameters<typeof createWorkflowSlice>[0]

function createStore(): WorkflowSlice {
  const state: WorkflowSlice = {
    workflows: [],
    activeExecution: null,
    workflowsLoading: false,
    workflowsError: null,
    fetchWorkflows: async () => {},
    saveWorkflow: async () => {},
    deleteWorkflow: async () => {},
    startExecution: async () => {},
    approveStep: async () => {},
    rejectStep: () => {},
  }

  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(state as never) : partial
    Object.assign(state, next)
  }
  const get = () => state

  const slice = createWorkflowSlice(set as never, get as never, {} as never)
  Object.assign(state, slice)
  return state
}

const mockFetchWorkflows = vi.fn()
const mockSaveWorkflow = vi.fn()
const mockDeleteWorkflow = vi.fn()
const mockExecuteWorkflow = vi.fn()
const mockApproveStep = vi.fn()
const mockRejectStep = vi.fn()

vi.mock('../../services/workflowService', () => ({
  loadWorkflows: (...args: unknown[]) => mockFetchWorkflows(...args),
  saveWorkflow: (...args: unknown[]) => mockSaveWorkflow(...args),
  deleteWorkflow: (...args: unknown[]) => mockDeleteWorkflow(...args),
  executeWorkflow: (...args: unknown[]) => mockExecuteWorkflow(...args),
  approveStep: (...args: unknown[]) => mockApproveStep(...args),
  rejectStep: (...args: unknown[]) => mockRejectStep(...args),
}))

const workflowFixture: Workflow = {
  id: 'workflow-1',
  name: 'Workflow 1',
  description: '',
  steps: [],
  isBuiltin: true,
  createdAt: '',
  updatedAt: '',
}

const executionFixture: WorkflowExecution = {
  id: 'execution-1',
  workflowId: 'workflow-1',
  chapterId: 'chapter-1',
  status: 'paused',
  currentStepIndex: 0,
  stepResults: [],
  startedAt: '',
  completedAt: null,
}

const noInput = () => ''

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchWorkflows.mockResolvedValue([workflowFixture])
})

describe('workflowSlice additional coverage', () => {
  it('uses fallback messages for non-Error failures', async () => {
    const store = createStore()

    mockFetchWorkflows.mockRejectedValueOnce('load failed')
    await store.fetchWorkflows()
    expect(store.workflowsError).toBe('Failed to load workflows')

    mockSaveWorkflow.mockRejectedValueOnce({ reason: 'save failed' })
    await store.saveWorkflow(workflowFixture)
    expect(store.workflowsError).toBe('Failed to save workflow')

    mockDeleteWorkflow.mockRejectedValueOnce(false)
    await store.deleteWorkflow(workflowFixture.id)
    expect(store.workflowsError).toBe('Failed to delete workflow')

    mockExecuteWorkflow.mockRejectedValueOnce(42)
    await store.startExecution(workflowFixture.id, 'chapter-1', noInput, noInput, noInput)
    expect(store.workflowsError).toBe('Failed to start execution')
  })

  it('clears stale errors before starting execution and uses fallback approval errors', async () => {
    const store = createStore()
    store.workflowsError = 'stale error'
    store.activeExecution = executionFixture

    mockExecuteWorkflow.mockResolvedValueOnce({
      ...executionFixture,
      status: 'running',
    })
    await store.startExecution(workflowFixture.id, executionFixture.chapterId, noInput, noInput, noInput)

    expect(store.workflowsError).toBeNull()
    expect(store.activeExecution?.status).toBe('running')

    mockApproveStep.mockRejectedValueOnce('approve failed')
    await store.approveStep(noInput, noInput, noInput)

    expect(store.workflowsError).toBe('Failed to approve step')
  })

  it('surfaces approve-step Error messages verbatim', async () => {
    const store = createStore()
    store.activeExecution = executionFixture

    mockApproveStep.mockRejectedValueOnce(new Error('approve exploded'))
    await store.approveStep(noInput, noInput, noInput)

    expect(store.workflowsError).toBe('approve exploded')
  })

  it('passes modified output through the approval flow', async () => {
    const store = createStore()
    store.activeExecution = executionFixture
    mockApproveStep.mockResolvedValueOnce({
      ...executionFixture,
      status: 'completed',
      currentStepIndex: 1,
    })

    await store.approveStep(noInput, noInput, noInput, 'edited output')

    expect(mockApproveStep).toHaveBeenCalledWith(
      executionFixture,
      noInput,
      noInput,
      noInput,
      'edited output',
    )
    expect(store.activeExecution?.currentStepIndex).toBe(1)
  })
})
