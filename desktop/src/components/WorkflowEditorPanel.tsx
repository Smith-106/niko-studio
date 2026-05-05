import React, { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import type { Workflow, WorkflowStep, WorkflowExecution, AgentMode, InputSource, CheckpointType } from '../types/workflow'

interface PanelProps {
  onClose: () => void
}

const AGENT_MODE_LABELS: Record<AgentMode, string> = {
  writing: '写作',
  analysis: '分析',
  evaluation: '评估',
  custom: '自定义',
}

const INPUT_SOURCE_LABELS: Record<InputSource, string> = {
  previous_step: '上一步输出',
  chapter_content: '章节内容',
  story_bible: '故事设定',
  outline: '大纲',
}

const CHECKPOINT_LABELS: Record<CheckpointType, string> = {
  none: '无',
  review: '审阅',
  approve: '批准',
}

function emptyStep(index: number): WorkflowStep {
  return {
    id: crypto.randomUUID().slice(0, 8),
    name: `步骤 ${index + 1}`,
    agentMode: 'writing',
    prompt: '',
    inputSource: index === 0 ? 'chapter_content' : 'previous_step',
    checkpoint: 'none',
    enabled: true,
  }
}

export const WorkflowEditorPanel: React.FC<PanelProps> = ({ onClose }) => {
  const {
    workflows,
    activeExecution,
    workflowsLoading,
    workflowsError,
    fetchWorkflows,
    saveWorkflow,
    deleteWorkflow,
    startExecution,
    approveStep: storeApproveStep,
    rejectStep: storeRejectStep,
  } = useAppStore()

  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [view, setView] = useState<'list' | 'edit' | 'execution'>('list')

  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  const handleSelectWorkflow = useCallback((wf: Workflow) => {
    setSelectedWorkflow({ ...wf, steps: wf.steps.map((s) => ({ ...s })) })
    setView('edit')
  }, [])

  const handleCreateWorkflow = useCallback(() => {
    const now = new Date().toISOString()
    const wf: Workflow = {
      id: crypto.randomUUID().slice(0, 8),
      name: '',
      description: '',
      steps: [emptyStep(0)],
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
    }
    setSelectedWorkflow(wf)
    setView('edit')
  }, [])

  const handleSave = useCallback(async () => {
    if (!selectedWorkflow || !selectedWorkflow.name.trim()) return
    await saveWorkflow(selectedWorkflow)
    setSelectedWorkflow(null)
    setView('list')
  }, [selectedWorkflow, saveWorkflow])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('确认删除此工作流？')) return
    await deleteWorkflow(id)
    if (selectedWorkflow?.id === id) {
      setSelectedWorkflow(null)
      setView('list')
    }
  }, [deleteWorkflow, selectedWorkflow])

  const updateStep = useCallback((stepId: string, updates: Partial<WorkflowStep>) => {
    setSelectedWorkflow((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        steps: prev.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)),
      }
    })
  }, [])

  const addStep = useCallback(() => {
    setSelectedWorkflow((prev) => {
      if (!prev) return prev
      return { ...prev, steps: [...prev.steps, emptyStep(prev.steps.length)] }
    })
  }, [])

  const removeStep = useCallback((stepId: string) => {
    setSelectedWorkflow((prev) => {
      if (!prev) return prev
      return { ...prev, steps: prev.steps.filter((s) => s.id !== stepId) }
    })
  }, [])

  const handleStartExecution = useCallback((wf: Workflow) => {
    if (!wf.steps.some((s) => s.enabled)) return
    startExecution(
      wf.id,
      '',
      () => '',
      () => '',
      () => '',
    )
    setView('execution')
  }, [startExecution])

  const handleApprove = useCallback((modifiedOutput?: string) => {
    storeApproveStep(() => '', () => '', () => '', modifiedOutput)
  }, [storeApproveStep])

  const handleReject = useCallback(() => {
    storeRejectStep()
    setView('list')
  }, [storeRejectStep])

  return (
    <div
      className="w-[400px] h-full bg-dark-bg-2 border-l border-dark-border text-white flex flex-col"
      role="region"
      aria-label="工作流编辑器"
    >
      <div className="p-4 border-b border-dark-border flex-shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold uppercase tracking-wider">工作流</h2>
          <div className="flex items-center gap-2">
            {view !== 'list' && (
              <button
                onClick={() => setView('list')}
                className="text-xs text-dark-text-muted hover:text-white px-2 py-1"
              >
                返回列表
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">&times;</button>
          </div>
        </div>
      </div>

      {workflowsError && (
        <div className="px-4 py-2 text-xs text-danger-500 bg-danger-500/10">{workflowsError}</div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {view === 'list' && (
          <WorkflowList
            workflows={workflows}
            loading={workflowsLoading}
            onSelect={handleSelectWorkflow}
            onCreate={handleCreateWorkflow}
            onDelete={handleDelete}
            onExecute={handleStartExecution}
          />
        )}

        {view === 'edit' && selectedWorkflow && (
          <StepEditor
            workflow={selectedWorkflow}
            onUpdateName={(name) => setSelectedWorkflow((prev) => prev ? { ...prev, name } : prev)}
            onUpdateDescription={(desc) => setSelectedWorkflow((prev) => prev ? { ...prev, description: desc } : prev)}
            onUpdateStep={updateStep}
            onAddStep={addStep}
            onRemoveStep={removeStep}
            onSave={handleSave}
          />
        )}

        {view === 'execution' && activeExecution && (
          <ExecutionView
            execution={activeExecution}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </div>
    </div>
  )
}

// --- Sub-components ---

interface WorkflowListProps {
  workflows: Workflow[]
  loading: boolean
  onSelect: (wf: Workflow) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onExecute: (wf: Workflow) => void
}

const WorkflowList: React.FC<WorkflowListProps> = ({
  workflows,
  loading,
  onSelect,
  onCreate,
  onDelete,
  onExecute,
}) => (
  <div className="p-4 space-y-2">
    <button
      onClick={onCreate}
      className="w-full py-2 px-4 bg-primary-cta text-white text-sm font-medium rounded hover:opacity-90 transition-opacity"
    >
      + 新建工作流
    </button>

    {loading && !workflows.length ? (
      <p className="text-center text-dark-text-muted text-sm py-4">加载中...</p>
    ) : (
      workflows.map((wf) => (
        <div
          key={wf.id}
          className="p-3 rounded bg-dark-surface-sunken hover:bg-dark-surface transition-colors cursor-pointer"
          onClick={() => onSelect(wf)}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{wf.name || '未命名工作流'}</p>
              <p className="text-xs text-dark-text-muted mt-0.5">{wf.steps.length} 个步骤</p>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {!wf.isBuiltin && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(wf.id) }}
                  className="text-xs text-danger-500 hover:opacity-80 px-1"
                >
                  删除
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onExecute(wf) }}
                className="text-xs text-primary-cta hover:opacity-80 px-1"
              >
                运行
              </button>
            </div>
          </div>
        </div>
      ))
    )}

    {!loading && workflows.length === 0 && (
      <p className="text-center text-dark-text-muted text-sm py-8">暂无工作流</p>
    )}
  </div>
)

interface StepEditorProps {
  workflow: Workflow
  onUpdateName: (name: string) => void
  onUpdateDescription: (desc: string) => void
  onUpdateStep: (stepId: string, updates: Partial<WorkflowStep>) => void
  onAddStep: () => void
  onRemoveStep: (stepId: string) => void
  onSave: () => void
}

const StepEditor: React.FC<StepEditorProps> = ({
  workflow,
  onUpdateName,
  onUpdateDescription,
  onUpdateStep,
  onAddStep,
  onRemoveStep,
  onSave,
}) => {
  const [activeStepId, setActiveStepId] = useState<string | null>(
    workflow.steps[0]?.id ?? null,
  )
  const activeStep = workflow.steps.find((s) => s.id === activeStepId)

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <input
          value={workflow.name}
          onChange={(e) => onUpdateName(e.target.value)}
          placeholder="工作流名称"
          className="w-full bg-dark-surface-sunken border border-dark-border rounded px-2 py-1.5 text-sm text-white"
        />
        <textarea
          value={workflow.description}
          onChange={(e) => onUpdateDescription(e.target.value)}
          placeholder="描述"
          rows={2}
          className="w-full bg-dark-surface-sunken border border-dark-border rounded px-2 py-1.5 text-sm text-white resize-none"
        />
      </div>

      <div className="flex justify-between items-center">
        <span className="text-xs text-dark-text-muted uppercase tracking-wider">步骤</span>
        <button onClick={onAddStep} className="text-xs text-primary-cta hover:opacity-80">
          + 添加步骤
        </button>
      </div>

      <div className="space-y-1">
        {workflow.steps.map((step, i) => (
          <div
            key={step.id}
            onClick={() => setActiveStepId(step.id)}
            className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs transition-colors ${
              step.id === activeStepId
                ? 'bg-primary-cta/20 border border-primary-cta/40'
                : 'bg-dark-surface-sunken hover:bg-dark-surface'
            } ${!step.enabled ? 'opacity-50' : ''}`}
          >
            <span className="text-dark-text-muted">{i + 1}.</span>
            <span className="flex-1 truncate">{step.name || '未命名步骤'}</span>
            <span className="text-dark-text-muted">{AGENT_MODE_LABELS[step.agentMode]}</span>
            {workflow.steps.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveStep(step.id) }}
                className="text-danger-500 hover:opacity-80"
              >
                &times;
              </button>
            )}
          </div>
        ))}
      </div>

      {activeStep && (
        <div className="space-y-3 border-t border-dark-border pt-4">
          <input
            value={activeStep.name}
            onChange={(e) => onUpdateStep(activeStep.id, { name: e.target.value })}
            placeholder="步骤名称"
            className="w-full bg-dark-surface-sunken border border-dark-border rounded px-2 py-1.5 text-sm text-white"
          />

          <div>
            <label className="block text-xs text-dark-text-muted mb-1">模式</label>
            <select
              value={activeStep.agentMode}
              onChange={(e) => onUpdateStep(activeStep.id, { agentMode: e.target.value as AgentMode })}
              className="w-full bg-dark-surface-sunken border border-dark-border rounded px-2 py-1.5 text-sm text-white"
            >
              {Object.entries(AGENT_MODE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-dark-text-muted mb-1">提示词</label>
            <textarea
              value={activeStep.prompt}
              onChange={(e) => onUpdateStep(activeStep.id, { prompt: e.target.value })}
              placeholder="步骤提示词"
              rows={3}
              className="w-full bg-dark-surface-sunken border border-dark-border rounded px-2 py-1.5 text-sm text-white resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-dark-text-muted mb-1">输入来源</label>
              <select
                value={activeStep.inputSource}
                onChange={(e) => onUpdateStep(activeStep.id, { inputSource: e.target.value as InputSource })}
                className="w-full bg-dark-surface-sunken border border-dark-border rounded px-2 py-1.5 text-sm text-white"
              >
                {Object.entries(INPUT_SOURCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-dark-text-muted mb-1">检查点</label>
              <select
                value={activeStep.checkpoint}
                onChange={(e) => onUpdateStep(activeStep.id, { checkpoint: e.target.value as CheckpointType })}
                className="w-full bg-dark-surface-sunken border border-dark-border rounded px-2 py-1.5 text-sm text-white"
              >
                {Object.entries(CHECKPOINT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-dark-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={activeStep.enabled}
              onChange={(e) => onUpdateStep(activeStep.id, { enabled: e.target.checked })}
              className="accent-primary-cta"
            />
            启用此步骤
          </label>
        </div>
      )}

      <button
        onClick={onSave}
        disabled={!workflow.name.trim()}
        className="w-full py-2 px-4 bg-primary-cta text-white text-sm font-medium rounded hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        保存工作流
      </button>
    </div>
  )
}

interface ExecutionViewProps {
  execution: WorkflowExecution
  onApprove: (modifiedOutput?: string) => void
  onReject: () => void
}

const ExecutionView: React.FC<ExecutionViewProps> = ({ execution, onApprove, onReject }) => {
  const [modifiedOutput, setModifiedOutput] = useState<string>('')
  const [editingOutput, setEditingOutput] = useState(false)
  const lastResult = execution.stepResults[execution.stepResults.length - 1]

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          execution.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
          execution.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
          execution.status === 'completed' ? 'bg-green-500/20 text-green-400' :
          execution.status === 'failed' ? 'bg-red-500/20 text-red-400' :
          'bg-dark-surface-sunken text-dark-text-muted'
        }`}>
          {execution.status}
        </span>
        <span className="text-xs text-dark-text-muted">
          步骤 {execution.currentStepIndex + 1}
        </span>
      </div>

      <div className="space-y-2">
        {execution.stepResults.map((result, i) => (
          <div
            key={i}
            className={`p-2 rounded text-xs ${
              result.status === 'completed' ? 'bg-green-500/10 border border-green-500/20' :
              result.status === 'failed' ? 'bg-red-500/10 border border-red-500/20' :
              'bg-dark-surface-sunken'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium">步骤 {result.stepIndex + 1}</span>
              <span className="text-dark-text-muted">{result.status}</span>
            </div>
            {result.output && (
              <p className="text-dark-text-muted line-clamp-3 whitespace-pre-wrap">{result.output}</p>
            )}
          </div>
        ))}
      </div>

      {execution.status === 'paused' && lastResult && (
        <div className="border-t border-dark-border pt-4 space-y-3">
          <span className="text-xs text-yellow-400 uppercase tracking-wider">检查点 — 审阅输出</span>

          {editingOutput ? (
            <textarea
              value={modifiedOutput}
              onChange={(e) => setModifiedOutput(e.target.value)}
              rows={6}
              className="w-full bg-dark-surface-sunken border border-dark-border rounded px-2 py-1.5 text-sm text-white resize-none"
            />
          ) : (
            <div className="bg-dark-surface-sunken border border-dark-border rounded p-2 text-xs text-dark-text-muted max-h-40 overflow-y-auto whitespace-pre-wrap">
              {lastResult.output}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (editingOutput) {
                  onApprove(modifiedOutput || undefined)
                  setEditingOutput(false)
                } else {
                  onApprove()
                }
              }}
              className="flex-1 py-1.5 text-sm bg-green-600 text-white rounded hover:opacity-90"
            >
              {editingOutput ? '提交修改并继续' : '批准继续'}
            </button>
            <button
              onClick={() => {
                setModifiedOutput(lastResult.output)
                setEditingOutput(true)
              }}
              className="flex-1 py-1.5 text-sm border border-dark-border text-dark-text-muted rounded hover:text-white"
            >
              修改
            </button>
            <button
              onClick={onReject}
              className="flex-1 py-1.5 text-sm border border-danger-500/30 text-danger-500 rounded hover:bg-danger-500/10"
            >
              拒绝
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
