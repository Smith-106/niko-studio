import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { EvaluationSupportToolsSection } from './EvaluationSupportToolsSection'

describe('EvaluationSupportToolsSection', () => {
  it('renders multi-pass revision session metadata when provided', () => {
    render(
      <EvaluationSupportToolsSection
        title="更多工具"
        hint="测试"
        open
        onToggle={() => {}}
        qualityTitle="质量检查"
        qualityRunLabel="运行质量检查"
        qualityRunningLabel="运行中"
        qualityChecking={false}
        qualityCheckError={null}
        qualityCheckResult={null}
        qualityDecisionLabel="决策"
        qualityTotalLabel="总分"
        qualityLockLabel="锁定"
        qualityStyleLabel="风格"
        qualityLogicLabel="逻辑"
        qualityFeedbackLabel="反馈"
        onRunQualityCheck={() => {}}
        isZh
        content="正文"
        multiPassTarget={8}
        multiPassMaxIter={5}
        multiPassRunning={false}
        multiPassResult={{
          iterations: 2,
          initialScore: 7.1,
          finalScore: 8.2,
          reason: 'target_reached',
          sessionId: 'cp-1',
          revisionSession: {
            id: 'revision-session-1',
            chapterId: 'chapter-7',
            state: 'COMPARED',
            iteration: 2,
            comparisonSummary: 'Score improved',
          },
        }}
        onMultiPassTargetChange={() => {}}
        onMultiPassMaxIterChange={() => {}}
        onRunMultiPass={() => {}}
        consistencyTitle="一致性"
        consistencyRunLabel="运行一致性"
        consistencyRunningLabel="运行中"
        consistencyChecking={false}
        consistencyCheckError={null}
        consistencyCheckResult={null}
        consistencyRunIdLabel="运行 ID"
        consistencyScoreLabel="评分"
        consistencyConflictsLabel="冲突"
        consistencySummaryLabel="摘要"
        hasMeaningfulScope={false}
        noScopeHint="暂无"
        onRunConsistency={() => {}}
        moduleBreakdownTitle="模块"
        workflowProps={{
          isZh: true,
          writerWorkflowTitle: '工作流',
          writerWorkflowHint: '提示',
          writerAdvancedTitle: '高级',
          writerAdvancedHint: '高级提示',
          scopeChips: [],
          hasMeaningfulScope: false,
          presets: [],
          showAdvancedWorkflow: false,
          onToggleAdvancedWorkflow: () => {},
          workflowTask: '',
          workflowLevel: '',
          workflowPlanId: '',
          workflowStepId: '',
          workflowLifecycleAction: 'status',
          workflowConfirmToken: '',
          workflowWaitingConfirmation: false,
          workflowGateReason: null,
          workflowResult: null,
          workflowStates: {
            route: { status: 'idle' },
            plan: { status: 'idle' },
            execute: { status: 'idle' },
            lifecycle: { status: 'idle' },
          },
          setWorkflowTask: () => {},
          setWorkflowLevel: () => {},
          setWorkflowPlanId: () => {},
          setWorkflowStepId: () => {},
          setWorkflowLifecycleAction: () => {},
          setWorkflowConfirmToken: () => {},
          onWorkflowRoute: () => {},
          onWorkflowPlan: () => {},
          onWorkflowExecute: () => {},
          onWorkflowLifecycle: () => {},
          onWorkflowConfirmAndContinue: () => {},
          onRetryWorkflowAction: () => {},
          labels: {
            taskPlaceholder: '任务',
            levelPlaceholder: '等级',
            planIdPlaceholder: '计划 ID',
            stepIdPlaceholder: '步骤 ID',
            lifecycleActionLabel: '生命周期动作',
            lifecycleStatus: '状态',
            lifecycleStart: '开始',
            lifecyclePause: '暂停',
            lifecycleResume: '恢复',
            lifecycleStop: '停止',
            route: '路由',
            plan: '计划',
            execute: '执行',
            lifecycle: '生命周期',
            waitingConfirmation: '等待确认',
            gateReason: '原因',
            confirmTokenPlaceholder: '确认令牌',
            confirmAndContinue: '确认并继续',
            retry: '重试',
          },
        }}
        checkpointDescription=""
        checkpointPlaceholder="检查点"
        checkpointError={null}
        checkpoints={[]}
        saveLabel="保存"
        refreshLabel="刷新"
        restoreLabel="恢复"
        onCheckpointDescriptionChange={() => {}}
        onCreateCheckpoint={() => {}}
        onRefreshCheckpoints={() => {}}
        onRestoreCheckpoint={() => {}}
      />,
    )

    expect(screen.getByText(/会话 ID/)).toBeInTheDocument()
    expect(screen.getByText(/cp-1/)).toBeInTheDocument()
    expect(screen.getByText(/会话状态/)).toBeInTheDocument()
    expect(screen.getByText(/COMPARED/)).toBeInTheDocument()
    expect(screen.getByText(/迭代 2/)).toBeInTheDocument()
  })
})
