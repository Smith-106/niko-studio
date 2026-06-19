import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => mockFs)

const mockAgentWrite = vi.hoisted(() => vi.fn())
const mockCallAnalysisAgent = vi.hoisted(() => vi.fn())

vi.mock('../api/agents', () => ({
  agentWrite: (...args: unknown[]) => mockAgentWrite(...args),
}))

vi.mock('../api/intelligence', () => ({
  callAnalysisAgent: (...args: unknown[]) => mockCallAnalysisAgent(...args),
}))

import { executeWorkflow } from './workflowService'

const noInput = () => ''

beforeEach(() => {
  vi.clearAllMocks()
  mockFs.exists.mockResolvedValue(false)
  mockAgentWrite.mockResolvedValue({ data: { content: 'writer output' } })
  mockCallAnalysisAgent.mockResolvedValue({ data: { summary: 'analysis output' } })
})

describe('workflowService additional coverage', () => {
  it('falls back to JSON output when analysis data is missing', async () => {
    const wf = {
      id: 'analysis-empty-data',
      name: 'Analysis Empty',
      description: '',
      steps: [
        {
          id: 's1',
          name: 'Analyze',
          agentMode: 'analysis' as const,
          prompt: 'analyze',
          inputSource: 'chapter_content' as const,
          checkpoint: 'none' as const,
          enabled: true,
        },
      ],
      isBuiltin: false,
      createdAt: '',
      updatedAt: '',
    }

    mockFs.readTextFile.mockResolvedValue(JSON.stringify(wf))
    mockCallAnalysisAgent.mockResolvedValueOnce({})

    const execution = await executeWorkflow('analysis-empty-data', '', () => 'chapter', noInput, noInput)

    expect(execution.status).toBe('completed')
    expect(execution.stepResults[0]?.output).toBe('{}')
  })

  it('uses empty input for missing previous steps and unknown input sources', async () => {
    const previousStepWorkflow = {
      id: 'previous-step-first',
      name: 'Previous Step First',
      description: '',
      steps: [
        {
          id: 's1',
          name: 'Draft',
          agentMode: 'writing' as const,
          prompt: 'draft',
          inputSource: 'previous_step' as const,
          checkpoint: 'none' as const,
          enabled: true,
        },
      ],
      isBuiltin: false,
      createdAt: '',
      updatedAt: '',
    }
    mockFs.readTextFile.mockResolvedValueOnce(JSON.stringify(previousStepWorkflow))

    const previousStepExecution = await executeWorkflow(
      'previous-step-first',
      '',
      () => 'chapter',
      () => 'story bible',
      () => 'outline',
    )

    expect(previousStepExecution.stepResults[0]?.input).toBe('')

    const unknownInputWorkflow = {
      ...previousStepWorkflow,
      id: 'unknown-input',
      steps: [
        {
          ...previousStepWorkflow.steps[0],
          inputSource: 'mystery_source',
        },
      ],
    }
    mockFs.readTextFile.mockResolvedValueOnce(JSON.stringify(unknownInputWorkflow))

    const unknownInputExecution = await executeWorkflow(
      'unknown-input',
      '',
      () => 'chapter',
      () => 'story bible',
      () => 'outline',
    )

    expect(unknownInputExecution.stepResults[0]?.input).toBe('')
  })

  it('records Error messages when a step rejects with an Error instance', async () => {
    const wf = {
      id: 'error-message-step',
      name: 'Error Message',
      description: '',
      steps: [
        {
          id: 's1',
          name: 'Draft',
          agentMode: 'writing' as const,
          prompt: 'draft',
          inputSource: 'chapter_content' as const,
          checkpoint: 'none' as const,
          enabled: true,
        },
      ],
      isBuiltin: false,
      createdAt: '',
      updatedAt: '',
    }

    mockFs.readTextFile.mockResolvedValue(JSON.stringify(wf))
    mockAgentWrite.mockRejectedValueOnce(new Error('kaboom'))

    const execution = await executeWorkflow('error-message-step', '', () => 'chapter', noInput, noInput)

    expect(execution.status).toBe('failed')
    expect(execution.stepResults[0]?.output).toBe('kaboom')
  })
})
