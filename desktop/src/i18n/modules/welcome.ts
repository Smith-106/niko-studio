type WelcomeKeys =
  | 'welcomeTitle'
  | 'welcomeStepCreateProject'
  | 'welcomeStepConfigureAI'
  | 'welcomeStepStartWriting'
  | 'welcomeProjectNameLabel'
  | 'welcomeProjectNamePlaceholder'
  | 'welcomeCreateProject'
  | 'welcomeCreateFromTemplate'
  | 'welcomeTemplateChars'
  | 'welcomeTemplateChapters'
  | 'welcomeTemplateSelectedHint'
  | 'welcomeAIExplanation'
  | 'welcomeProviderLabel'
  | 'welcomeApiKeyLabel'
  | 'welcomeApiKeyPlaceholder'
  | 'welcomeSaveAndContinue'
  | 'welcomeSkipAI'
  | 'welcomeAllSetTitle'
  | 'welcomeAllSetDescription'
  | 'welcomeTipSlash'
  | 'welcomeTipSave'
  | 'welcomeTipShortcuts'
  | 'welcomeStartWriting'

export type Translations = Record<WelcomeKeys, string>

export const zhWelcome: Translations = {
  welcomeTitle: '欢迎使用 Niko Studio',
  welcomeStepCreateProject: '创建项目',
  welcomeStepConfigureAI: '配置 AI',
  welcomeStepStartWriting: '开始写作',
  welcomeProjectNameLabel: '小说名称',
  welcomeProjectNamePlaceholder: '输入你的小说名称...',
  welcomeCreateProject: '创建项目',
  welcomeCreateFromTemplate: '从模板创建 / Create from Template',
  welcomeTemplateChars: '角色',
  welcomeTemplateChapters: '章',
  welcomeTemplateSelectedHint: '将创建「{name}」项目，包含 {chars} 个角色和 {chapters} 个章节大纲',
  welcomeAIExplanation: 'AI 写作助手需要配置 LLM 提供商才能使用。你也可以稍后在设置中配置。',
  welcomeProviderLabel: '选择提供商',
  welcomeApiKeyLabel: 'API Key',
  welcomeApiKeyPlaceholder: 'sk-...',
  welcomeSaveAndContinue: '保存并继续',
  welcomeSkipAI: '跳过，稍后配置',
  welcomeAllSetTitle: '一切就绪！',
  welcomeAllSetDescription: '你的写作环境已准备完毕，现在可以开始创作了。',
  welcomeTipSlash: '输入 / 触发 AI 命令',
  welcomeTipSave: 'Ctrl+S 保存当前内容',
  welcomeTipShortcuts: 'Ctrl+/ 查看所有快捷键',
  welcomeStartWriting: '开始写作',
}

export const enWelcome: Translations = {
  welcomeTitle: 'Welcome to Niko Studio',
  welcomeStepCreateProject: 'Create Project',
  welcomeStepConfigureAI: 'Configure AI',
  welcomeStepStartWriting: 'Start Writing',
  welcomeProjectNameLabel: 'Novel Name',
  welcomeProjectNamePlaceholder: 'Enter your novel name...',
  welcomeCreateProject: 'Create Project',
  welcomeCreateFromTemplate: 'Create from Template',
  welcomeTemplateChars: 'chars',
  welcomeTemplateChapters: 'ch',
  welcomeTemplateSelectedHint: 'Will create "{name}" project with {chars} characters and {chapters} chapter outlines',
  welcomeAIExplanation: 'The AI writing assistant requires an LLM provider to work. You can also configure this later in Settings.',
  welcomeProviderLabel: 'Select Provider',
  welcomeApiKeyLabel: 'API Key',
  welcomeApiKeyPlaceholder: 'sk-...',
  welcomeSaveAndContinue: 'Save & Continue',
  welcomeSkipAI: 'Skip, configure later',
  welcomeAllSetTitle: "You're all set!",
  welcomeAllSetDescription: 'Your writing environment is ready. Time to start creating.',
  welcomeTipSlash: 'Type / to trigger AI commands',
  welcomeTipSave: 'Ctrl+S to save current content',
  welcomeTipShortcuts: 'Ctrl+/ to view all shortcuts',
  welcomeStartWriting: 'Start Writing',
}