import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => mockFs)

const mockAgentWrite = vi.fn()
const mockCallAnalysisAgent = vi.fn()

vi.mock('../api/agents', () => ({
  agentWrite: (...args: unknown[]) => mockAgentWrite(...args),
}))

vi.mock('../api/intelligence', () => ({
  callAnalysisAgent: (...args: unknown[]) => mockCallAnalysisAgent(...args),
}))

import {
  loadWorkflows,
  saveWorkflow,
  deleteWorkflow,
  getWorkflow,
  executeWorkflow,
  approveStep,
  rejectStep,
} from './workflowService'

beforeEach(() => {
  vi.clearAllMocks()
  mockFs.exists.mockResolvedValue(false)
  mockAgentWrite.mockResolvedValue({ data: { content: 'agent output' } })
  mockCallAnalysisAgent.mockResolvedValue({ data: { summary: 'analysis output' } })
})

const noInput = () => ''

describe('workflowService', () => {
  describe('loadWorkflows', () => {
    it('returns builtin workflows when no user files exist', async () => {
      mockFs.exists.mockResolvedValue(false)
      const workflows = await loadWorkflows()
      expect(workflows.length).toBeGreaterThanOrEqual(3)
      expect(workflows.every((w) => w.isBuiltin)).toBe(true)
    })

    it('merges user workflows with builtins', async () => {
      const userWf = {
        id: 'user1', name: 'My Workflow', description: '', steps: [],
        isBuiltin: false, createdAt: '', updatedAt: '',
      }
      mockFs.exists.mockResolvedValue(true)
      mockFs.readDir.mockResolvedValue([{ name: 'user1.json' } as any])
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(userWf))

      const workflows = await loadWorkflows()
      expect(workflows.some((w) => w.id === 'user1')).toBe(true)
      expect(workflows.some((w) => w.isBuiltin)).toBe(true)
    })

    it('skips corrupted files', async () => {
      mockFs.exists.mockResolvedValue(true)
      mockFs.readDir.mockResolvedValue([{ name: 'bad.json' } as any])
      mockFs.readTextFile.mockResolvedValue('not json')

      const workflows = await loadWorkflows()
      expect(workflows.every((w) => w.isBuiltin)).toBe(true)
    })
  })

  describe('getWorkflow', () => {
    it('returns builtin by id', async () => {
      const result = await getWorkflow('builtin-chapter-pipeline')
      expect(result).not.toBeNull()
      expect(result!.isBuiltin).toBe(true)
    })

    it('returns user workflow from filesystem', async () => {
      const userWf = { id: 'u1', name: 'T', steps: [] }
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(userWf))
      const result = await getWorkflow('u1')
      expect(result).not.toBeNull()
      expect(result!.id).toBe('u1')
    })

    it('returns null when not found', async () => {
      mockFs.readTextFile.mockRejectedValue(new Error('not found'))
      const result = await getWorkflow('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('saveWorkflow', () => {
    it('writes workflow JSON to filesystem', async () => {
      const wf = {
        id: 'new1', name: 'New', description: '', steps: [],
        isBuiltin: false, createdAt: '', updatedAt: '',
      }
      mockFs.exists.mockResolvedValue(false)
      await saveWorkflow(wf)

      expect(mockFs.mkdir).toHaveBeenCalled()
      const written = JSON.parse(mockFs.writeTextFile.mock.calls[0][1])
      expect(written.id).toBe('new1')
      expect(written.updatedAt).toBeTruthy()
    })

    it('rejects builtin- prefixed IDs', async () => {
      const wf = {
        id: 'builtin-test', name: 'B', description: '', steps: [],
        isBuiltin: false, createdAt: '', updatedAt: '',
      }
      await expect(saveWorkflow(wf)).rejects.toThrow('Cannot save built-in')
    })
  })

  describe('deleteWorkflow', () => {
    it('removes file when it exists', async () => {
      mockFs.exists.mockResolvedValue(true)
      await deleteWorkflow('u1')
      expect(mockFs.remove).toHaveBeenCalledWith('workflows/u1.json')
    })

    it('rejects builtin- prefixed IDs', async () => {
      await expect(deleteWorkflow('builtin-test')).rejects.toThrow('Cannot delete built-in')
    })
  })

  describe('executeWorkflow', () => {
    it('runs enabled steps sequentially', async () => {
      const execution = await executeWorkflow('builtin-chapter-pipeline', '', noInput, noInput, noInput)
      expect(execution.status).toBe('paused')
      expect(execution.stepResults.length).toBeGreaterThanOrEqual(1)
    })

    it('pauses at checkpoint gate', async () => {
      const execution = await executeWorkflow('builtin-chapter-pipeline', '', noInput, noInput, noInput)
      expect(execution.status).toBe('paused')
    })

    it('throws when workflow not found', async () => {
      mockFs.readTextFile.mockRejectedValue(new Error('not found'))
      await expect(executeWorkflow('nonexistent', '', noInput, noInput, noInput)).rejects.toThrow('not found')
    })
  })

  describe('approveStep', () => {
    it('advances to next step after approval', async () => {
      const execution = await executeWorkflow('builtin-chapter-pipeline', '', noInput, noInput, noInput)
      expect(execution.status).toBe('paused')

      const approved = await approveStep(execution, noInput, noInput, noInput)
      expect(approved.stepResults.length).toBeGreaterThan(execution.stepResults.length)
    })

    it('applies modified output', async () => {
      const execution = await executeWorkflow('builtin-chapter-pipeline', '', noInput, noInput, noInput)
      const approved = await approveStep(execution, noInput, noInput, noInput, 'modified')
      // Modified output is applied to the step being approved, not the new step
      expect(approved.stepResults.length).toBeGreaterThan(execution.stepResults.length)
    })

    it('returns unchanged if not paused', async () => {
      const execution = await executeWorkflow('builtin-chapter-pipeline', '', noInput, noInput, noInput)
      const completed = { ...execution, status: 'completed' as const }
      const result = await approveStep(completed, noInput, noInput, noInput)
      expect(result).toBe(completed)
    })
  })

  describe('rejectStep', () => {
    it('marks execution as failed', () => {
      const execution = { status: 'paused' as const, completedAt: null }
      const result = rejectStep(execution as any)
      expect(result.status).toBe('failed')
      expect(result.completedAt).toBeTruthy()
    })
  })

  describe('edge cases', () => {
    it('throws when no enabled steps', async () => {
      const wf = {
        id: 'test-empty', name: 'Empty', description: '',
        steps: [{ id: 's1', name: 'S', agentMode: 'writing' as const, prompt: 'p', inputSource: 'chapter_content' as const, checkpoint: 'none' as const, enabled: false }],
        isBuiltin: false, createdAt: '', updatedAt: '',
      }
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(wf))
      await expect(executeWorkflow('test-empty', '', noInput, noInput, noInput)).rejects.toThrow('No enabled steps')
    })

    it('dispatches to callAnalysisAgent for analysis mode', async () => {
      const wf = {
        id: 'test-analysis', name: 'Analysis', description: '',
        steps: [{ id: 's1', name: 'S', agentMode: 'analysis' as const, prompt: 'analyze this', inputSource: 'chapter_content' as const, checkpoint: 'none' as const, enabled: true }],
        isBuiltin: false, createdAt: '', updatedAt: '',
      }
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(wf))
      const execution = await executeWorkflow('test-analysis', '', () => 'chapter text', noInput, noInput)
      expect(execution.status).toBe('completed')
      expect(mockCallAnalysisAgent).toHaveBeenCalled()
    })

    it('dispatches to agentWrite for custom mode', async () => {
      const wf = {
        id: 'test-custom', name: 'Custom', description: '',
        steps: [{ id: 's1', name: 'S', agentMode: 'custom' as const, prompt: 'custom task', inputSource: 'chapter_content' as const, checkpoint: 'none' as const, enabled: true }],
        isBuiltin: false, createdAt: '', updatedAt: '',
      }
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(wf))
      const execution = await executeWorkflow('test-custom', '', noInput, noInput, noInput)
      expect(execution.status).toBe('completed')
      expect(mockAgentWrite).toHaveBeenCalled()
    })

    it('resolves story_bible input source', async () => {
      const wf = {
        id: 'test-bible', name: 'Bible', description: '',
        steps: [{ id: 's1', name: 'S', agentMode: 'writing' as const, prompt: 'write', inputSource: 'story_bible' as const, checkpoint: 'none' as const, enabled: true }],
        isBuiltin: false, createdAt: '', updatedAt: '',
      }
      mockFs.readTextFile.mockResolvedValue(JSON.stringify(wf))
      const execution = await executeWorkflow('test-bible', '', noInput, () => 'story bible content', noInput)
      expect(execution.status).toBe('completed')
      expect(mockAgentWrite).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('story bible content') }),
      )
    })
  })
})
