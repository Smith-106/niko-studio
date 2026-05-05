import type { AppSlice } from '../appStore'
import type { Workflow, WorkflowExecution } from '../../types/workflow'
import {
  loadWorkflows as fetchWorkflows,
  saveWorkflow as persistWorkflow,
  deleteWorkflow as removeWorkflow,
  executeWorkflow,
  approveStep,
  rejectStep,
} from '../../services/workflowService'

export interface WorkflowSlice {
  workflows: Workflow[]
  activeExecution: WorkflowExecution | null
  workflowsLoading: boolean
  workflowsError: string | null

  fetchWorkflows: () => Promise<void>
  saveWorkflow: (workflow: Workflow) => Promise<void>
  deleteWorkflow: (id: string) => Promise<void>
  startExecution: (
    workflowId: string,
    chapterId: string,
    getChapterContent: () => string,
    getStoryBible: () => string,
    getOutline: () => string,
  ) => Promise<void>
  approveStep: (getChapterContent: () => string, getStoryBible: () => string, getOutline: () => string, modifiedOutput?: string) => Promise<void>
  rejectStep: () => void
}

export const createWorkflowSlice: AppSlice<WorkflowSlice> = (set, get) => ({
  workflows: [],
  activeExecution: null,
  workflowsLoading: false,
  workflowsError: null,

  fetchWorkflows: async () => {
    set({ workflowsLoading: true, workflowsError: null })
    try {
      const workflows = await fetchWorkflows()
      set({ workflows, workflowsLoading: false })
    } catch (err) {
      set({
        workflowsError: err instanceof Error ? err.message : 'Failed to load workflows',
        workflowsLoading: false,
      })
    }
  },

  saveWorkflow: async (workflow) => {
    try {
      await persistWorkflow(workflow)
      await get().fetchWorkflows()
    } catch (err) {
      set({
        workflowsError: err instanceof Error ? err.message : 'Failed to save workflow',
      })
    }
  },

  deleteWorkflow: async (id) => {
    try {
      await removeWorkflow(id)
      await get().fetchWorkflows()
    } catch (err) {
      set({
        workflowsError: err instanceof Error ? err.message : 'Failed to delete workflow',
      })
    }
  },

  startExecution: async (workflowId, chapterId, getChapterContent, getStoryBible, getOutline) => {
    set({ workflowsError: null })
    try {
      const execution = await executeWorkflow(
        workflowId,
        chapterId,
        getChapterContent,
        getStoryBible,
        getOutline,
      )
      set({ activeExecution: execution })
    } catch (err) {
      set({
        workflowsError: err instanceof Error ? err.message : 'Failed to start execution',
      })
    }
  },

  approveStep: async (getChapterContent, getStoryBible, getOutline, modifiedOutput) => {
    const { activeExecution } = get()
    if (!activeExecution) return

    try {
      const updated = await approveStep(
        activeExecution,
        getChapterContent,
        getStoryBible,
        getOutline,
        modifiedOutput,
      )
      set({ activeExecution: updated })
    } catch (err) {
      set({
        workflowsError: err instanceof Error ? err.message : 'Failed to approve step',
      })
    }
  },

  rejectStep: () => {
    const { activeExecution } = get()
    if (!activeExecution) return
    set({ activeExecution: rejectStep(activeExecution) })
  },
})
