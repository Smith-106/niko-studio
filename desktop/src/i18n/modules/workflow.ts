type WorkflowKeys =
  'workflowTitle'
  | 'workflowBackToList'
  | 'workflowCreateNew'
  | 'workflowUnnamed'
  | 'workflowStepCount'
  | 'workflowDelete'
  | 'workflowRun'
  | 'workflowEmpty'
  | 'workflowLoading'
  | 'workflowNamePlaceholder'
  | 'workflowDescriptionPlaceholder'
  | 'workflowSteps'
  | 'workflowAddStep'
  | 'workflowUnnamedStep'
  | 'workflowModeLabel'
  | 'workflowModeWriting'
  | 'workflowModeAnalysis'
  | 'workflowModeEvaluation'
  | 'workflowModeCustom'
  | 'workflowPromptLabel'
  | 'workflowPromptPlaceholder'
  | 'workflowInputSourceLabel'
  | 'workflowInputPreviousStep'
  | 'workflowInputChapterContent'
  | 'workflowInputStoryBible'
  | 'workflowInputOutline'
  | 'workflowCheckpointLabel'
  | 'workflowCheckpointNone'
  | 'workflowCheckpointReview'
  | 'workflowCheckpointApprove'
  | 'workflowEnableStep'
  | 'workflowSave'
  | 'workflowConfirmDelete'
  | 'workflowConfirmDeleteYes'
  | 'workflowConfirmDeleteNo'
  | 'workflowExecutionStep'
  | 'workflowCheckpointReviewOutput'
  | 'workflowApproveContinue'
  | 'workflowSubmitModifiedContinue'
  | 'workflowModify'
  | 'workflowReject'

export type Translations = Record<WorkflowKeys, string>

export const zhWorkflow: Translations = {
  workflowTitle: '工作流',
  workflowBackToList: '返回列表',
  workflowCreateNew: '+ 新建工作流',
  workflowUnnamed: '未命名工作流',
  workflowStepCount: '{count} 个步骤',
  workflowDelete: '删除',
  workflowRun: '运行',
  workflowEmpty: '暂无工作流',
  workflowLoading: '加载中...',
  workflowNamePlaceholder: '工作流名称',
  workflowDescriptionPlaceholder: '描述',
  workflowSteps: '步骤',
  workflowAddStep: '+ 添加步骤',
  workflowUnnamedStep: '未命名步骤',
  workflowModeLabel: '模式',
  workflowModeWriting: '写作',
  workflowModeAnalysis: '分析',
  workflowModeEvaluation: '评估',
  workflowModeCustom: '自定义',
  workflowPromptLabel: '提示词',
  workflowPromptPlaceholder: '步骤提示词',
  workflowInputSourceLabel: '输入来源',
  workflowInputPreviousStep: '上一步输出',
  workflowInputChapterContent: '章节内容',
  workflowInputStoryBible: '故事设定',
  workflowInputOutline: '大纲',
  workflowCheckpointLabel: '检查点',
  workflowCheckpointNone: '无',
  workflowCheckpointReview: '审阅',
  workflowCheckpointApprove: '批准',
  workflowEnableStep: '启用此步骤',
  workflowSave: '保存工作流',
  workflowConfirmDelete: '确认删除此工作流？',
  workflowConfirmDeleteYes: '删除',
  workflowConfirmDeleteNo: '取消',
  workflowExecutionStep: '步骤 {step}',
  workflowCheckpointReviewOutput: '检查点 — 审阅输出',
  workflowApproveContinue: '批准继续',
  workflowSubmitModifiedContinue: '提交修改并继续',
  workflowModify: '修改',
  workflowReject: '拒绝',
}

export const enWorkflow: Translations = {
  workflowTitle: 'Workflows',
  workflowBackToList: 'Back to list',
  workflowCreateNew: '+ New workflow',
  workflowUnnamed: 'Unnamed workflow',
  workflowStepCount: '{count} steps',
  workflowDelete: 'Delete',
  workflowRun: 'Run',
  workflowEmpty: 'No workflows yet',
  workflowLoading: 'Loading...',
  workflowNamePlaceholder: 'Workflow name',
  workflowDescriptionPlaceholder: 'Description',
  workflowSteps: 'Steps',
  workflowAddStep: '+ Add step',
  workflowUnnamedStep: 'Unnamed step',
  workflowModeLabel: 'Mode',
  workflowModeWriting: 'Writing',
  workflowModeAnalysis: 'Analysis',
  workflowModeEvaluation: 'Evaluation',
  workflowModeCustom: 'Custom',
  workflowPromptLabel: 'Prompt',
  workflowPromptPlaceholder: 'Step prompt',
  workflowInputSourceLabel: 'Input source',
  workflowInputPreviousStep: 'Previous step output',
  workflowInputChapterContent: 'Chapter content',
  workflowInputStoryBible: 'Story bible',
  workflowInputOutline: 'Outline',
  workflowCheckpointLabel: 'Checkpoint',
  workflowCheckpointNone: 'None',
  workflowCheckpointReview: 'Review',
  workflowCheckpointApprove: 'Approve',
  workflowEnableStep: 'Enable this step',
  workflowSave: 'Save workflow',
  workflowConfirmDelete: 'Delete this workflow?',
  workflowConfirmDeleteYes: 'Delete',
  workflowConfirmDeleteNo: 'Cancel',
  workflowExecutionStep: 'Step {step}',
  workflowCheckpointReviewOutput: 'Checkpoint — review output',
  workflowApproveContinue: 'Approve & continue',
  workflowSubmitModifiedContinue: 'Submit changes & continue',
  workflowModify: 'Edit',
  workflowReject: 'Reject',
}