type EvaluationKeys =
  'evaluationTitle'
  | 'evaluationClose'
  | 'evaluationFailed'
  | 'failureCategoryGeneration'
  | 'failureCategoryEvaluation'
  | 'failureCategoryRetrieval'
  | 'failureCategoryConnection'
  | 'failureMessageGeneration'
  | 'failureMessageEvaluation'
  | 'failureMessageRetrieval'
  | 'failureMessageConnection'
  | 'evaluationNoContent'
  | 'evaluationOverallScore'
  | 'evaluationDimensionAnalysis'
  | 'evaluationModuleBreakdown'
  | 'evaluationSuggestions'
  | 'evaluationBatchApply'
  | 'evaluationBatchUndo'
  | 'evaluationApply'
  | 'evaluationUndo'
  | 'evaluationApplying'
  | 'evaluationUndoing'
  | 'evaluationBatchApplying'
  | 'evaluationBatchUndoing'
  | 'evaluationBatchResult'
  | 'evaluationBatchUndoResult'
  | 'evaluationPassed'
  | 'evaluationNeedRevise'
  | 'evaluationNeedRewrite'
  | 'evaluationUnknown'
  | 'evaluationNoFeedback'
  | 'evaluationDimensionLock'
  | 'evaluationDimensionStyle'
  | 'evaluationDimensionLogic'
  | 'evaluationActionFailedWithReason'
  | 'evaluationRecommendationFallback'
  | 'evaluationCheckpointTitle'
  | 'evaluationCheckpointPlaceholder'
  | 'evaluationRefresh'
  | 'evaluationSuggestionsRefresh'
  | 'evaluationSuggestionsRefreshing'
  | 'evaluationSuggestionsRefreshFailed'
  | 'evaluationQualityCheckTitle'
  | 'evaluationQualityCheckRun'
  | 'evaluationQualityCheckRunning'
  | 'evaluationQualityCheckFailed'
  | 'evaluationQualityCheckDecision'
  | 'evaluationQualityCheckTotal'
  | 'evaluationQualityCheckLock'
  | 'evaluationQualityCheckStyle'
  | 'evaluationQualityCheckLogic'
  | 'evaluationQualityCheckFeedback'
  | 'evaluationConsistencyTitle'
  | 'evaluationConsistencyRun'
  | 'evaluationConsistencyRunning'
  | 'evaluationConsistencyFailed'
  | 'evaluationConsistencySummary'
  | 'evaluationConsistencyScore'
  | 'evaluationConsistencyConflicts'
  | 'evaluationConsistencyRunId'
  | 'evaluationWorkflowTitle'
  | 'evaluationWorkflowTaskPlaceholder'
  | 'evaluationWorkflowLevelPlaceholder'
  | 'evaluationWorkflowPlanIdPlaceholder'
  | 'evaluationWorkflowStepIdPlaceholder'
  | 'evaluationWorkflowLifecycleActionLabel'
  | 'evaluationWorkflowLifecycleStatus'
  | 'evaluationWorkflowLifecycleStart'
  | 'evaluationWorkflowLifecyclePause'
  | 'evaluationWorkflowLifecycleResume'
  | 'evaluationWorkflowLifecycleStop'
  | 'evaluationWorkflowRoute'
  | 'evaluationWorkflowPlan'
  | 'evaluationWorkflowExecute'
  | 'evaluationWorkflowLifecycle'
  | 'evaluationWorkflowRetry'
  | 'evaluationWorkflowLoading'
  | 'evaluationWorkflowSuccess'
  | 'evaluationWorkflowError'
  | 'evaluationWorkflowPlanIdRequired'
  | 'evaluationWorkflowWaitingConfirmation'
  | 'evaluationWorkflowGateReason'
  | 'evaluationWorkflowConfirmTokenPlaceholder'
  | 'evaluationWorkflowConfirmAndContinue'
  | 'evaluationWorkflowConfirmTokenRequired'

export type Translations = Record<EvaluationKeys, string>

export const zhEvaluation: Translations = {
  evaluationTitle: '回复评估',
  evaluationClose: '关闭评估面板',
  evaluationFailed: '评估失败',
  failureCategoryGeneration: '生成失败',
  failureCategoryEvaluation: '评估失败',
  failureCategoryRetrieval: '资料拉取失败',
  failureCategoryConnection: '连接失败',
  failureMessageGeneration: '这次回复没有生成完成，你可以重试或先继续写。',
  failureMessageEvaluation: '当前评估步骤暂时不可用，你可以先继续写，再稍后重试。',
  failureMessageRetrieval: '这次没有成功取到参考资料，你可以稍后重试或先按当前内容继续写。',
  failureMessageConnection: '当前与本地服务连接异常，请检查服务状态后再重试。',
  evaluationNoContent: '还没有可评估的助手回复',
  evaluationOverallScore: '综合评分',
  evaluationDimensionAnalysis: '维度分析',
  evaluationModuleBreakdown: '一致性模块评分',
  evaluationSuggestions: '改进建议',
  evaluationBatchApply: '批量应用',
  evaluationBatchUndo: '批量撤销',
  evaluationApply: '应用',
  evaluationUndo: '撤销',
  evaluationApplying: '执行中...',
  evaluationUndoing: '撤销中...',
  evaluationBatchApplying: '批量执行中...',
  evaluationBatchUndoing: '批量撤销中...',
  evaluationBatchResult: '批量结果：成功 {applied}，失败 {failed}',
  evaluationBatchUndoResult: '批量撤销结果：成功 {success}，失败 {failed}',
  evaluationPassed: '通过',
  evaluationNeedRevise: '需修改',
  evaluationNeedRewrite: '需重写',
  evaluationUnknown: '未知',
  evaluationNoFeedback: '无',
  evaluationDimensionLock: '结构锁定',
  evaluationDimensionStyle: '风格',
  evaluationDimensionLogic: '逻辑',
  evaluationActionFailedWithReason: '{action}失败：{reason}',
  evaluationRecommendationFallback: '建议 {index}',
  evaluationCheckpointTitle: '检查点',
  evaluationCheckpointPlaceholder: '检查点描述',
  evaluationRefresh: '刷新',
  evaluationSuggestionsRefresh: '刷新建议',
  evaluationSuggestionsRefreshing: '刷新建议中...',
  evaluationSuggestionsRefreshFailed: '刷新建议失败，请稍后重试。',
  evaluationQualityCheckTitle: '小说质量检查',
  evaluationQualityCheckRun: '执行质量检查',
  evaluationQualityCheckRunning: '质量检查中...',
  evaluationQualityCheckFailed: '质量检查失败',
  evaluationQualityCheckDecision: '决策',
  evaluationQualityCheckTotal: '总分',
  evaluationQualityCheckLock: '结构锁定分',
  evaluationQualityCheckStyle: '风格分',
  evaluationQualityCheckLogic: '逻辑分',
  evaluationQualityCheckFeedback: '反馈',
  evaluationConsistencyTitle: '一致性治理',
  evaluationConsistencyRun: '执行一致性检查',
  evaluationConsistencyRunning: '一致性检查中...',
  evaluationConsistencyFailed: '一致性检查失败',
  evaluationConsistencySummary: '摘要',
  evaluationConsistencyScore: '综合评分',
  evaluationConsistencyConflicts: '冲突数',
  evaluationConsistencyRunId: '运行 ID',
  evaluationWorkflowTitle: '高级工作流',
  evaluationWorkflowTaskPlaceholder: '工作流任务',
  evaluationWorkflowLevelPlaceholder: '工作流级别（如 L3）',
  evaluationWorkflowPlanIdPlaceholder: '计划 ID',
  evaluationWorkflowStepIdPlaceholder: '步骤 ID（可选）',
  evaluationWorkflowLifecycleActionLabel: '生命周期动作',
  evaluationWorkflowLifecycleStatus: '状态',
  evaluationWorkflowLifecycleStart: '开始',
  evaluationWorkflowLifecyclePause: '暂停',
  evaluationWorkflowLifecycleResume: '继续',
  evaluationWorkflowLifecycleStop: '停止',
  evaluationWorkflowRoute: '路由',
  evaluationWorkflowPlan: '规划',
  evaluationWorkflowExecute: '执行',
  evaluationWorkflowLifecycle: '生命周期',
  evaluationWorkflowRetry: '重试',
  evaluationWorkflowLoading: '请求中...',
  evaluationWorkflowSuccess: '执行成功',
  evaluationWorkflowError: '执行失败',
  evaluationWorkflowPlanIdRequired: '请先填写 plan_id。',
  evaluationWorkflowWaitingConfirmation: '需要确认后才能继续。',
  evaluationWorkflowGateReason: '阻塞原因',
  evaluationWorkflowConfirmTokenPlaceholder: '确认令牌（confirm_token）',
  evaluationWorkflowConfirmAndContinue: '确认并继续',
  evaluationWorkflowConfirmTokenRequired: '请先填写 confirm_token。',
}

export const enEvaluation: Translations = {
  evaluationTitle: 'Reply Review',
  evaluationClose: 'Close evaluation panel',
  evaluationFailed: 'Evaluation failed',
  failureCategoryGeneration: 'Generation failed',
  failureCategoryEvaluation: 'Evaluation failed',
  failureCategoryRetrieval: 'Reference lookup failed',
  failureCategoryConnection: 'Connection failed',
  failureMessageGeneration: 'This reply did not finish generating. You can retry or keep writing.',
  failureMessageEvaluation: 'The evaluation step is temporarily unavailable. You can keep writing and retry later.',
  failureMessageRetrieval: 'The assistant could not fetch supporting references this time. Retry later or continue with the current draft.',
  failureMessageConnection: 'The app could not reach the local service. Check the service status and try again.',
  evaluationNoContent: 'No assistant reply to review yet',
  evaluationOverallScore: 'Overall Score',
  evaluationDimensionAnalysis: 'Dimension Analysis',
  evaluationModuleBreakdown: 'Module Scores',
  evaluationSuggestions: 'Suggestions',
  evaluationBatchApply: 'Batch Apply',
  evaluationBatchUndo: 'Batch Undo',
  evaluationApply: 'Apply',
  evaluationUndo: 'Undo',
  evaluationApplying: 'Applying...',
  evaluationUndoing: 'Undoing...',
  evaluationBatchApplying: 'Batch applying...',
  evaluationBatchUndoing: 'Batch undoing...',
  evaluationBatchResult: 'Batch result: success {applied}, failed {failed}',
  evaluationBatchUndoResult: 'Batch undo result: success {success}, failed {failed}',
  evaluationPassed: 'Passed',
  evaluationNeedRevise: 'Needs revision',
  evaluationNeedRewrite: 'Needs rewrite',
  evaluationUnknown: 'Unknown',
  evaluationNoFeedback: 'None',
  evaluationDimensionLock: 'Lock',
  evaluationDimensionStyle: 'Style',
  evaluationDimensionLogic: 'Logic',
  evaluationActionFailedWithReason: '{action} failed: {reason}',
  evaluationRecommendationFallback: 'Recommendation {index}',
  evaluationCheckpointTitle: 'Checkpoint',
  evaluationCheckpointPlaceholder: 'Checkpoint description',
  evaluationRefresh: 'Refresh',
  evaluationSuggestionsRefresh: 'Refresh suggestions',
  evaluationSuggestionsRefreshing: 'Refreshing suggestions...',
  evaluationSuggestionsRefreshFailed: 'Failed to refresh suggestions. Please try again later.',
  evaluationQualityCheckTitle: 'Novel Quality Check',
  evaluationQualityCheckRun: 'Run quality check',
  evaluationQualityCheckRunning: 'Running quality check...',
  evaluationQualityCheckFailed: 'Quality check failed',
  evaluationQualityCheckDecision: 'Decision',
  evaluationQualityCheckTotal: 'Total',
  evaluationQualityCheckLock: 'Lock',
  evaluationQualityCheckStyle: 'Style',
  evaluationQualityCheckLogic: 'Logic',
  evaluationQualityCheckFeedback: 'Feedback',
  evaluationConsistencyTitle: 'Consistency governance',
  evaluationConsistencyRun: 'Run consistency check',
  evaluationConsistencyRunning: 'Running consistency check...',
  evaluationConsistencyFailed: 'Consistency check failed',
  evaluationConsistencySummary: 'Summary',
  evaluationConsistencyScore: 'Overall score',
  evaluationConsistencyConflicts: 'Conflicts',
  evaluationConsistencyRunId: 'Run ID',
  evaluationWorkflowTitle: 'Advanced Workflow',
  evaluationWorkflowTaskPlaceholder: 'workflow task',
  evaluationWorkflowLevelPlaceholder: 'workflow level (e.g. L3)',
  evaluationWorkflowPlanIdPlaceholder: 'plan_id',
  evaluationWorkflowStepIdPlaceholder: 'step_id (optional)',
  evaluationWorkflowLifecycleActionLabel: 'lifecycle action',
  evaluationWorkflowLifecycleStatus: 'status',
  evaluationWorkflowLifecycleStart: 'start',
  evaluationWorkflowLifecyclePause: 'pause',
  evaluationWorkflowLifecycleResume: 'resume',
  evaluationWorkflowLifecycleStop: 'stop',
  evaluationWorkflowRoute: 'route',
  evaluationWorkflowPlan: 'plan',
  evaluationWorkflowExecute: 'execute',
  evaluationWorkflowLifecycle: 'lifecycle',
  evaluationWorkflowRetry: 'Retry',
  evaluationWorkflowLoading: 'Requesting...',
  evaluationWorkflowSuccess: 'Success',
  evaluationWorkflowError: 'Failed',
  evaluationWorkflowPlanIdRequired: 'Please provide plan_id first.',
  evaluationWorkflowWaitingConfirmation: 'Waiting for confirmation to continue.',
  evaluationWorkflowGateReason: 'Gate reason',
  evaluationWorkflowConfirmTokenPlaceholder: 'confirm_token',
  evaluationWorkflowConfirmAndContinue: 'Confirm & Continue',
  evaluationWorkflowConfirmTokenRequired: 'Please provide confirm_token first.',
}
