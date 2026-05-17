type AppKeys =
  'appTitle'
  | 'serviceRunning'
  | 'serviceOffline'
  | 'contextUsage'
  | 'checkpoint'
  | 'restore'
  | 'restoreSuccess'
  | 'restoreSuccessWithCheckpoint'
  | 'restoreFailed'
  | 'loadingCheckpoints'
  | 'noCheckpoints'
  | 'contextEstimated'
  | 'nikoStudio'
  | 'newChat'
  | 'chatList'
  | 'skillPacks'
  | 'knowledgeBase'
  | 'settings'
  | 'skipToMainContent'
  | 'serviceDegraded'
  | 'serviceReconnecting'
  | 'contextUsageLowHint'
  | 'contextUsageMediumHint'
  | 'contextUsageHighHint'
  | 'uiSettings'
  | 'theme'
  | 'themeLight'
  | 'themeDark'
  | 'themeSystem'
  | 'themeSorbet'
  | 'themeSlate'
  | 'themeAmber'
  | 'themeForest'
  | 'themeCharcoal'
  | 'themeCauldron'
  | 'themeAurora'
  | 'themeMoonbeam'
  | 'themeSepia'
  | 'fontSize'
  | 'fontSmall'
  | 'fontMedium'
  | 'fontLarge'
  | 'language'
  | 'langChinese'
  | 'langEnglish'
  | 'sendShortcutLabel'
  | 'sendShortcutEnter'
  | 'sendShortcutCtrlEnter'
  | 'resetDefault'
  | 'cancel'
  | 'save'
  | 'exportSettings'
  | 'importSettings'
  | 'importSuccess'
  | 'importFailed'
  | 'quickPanelTitle'
  | 'quickPanelResultsLabel'
  | 'quickPanelSearchPlaceholder'
  | 'quickPanelNoMatch'
  | 'quickPanelSelect'
  | 'quickPanelConfirm'
  | 'quickPanelClose'
  | 'contentSearchPlaceholder'
  | 'errorBoundaryTitle'
  | 'errorBoundaryDescription'
  | 'errorBoundaryTryAgain'
  | 'errorBoundaryReload'
  | 'streamErrorCategory'
  | 'scrollToBottom'

export type Translations = Record<AppKeys, string>

export const zhApp: Translations = {
  appTitle: '小说创作助手',
  serviceRunning: '可以继续写作',
  serviceOffline: '当前不可用',
  contextUsage: '上下文',
  checkpoint: '还原点',
  restore: '恢复',
  restoreSuccess: '恢复成功',
  restoreSuccessWithCheckpoint: '已恢复到 checkpoint {checkpointId}',
  restoreFailed: '恢复失败',
  loadingCheckpoints: '加载还原点中...',
  noCheckpoints: '暂无还原点',
  contextEstimated: '估算',
  nikoStudio: 'Niko-Studio',
  newChat: '新对话',
  chatList: '对话列表',
  skillPacks: '技能包',
  knowledgeBase: '故事设定',
  settings: '设置',
  skipToMainContent: '跳到主内容',
  serviceDegraded: '部分功能需要重试',
  serviceReconnecting: '正在恢复连接',
  contextUsageLowHint: '上下文余量充足',
  contextUsageMediumHint: '上下文接近上限，建议精简输入',
  contextUsageHighHint: '上下文已接近满载，建议新建对话',
  uiSettings: '界面设置',
  theme: '主题',
  themeLight: '浅色',
  themeDark: '深色',
  themeSystem: '跟随系统',
  themeSorbet: 'Sorbet',
  themeSlate: 'Slate',
  themeAmber: 'Amber',
  themeForest: 'Forest',
  themeCharcoal: 'Charcoal',
  themeCauldron: 'Cauldron',
  themeAurora: 'Aurora',
  themeMoonbeam: 'Moonbeam',
  themeSepia: 'Sepia',
  fontSize: '字体大小',
  fontSmall: '小',
  fontMedium: '中',
  fontLarge: '大',
  language: '语言',
  langChinese: '简体中文',
  langEnglish: 'English',
  sendShortcutLabel: '发送快捷键',
  sendShortcutEnter: 'Enter 发送',
  sendShortcutCtrlEnter: 'Ctrl/Cmd + Enter 发送',
  resetDefault: '重置默认',
  cancel: '取消',
  save: '保存',
  exportSettings: '导出设置',
  importSettings: '导入设置',
  importSuccess: '设置导入成功！',
  importFailed: '导入失败',
  quickPanelTitle: '快捷命令面板',
  quickPanelResultsLabel: '命令结果',
  quickPanelSearchPlaceholder: '搜索命令...',
  quickPanelNoMatch: '无匹配命令',
  quickPanelSelect: '↑↓ 选择',
  quickPanelConfirm: '↵ 确认',
  quickPanelClose: 'ESC 关闭',
  contentSearchPlaceholder: '搜索内容...',
  errorBoundaryTitle: '出了点问题',
  errorBoundaryDescription: '发生了意外错误。',
  errorBoundaryTryAgain: '重试',
  errorBoundaryReload: '重新加载',
  streamErrorCategory: '错误类别',
  scrollToBottom: '滚动到底部',
}

export const enApp: Translations = {
  appTitle: 'Novel Writing Assistant',
  serviceRunning: 'Ready to write',
  serviceOffline: 'Unavailable',
  contextUsage: 'Context',
  checkpoint: 'Checkpoint',
  restore: 'Restore',
  restoreSuccess: 'Restore successful',
  restoreSuccessWithCheckpoint: 'Restored to checkpoint {checkpointId}',
  restoreFailed: 'Restore failed',
  loadingCheckpoints: 'Loading checkpoints...',
  noCheckpoints: 'No checkpoints',
  contextEstimated: 'Estimated',
  nikoStudio: 'Niko-Studio',
  newChat: 'New Chat',
  chatList: 'Conversations',
  skillPacks: 'Skills',
  knowledgeBase: 'Story Notes',
  settings: 'Settings',
  skipToMainContent: 'Skip to main content',
  serviceDegraded: 'Some actions may need retry',
  serviceReconnecting: 'Restoring connection',
  contextUsageLowHint: 'Context budget is healthy',
  contextUsageMediumHint: 'Context usage is rising. Consider shorter prompts',
  contextUsageHighHint: 'Context is near limit. Consider starting a new chat',
  uiSettings: 'UI Settings',
  theme: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeSystem: 'System',
  themeSorbet: 'Sorbet',
  themeSlate: 'Slate',
  themeAmber: 'Amber',
  themeForest: 'Forest',
  themeCharcoal: 'Charcoal',
  themeCauldron: 'Cauldron',
  themeAurora: 'Aurora',
  themeMoonbeam: 'Moonbeam',
  themeSepia: 'Sepia',
  fontSize: 'Font Size',
  fontSmall: 'Small',
  fontMedium: 'Medium',
  fontLarge: 'Large',
  language: 'Language',
  langChinese: '简体中文',
  langEnglish: 'English',
  sendShortcutLabel: 'Send shortcut',
  sendShortcutEnter: 'Enter to send',
  sendShortcutCtrlEnter: 'Ctrl/Cmd + Enter to send',
  resetDefault: 'Reset Default',
  cancel: 'Cancel',
  save: 'Save',
  exportSettings: 'Export Settings',
  importSettings: 'Import Settings',
  importSuccess: 'Settings imported successfully!',
  importFailed: 'Import failed',
  quickPanelTitle: 'Quick command panel',
  quickPanelResultsLabel: 'Command results',
  quickPanelSearchPlaceholder: 'Search commands...',
  quickPanelNoMatch: 'No matching commands',
  quickPanelSelect: '↑↓ Select',
  quickPanelConfirm: '↵ Confirm',
  quickPanelClose: 'ESC Close',
  contentSearchPlaceholder: 'Search content...',
  errorBoundaryTitle: 'Something went wrong',
  errorBoundaryDescription: 'An unexpected error occurred.',
  errorBoundaryTryAgain: 'Try Again',
  errorBoundaryReload: 'Reload Page',
  streamErrorCategory: 'Error Category',
  scrollToBottom: 'Scroll to bottom',
}
