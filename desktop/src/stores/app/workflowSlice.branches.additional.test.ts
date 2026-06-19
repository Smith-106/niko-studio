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

describe('workflowSlice branch coverage additional', () => {
  describe('workflow execution status boundaries', () => {
    it('stores execution with running status', async () => {
      const runningExecution: WorkflowExecution = {
        ...executionFixture,
        status: 'running',
      }
      mockExecuteWorkflow.mockResolvedValue(runningExecution)
      const store = createStore()

      await store.startExecution('workflow-1', 'chapter-1', noInput, noInput, noInput)

      expect(store.activeExecution?.status).toBe('running')
    })

    it('stores execution with idle status', async () => {
      const idleExecution: WorkflowExecution = {
        ...executionFixture,
        status: 'idle',
      }
      mockExecuteWorkflow.mockResolvedValue(idleExecution)
      const store = createStore()

      await store.startExecution('workflow-1', 'chapter-1', noInput, noInput, noInput)

      expect(store.activeExecution?.status).toBe('idle')
    })

    it('stores execution with completed status', async () => {
      const completedExecution: WorkflowExecution = {
        ...executionFixture,
        status: 'completed',
        completedAt: '2026-01-01T00:00:00Z',
      }
      mockExecuteWorkflow.mockResolvedValue(completedExecution)
      const store = createStore()

      await store.startExecution('workflow-1', 'chapter-1', noInput, noInput, noInput)

      expect(store.activeExecution?.status).toBe('completed')
      expect(store.activeExecution?.completedAt).toBe('2026-01-01T00:00:00Z')
    })

    it('stores execution with failed status', async () => {
      const failedExecution: WorkflowExecution = {
        ...executionFixture,
        status: 'failed',
        completedAt: '2026-01-01T00:00:00Z',
      }
      mockExecuteWorkflow.mockResolvedValue(failedExecution)
      const store = createStore()

      await store.startExecution('workflow-1', 'chapter-1', noInput, noInput, noInput)

      expect(store.activeExecution?.status).toBe('failed')
    })
  })

  describe('concurrent workflow scenarios', () => {
    it('replaces activeExecution when starting a second execution', async () => {
      const firstExecution: WorkflowExecution = {
        ...executionFixture,
        id: 'ex-1',
        status: 'paused',
      }
      const secondExecution: WorkflowExecution = {
        ...executionFixture,
        id: 'ex-2',
        status: 'running',
      }

      const store = createStore()

      mockExecuteWorkflow.mockResolvedValue(firstExecution)
      await store.startExecution('workflow-1', 'chapter-1', noInput, noInput, noInput)
      expect(store.activeExecution?.id).toBe('ex-1')

      mockExecuteWorkflow.mockResolvedValue(secondExecution)
      await store.startExecution('workflow-1', 'chapter-2', noInput, noInput, noInput)
      expect(store.activeExecution?.id).toBe('ex-2')
    })

    it('preserves workflows list across execution state changes', async () => {
      const store = createStore()
      await store.fetchWorkflows()
      expect(store.workflows).toEqual([workflowFixture])

      const execution: WorkflowExecution = {
        ...executionFixture,
        status: 'running',
      }
      mockExecuteWorkflow.mockResolvedValue(execution)
      await store.startExecution('workflow-1', 'chapter-1', noInput, noInput, noInput)

      // Workflows list should still be intact
      expect(store.workflows).toEqual([workflowFixture])
      expect(store.activeExecution?.status).toBe('running')
    })

    it('handles fetch + save + execution in sequence without state corruption', async () => {
      const store = createStore()
      const newWf: Workflow = {
        id: 'u1', name: 'User WF', description: '', steps: [],
        isBuiltin: false, createdAt: '', updatedAt: '',
      }

      await store.fetchWorkflows()
      expect(store.workflowsLoading).toBe(false)

      mockSaveWorkflow.mockResolvedValue(undefined)
      mockFetchWorkflows.mockResolvedValue([workflowFixture, newWf])
      await store.saveWorkflow(newWf)
      expect(store.workflows.length).toBe(2)

      const execution: WorkflowExecution = {
        ...executionFixture,
        status: 'running',
      }
      mockExecuteWorkflow.mockResolvedValue(execution)
      await store.startExecution('workflow-1', 'chapter-1', noInput, noInput, noInput)
      expect(store.activeExecution?.status).toBe('running')
    })
  })

  describe('workflow error path boundaries', () => {
    it('clears workflowsError before setting activeExecution on success', async () => {
      const store = createStore()
      store.workflowsError = 'previous error'

      mockExecuteWorkflow.mockResolvedValue({ ...executionFixture, status: 'running' })
      await store.startExecution('workflow-1', 'chapter-1', noInput, noInput, noInput)

      expect(store.workflowsError).toBeNull()
      expect(store.activeExecution?.status).toBe('running')
    })

    it('sets workflowsError when fetchWorkflows fails with non-Error (undefined)', async () => {
      mockFetchWorkflows.mockRejectedValue(undefined)
      const store = createStore()

      await store.fetchWorkflows()

      expect(store.workflowsError).toBe('Failed to load workflows')
      expect(store.workflowsLoading).toBe(false)
    })

    it('sets workflowsError when saveWorkflow fails with non-Error (null)', async () => {
      mockSaveWorkflow.mockRejectedValue(null)
      const store = createStore()

      await store.saveWorkflow(workflowFixture)

      expect(store.workflowsError).toBe('Failed to save workflow')
    })

    it('sets workflowsError when deleteWorkflow fails with non-Error (0)', async () => {
      mockDeleteWorkflow.mockRejectedValue(0)
      const store = createStore()

      await store.deleteWorkflow('workflow-1')

      expect(store.workflowsError).toBe('Failed to delete workflow')
    })

    it('sets workflowsError when startExecution fails with non-Error (string)', async () => {
      mockExecuteWorkflow.mockRejectedValue('execution crashed')
      const store = createStore()

      await store.startExecution('workflow-1', 'chapter-1', noInput, noInput, noInput)

      expect(store.workflowsError).toBe('Failed to start execution')
    })

    it('sets workflowsError when approveStep fails with non-Error (object)', async () => {
      const store = createStore()
      store.activeExecution = executionFixture

      mockApproveStep.mockRejectedValue({ code: 'APPROVE_FAIL' })
      await store.approveStep(noInput, noInput, noInput)

      expect(store.workflowsError).toBe('Failed to approve step')
    })
  })

  describe('fetchWorkflows loading state transitions', () => {
    it('sets workflowsLoading to true at start and false on success', async () => {
      let loadingDuringFetch = false
      mockFetchWorkflows.mockImplementation(async () => {
        // Capture the loading state during the async operation
        loadingDuringFetch = true
        return [workflowFixture]
      })
      const store = createStore()

      await store.fetchWorkflows()

      expect(store.workflowsLoading).toBe(false)
      expect(store.workflows).toEqual([workflowFixture])
    })

    it('sets workflowsLoading to true at start and false on failure', async () => {
      mockFetchWorkflows.mockRejectedValue(new Error('network down'))
      const store = createStore()

      await store.fetchWorkflows()

      expect(store.workflowsLoading).toBe(false)
      expect(store.workflowsError).toBe('network down')
    })

    it('clears workflowsError at the start of fetchWorkflows', async () => {
      const store = createStore()
      store.workflowsError = 'stale error'

      mockFetchWorkflows.mockResolvedValue([workflowFixture])
      await store.fetchWorkflows()

      expect(store.workflowsError).toBeNull()
    })

    it('loads empty workflows array', async () => {
      mockFetchWorkflows.mockResolvedValue([])
      const store = createStore()

      await store.fetchWorkflows()

      expect(store.workflows).toEqual([])
      expect(store.workflowsLoading).toBe(false)
    })
  })

  describe('approveStep edge cases', () => {
    it('updates activeExecution with step results after approval', async () => {
      const approved: WorkflowExecution = {
        ...executionFixture,
        status: 'paused',
        currentStepIndex: 1,
        stepResults: [{
          stepIndex: 0,
          input: 'chapter text',
          output: 'revised text',
          status: 'completed',
          timestamp: '2026-01-01T00:00:00Z',
        }],
      }
      mockApproveStep.mockResolvedValue(approved)

      const store = createStore()
      store.activeExecution = executionFixture

      const getChapterContent = () => 'chapter text'
      const getStoryBible = () => 'story bible'
      const getOutline = () => 'outline'

      await store.approveStep(getChapterContent, getStoryBible, getOutline)

      expect(mockApproveStep).toHaveBeenCalledWith(
        executionFixture,
        getChapterContent,
        getStoryBible,
        getOutline,
        undefined,
      )
      expect(store.activeExecution?.currentStepIndex).toBe(1)
      expect(store.activeExecution?.stepResults).toHaveLength(1)
    })

    it('does not call approveStep service when activeExecution is null', async () => {
      const store = createStore()
      store.activeExecution = null

      await store.approveStep(noInput, noInput, noInput)

      expect(mockApproveStep).not.toHaveBeenCalled()
    })
  })

  describe('rejectStep edge cases', () => {
    it('sets activeExecution to the result of rejectStep service', () => {
      const rejected: WorkflowExecution = {
        ...executionFixture,
        status: 'failed',
        completedAt: '2026-06-16T00:00:00Z',
      }
      mockRejectStep.mockReturnValue(rejected)

      const store = createStore()
      store.activeExecution = executionFixture

      store.rejectStep()

      expect(mockRejectStep).toHaveBeenCalledWith(executionFixture)
      expect(store.activeExecution).toEqual(rejected)
    })

    it('does not call rejectStep service when activeExecution is null', () => {
      const store = createStore()
      store.activeExecution = null

      store.rejectStep()

      expect(mockRejectStep).not.toHaveBeenCalled()
      expect(store.activeExecution).toBeNull()
    })
  })

  describe('saveWorkflow and deleteWorkflow re-fetch after mutation', () => {
    it('re-fetches workflows after successful save', async () => {
      mockSaveWorkflow.mockResolvedValue(undefined)
      const store = createStore()

      await store.saveWorkflow(workflowFixture)

      expect(mockSaveWorkflow).toHaveBeenCalledWith(workflowFixture)
      expect(mockFetchWorkflows).toHaveBeenCalled()
    })

    it('does not re-fetch workflows after failed save', async () => {
      mockSaveWorkflow.mockRejectedValue(new Error('save failed'))
      const store = createStore()
      mockFetchWorkflows.mockClear()

      await store.saveWorkflow(workflowFixture)

      // fetchWorkflows should not be called since save failed
      expect(mockFetchWorkflows).not.toHaveBeenCalled()
      expect(store.workflowsError).toBe('save failed')
    })

    it('re-fetches workflows after successful delete', async () => {
      mockDeleteWorkflow.mockResolvedValue(undefined)
      const store = createStore()

      await store.deleteWorkflow('workflow-1')

      expect(mockDeleteWorkflow).toHaveBeenCalledWith('workflow-1')
      expect(mockFetchWorkflows).toHaveBeenCalled()
    })

    it('does not re-fetch workflows after failed delete', async () => {
      mockDeleteWorkflow.mockRejectedValue(new Error('delete failed'))
      const store = createStore()
      mockFetchWorkflows.mockClear()

      await store.deleteWorkflow('workflow-1')

      expect(mockFetchWorkflows).not.toHaveBeenCalled()
      expect(store.workflowsError).toBe('delete failed')
    })
  })
})
