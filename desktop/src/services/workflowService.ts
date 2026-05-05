import { exists, mkdir, readDir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs'
import { agentWrite } from '../api/agents'
import { callAnalysisAgent } from '../api/intelligence'
import type {
  AgentMode,
  Workflow,
  WorkflowExecution,
  WorkflowStepResult,
} from '../types/workflow'

const WORKFLOWS_DIR = 'workflows'

async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) {
    await mkdir(path, { recursive: true })
  }
}

function workflowPath(id: string): string {
  return `${WORKFLOWS_DIR}/${id}.json`
}

async function loadUserWorkflows(): Promise<Workflow[]> {
  try {
    if (!(await exists(WORKFLOWS_DIR))) return []
    const entries = await readDir(WORKFLOWS_DIR)
    const workflows: Workflow[] = []
    for (const entry of entries) {
      if (entry.name.endsWith('.json') && !entry.name.startsWith('.')) {
        try {
          const raw = await readTextFile(`${WORKFLOWS_DIR}/${entry.name}`)
          workflows.push(JSON.parse(raw) as Workflow)
        } catch {
          // skip corrupted files
        }
      }
    }
    return workflows
  } catch {
    return []
  }
}

function callAgentForMode(mode: AgentMode, input: string): Promise<string> {
  switch (mode) {
    case 'writing':
    case 'custom':
      return agentWrite({ content: input }).then((r) => r.data?.content ?? '')
    case 'analysis':
    case 'evaluation':
      return callAnalysisAgent('consistency', input).then(
        (r) => (r.data?.summary as string) ?? JSON.stringify(r.data ?? {}),
      )
  }
}

export async function loadWorkflows(): Promise<Workflow[]> {
  const userWorkflows = await loadUserWorkflows()
  return [...BUILTIN_WORKFLOWS, ...userWorkflows]
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const builtin = BUILTIN_WORKFLOWS.find((w) => w.id === id)
  if (builtin) return builtin
  try {
    const raw = await readTextFile(workflowPath(id))
    return JSON.parse(raw) as Workflow
  } catch {
    return null
  }
}

export async function saveWorkflow(workflow: Workflow): Promise<void> {
  if (workflow.isBuiltin || workflow.id.startsWith('builtin-')) {
    throw new Error('Cannot save built-in workflows')
  }
  await ensureDir(WORKFLOWS_DIR)
  const now = new Date().toISOString()
  const toSave: Workflow = {
    ...workflow,
    isBuiltin: false,
    updatedAt: now,
    createdAt: workflow.createdAt || now,
  }
  await writeTextFile(workflowPath(toSave.id), JSON.stringify(toSave, null, 2))
}

export async function deleteWorkflow(id: string): Promise<void> {
  if (id.startsWith('builtin-')) {
    throw new Error('Cannot delete built-in workflows')
  }
  const path = workflowPath(id)
  if (await exists(path)) {
    await remove(path)
  }
}

export async function executeWorkflow(
  workflowId: string,
  chapterId: string,
  getChapterContent: () => string,
  getStoryBible: () => string,
  getOutline: () => string,
): Promise<WorkflowExecution> {
  const workflow = await getWorkflow(workflowId)
  if (!workflow) throw new Error(`Workflow not found: ${workflowId}`)

  const enabledSteps = workflow.steps.filter((s) => s.enabled)
  if (enabledSteps.length === 0) throw new Error('No enabled steps in workflow')

  const execution: WorkflowExecution = {
    id: crypto.randomUUID().slice(0, 8),
    workflowId,
    chapterId,
    status: 'running',
    currentStepIndex: 0,
    stepResults: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  }

  return runNextStep(execution, workflow, getChapterContent, getStoryBible, getOutline)
}

function resolveStepInput(
  _stepIndex: number,
  inputSource: string,
  stepResults: WorkflowStepResult[],
  getChapterContent: () => string,
  getStoryBible: () => string,
  getOutline: () => string,
): string {
  switch (inputSource) {
    case 'previous_step': {
      const prev = stepResults[stepResults.length - 1]
      return prev?.output ?? ''
    }
    case 'chapter_content':
      return getChapterContent()
    case 'story_bible':
      return getStoryBible()
    case 'outline':
      return getOutline()
    default:
      return ''
  }
}

async function runNextStep(
  execution: WorkflowExecution,
  workflow: Workflow,
  getChapterContent: () => string,
  getStoryBible: () => string,
  getOutline: () => string,
): Promise<WorkflowExecution> {
  const enabledSteps = workflow.steps.filter((s) => s.enabled)
  const stepIndex = execution.currentStepIndex

  if (stepIndex >= enabledSteps.length) {
    return {
      ...execution,
      status: 'completed',
      completedAt: new Date().toISOString(),
    }
  }

  const step = enabledSteps[stepIndex]
  const input = resolveStepInput(
    stepIndex,
    step.inputSource,
    execution.stepResults,
    getChapterContent,
    getStoryBible,
    getOutline,
  )

  try {
    const output = await callAgentForMode(step.agentMode, `${step.prompt}\n\n${input}`)
    const result: WorkflowStepResult = {
      stepIndex,
      input,
      output,
      status: 'completed',
      timestamp: new Date().toISOString(),
    }

    const updatedExecution: WorkflowExecution = {
      ...execution,
      stepResults: [...execution.stepResults, result],
    }

    if (step.checkpoint !== 'none') {
      return { ...updatedExecution, status: 'paused', currentStepIndex: stepIndex }
    }

    return runNextStep(
      { ...updatedExecution, currentStepIndex: stepIndex + 1, status: 'running' },
      workflow,
      getChapterContent,
      getStoryBible,
      getOutline,
    )
  } catch (err) {
    return {
      ...execution,
      status: 'failed',
      stepResults: [
        ...execution.stepResults,
        {
          stepIndex,
          input,
          output: err instanceof Error ? err.message : 'Step failed',
          status: 'failed',
          timestamp: new Date().toISOString(),
        },
      ],
    }
  }
}

export async function approveStep(
  execution: WorkflowExecution,
  getChapterContent: () => string,
  getStoryBible: () => string,
  getOutline: () => string,
  modifiedOutput?: string,
): Promise<WorkflowExecution> {
  if (execution.status !== 'paused') return execution

  const workflow = await getWorkflow(execution.workflowId)
  if (!workflow) return { ...execution, status: 'failed' }

  let stepResults = execution.stepResults
  if (modifiedOutput !== undefined && stepResults.length > 0) {
    const last = stepResults[stepResults.length - 1]
    stepResults = [
      ...stepResults.slice(0, -1),
      { ...last, output: modifiedOutput },
    ]
  }

  return runNextStep(
    {
      ...execution,
      stepResults,
      currentStepIndex: execution.currentStepIndex + 1,
      status: 'running',
    },
    workflow,
    getChapterContent,
    getStoryBible,
    getOutline,
  )
}

export function rejectStep(execution: WorkflowExecution): WorkflowExecution {
  return {
    ...execution,
    status: 'failed',
    completedAt: new Date().toISOString(),
  }
}

// ============ Built-in Workflow Templates ============

const now = new Date().toISOString()

const BUILTIN_WORKFLOWS: Workflow[] = [
  {
    id: 'builtin-chapter-pipeline',
    name: 'Chapter Pipeline',
    description: 'Outline → Draft → Revise: produce a polished chapter from outline notes',
    isBuiltin: true,
    createdAt: now,
    updatedAt: now,
    steps: [
      {
        id: 's1',
        name: 'Outline Review',
        agentMode: 'analysis',
        prompt: 'Analyze this outline and identify key scenes, characters, and narrative beats to address in the draft.',
        inputSource: 'outline',
        checkpoint: 'review',
        enabled: true,
      },
      {
        id: 's2',
        name: 'Draft Writing',
        agentMode: 'writing',
        prompt: 'Write a full chapter draft based on the analysis and outline. Maintain consistent voice and pacing.',
        inputSource: 'previous_step',
        checkpoint: 'review',
        enabled: true,
      },
      {
        id: 's3',
        name: 'Final Revision',
        agentMode: 'writing',
        prompt: 'Revise this draft for clarity, flow, and narrative consistency. Improve prose quality while preserving the author\'s intent.',
        inputSource: 'previous_step',
        checkpoint: 'approve',
        enabled: true,
      },
    ],
  },
  {
    id: 'builtin-revision-pass',
    name: 'Revision Pass',
    description: 'Analyze → Revise → Check: targeted revision with consistency verification',
    isBuiltin: true,
    createdAt: now,
    updatedAt: now,
    steps: [
      {
        id: 's1',
        name: 'Content Analysis',
        agentMode: 'analysis',
        prompt: 'Analyze this chapter content and identify areas needing improvement: pacing issues, weak prose, inconsistencies.',
        inputSource: 'chapter_content',
        checkpoint: 'none',
        enabled: true,
      },
      {
        id: 's2',
        name: 'Targeted Revision',
        agentMode: 'writing',
        prompt: 'Apply targeted revisions based on the analysis. Fix identified issues while maintaining the original tone and style.',
        inputSource: 'previous_step',
        checkpoint: 'review',
        enabled: true,
      },
      {
        id: 's3',
        name: 'Consistency Check',
        agentMode: 'evaluation',
        prompt: 'Verify that the revised content is consistent with the original chapter. Check for introduced errors, lost context, or tone shifts.',
        inputSource: 'previous_step',
        checkpoint: 'approve',
        enabled: true,
      },
    ],
  },
  {
    id: 'builtin-style-analysis',
    name: 'Style Analysis',
    description: 'Extract → Compare → Recommend: deep style analysis with actionable suggestions',
    isBuiltin: true,
    createdAt: now,
    updatedAt: now,
    steps: [
      {
        id: 's1',
        name: 'Style Extraction',
        agentMode: 'analysis',
        prompt: 'Extract the writing style characteristics from this content: sentence patterns, vocabulary level, narrative voice, tone, and rhythm.',
        inputSource: 'chapter_content',
        checkpoint: 'none',
        enabled: true,
      },
      {
        id: 's2',
        name: 'Style Comparison',
        agentMode: 'analysis',
        prompt: 'Compare the extracted style against common fiction writing standards and identify strengths and areas for improvement.',
        inputSource: 'previous_step',
        checkpoint: 'review',
        enabled: true,
      },
      {
        id: 's3',
        name: 'Recommendations',
        agentMode: 'evaluation',
        prompt: 'Generate actionable writing recommendations based on the style analysis. Provide specific examples and exercises.',
        inputSource: 'previous_step',
        checkpoint: 'approve',
        enabled: true,
      },
    ],
  },
]
