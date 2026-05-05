import { describe, expect, it, vi, beforeEach } from 'vitest'
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
    const next = typeof partial === 'function' ? partial(state) : partial
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

const builtinWf: Workflow = {
  id: 'builtin-test', name: 'Test', description: '', steps: [],
  isBuiltin: true, createdAt: '', updatedAt: '',
}

const noInput = () => ''

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchWorkflows.mockResolvedValue([builtinWf])
})

describe('workflowSlice', () => {
  describe('fetchWorkflows', () => {
    it('loads workflows into state', async () => {
      const store = createStore()
      await store.fetchWorkflows()

      expect(store.workflows).toEqual([builtinWf])
      expect(store.workflowsLoading).toBe(false)
    })

    it('sets error on failure', async () => {
      mockFetchWorkflows.mockRejectedValue(new Error('fs error'))
      const store = createStore()

      await store.fetchWorkflows()

      expect(store.workflowsError).toBe('fs error')
      expect(store.workflowsLoading).toBe(false)
    })
  })

  describe('saveWorkflow', () => {
    it('persists and reloads workflows', async () => {
      mockSaveWorkflow.mockResolvedValue(undefined)
      const store = createStore()
      await store.fetchWorkflows()

      const newWf: Workflow = {
        id: 'u1', name: 'User WF', description: '', steps: [],
        isBuiltin: false, createdAt: '', updatedAt: '',
      }
      mockFetchWorkflows.mockResolvedValue([builtinWf, newWf])

      await store.saveWorkflow(newWf)

      expect(mockSaveWorkflow).toHaveBeenCalledWith(newWf)
      expect(store.workflows.length).toBe(2)
    })

    it('sets error on save failure', async () => {
      mockSaveWorkflow.mockRejectedValue(new Error('write failed'))
      const store = createStore()

      await store.saveWorkflow(builtinWf)

      expect(store.workflowsError).toBe('write failed')
    })
  })

  describe('deleteWorkflow', () => {
    it('deletes and reloads workflows', async () => {
      mockDeleteWorkflow.mockResolvedValue(undefined)
      const store = createStore()
      await store.fetchWorkflows()

      mockFetchWorkflows.mockResolvedValue([])
      await store.deleteWorkflow('u1')

      expect(mockDeleteWorkflow).toHaveBeenCalledWith('u1')
      expect(store.workflows).toEqual([])
    })

    it('sets error on delete failure', async () => {
      mockDeleteWorkflow.mockRejectedValue(new Error('delete failed'))
      const store = createStore()

      await store.deleteWorkflow('u1')

      expect(store.workflowsError).toBe('delete failed')
    })
  })

  describe('startExecution', () => {
    it('sets activeExecution in state', async () => {
      const execution: WorkflowExecution = {
        id: 'ex1', workflowId: 'builtin-test', chapterId: '', status: 'running',
        currentStepIndex: 0, stepResults: [], startedAt: '', completedAt: null,
      }
      mockExecuteWorkflow.mockResolvedValue(execution)
      const store = createStore()

      await store.startExecution('builtin-test', '', noInput, noInput, noInput)

      expect(store.activeExecution).toEqual(execution)
    })

    it('sets error on execution failure', async () => {
      mockExecuteWorkflow.mockRejectedValue(new Error('exec failed'))
      const store = createStore()

      await store.startExecution('builtin-test', '', noInput, noInput, noInput)

      expect(store.workflowsError).toBe('exec failed')
    })
  })

  describe('approveStep', () => {
    it('updates activeExecution with approved result', async () => {
      const initial: WorkflowExecution = {
        id: 'ex1', workflowId: 'builtin-test', chapterId: '', status: 'paused',
        currentStepIndex: 0, stepResults: [], startedAt: '', completedAt: null,
      }
      const advanced: WorkflowExecution = {
        ...initial, status: 'completed', currentStepIndex: 1, stepResults: [{ stepIndex: 0, input: '', output: 'done', status: 'completed', timestamp: '' }],
      }
      mockApproveStep.mockResolvedValue(advanced)

      const store = createStore()
      // Set activeExecution manually
      store.activeExecution = initial

      await store.approveStep(noInput, noInput, noInput)

      expect(store.activeExecution!.status).toBe('completed')
    })

    it('does nothing when no activeExecution', async () => {
      const store = createStore()
      await store.approveStep(noInput, noInput, noInput)
      expect(mockApproveStep).not.toHaveBeenCalled()
    })
  })

  describe('rejectStep', () => {
    it('clears activeExecution via rejectStep service', () => {
      mockRejectStep.mockReturnValue({ status: 'failed', completedAt: 'now' })

      const store = createStore()
      store.activeExecution = {
        id: 'ex1', workflowId: 'w1', chapterId: '', status: 'paused',
        currentStepIndex: 0, stepResults: [], startedAt: '', completedAt: null,
      }

      store.rejectStep()

      expect(store.activeExecution!.status).toBe('failed')
    })

    it('does nothing when no activeExecution', () => {
      const store = createStore()
      store.rejectStep()
      expect(mockRejectStep).not.toHaveBeenCalled()
    })
  })
})
