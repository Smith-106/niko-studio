export type AgentMode = 'writing' | 'analysis' | 'evaluation' | 'custom'

export type InputSource = 'previous_step' | 'chapter_content' | 'story_bible' | 'outline'

export type CheckpointType = 'none' | 'review' | 'approve'

export interface WorkflowStep {
  id: string
  name: string
  agentMode: AgentMode
  prompt: string
  inputSource: InputSource
  checkpoint: CheckpointType
  enabled: boolean
}

export interface Workflow {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  isBuiltin: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkflowStepResult {
  stepIndex: number
  input: string
  output: string
  status: 'completed' | 'failed' | 'skipped'
  timestamp: string
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  chapterId: string
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed'
  currentStepIndex: number
  stepResults: WorkflowStepResult[]
  startedAt: string
  completedAt: string | null
}
