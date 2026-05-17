type EditorKeys =
  'sidebarNewDocument'
  | 'sidebarContinueWriting'
  | 'sidebarDocuments'
  | 'mcpMetricTotal'
  | 'mcpMetricFailed'
  | 'mcpMetricAvgLatency'
  | 'mcpMetricMaxLatency'
  | 'editorWordCount'
  | 'editorCharCount'
  | 'editorReadingTime'
  | 'editorAutoSaved'
  | 'editorPlaceholder'
  | 'editorAiGenerating'
  | 'editorAiCancel'
  | 'editorCmdGenerate'
  | 'editorCmdGenerateDesc'
  | 'editorCmdContinue'
  | 'editorCmdContinueDesc'
  | 'editorCmdFullArticle'
  | 'editorCmdFullArticleDesc'
  | 'editorCmdHeading1'
  | 'editorCmdHeading1Desc'
  | 'editorCmdHeading2'
  | 'editorCmdHeading2Desc'
  | 'editorCmdHeading3'
  | 'editorCmdHeading3Desc'
  | 'editorCmdBulletList'
  | 'editorCmdBulletListDesc'
  | 'editorCmdOrderedList'
  | 'editorCmdOrderedListDesc'
  | 'editorCmdBlockquote'
  | 'editorCmdBlockquoteDesc'
  | 'editorCmdCodeBlock'
  | 'editorCmdCodeBlockDesc'
  | 'editorCmdHorizontalRule'
  | 'editorCmdHorizontalRuleDesc'
  | 'editorBubbleBold'
  | 'editorBubbleItalic'
  | 'editorBubbleStrikethrough'
  | 'editorBubbleRewrite'
  | 'editorBubblePolish'
  | 'editorBubbleSimplify'
  | 'editorBubbleExpand'
  | 'editorBubbleFormal'
  | 'editorBubbleCasual'
  | 'editorBubbleSummarize'
  | 'editorBubbleContinue'
  | 'exportMarkdown'
  | 'exportHtml'
  | 'exportPdf'
  | 'exportDialogTitle'
  | 'exportFilename'
  | 'exportFormat'
  | 'exportButton'
  | 'exportCancel'
  | 'exportHistoryTitle'
  | 'exportHistoryEmpty'
  | 'editorStatusSaving'
  | 'editorStatusSavedAt'
  | 'editorDraftRestored'
  | 'editorDraftRestoredAt'

export type Translations = Record<EditorKeys, string>

export const zhEditor: Translations = {
  sidebarNewDocument: '新建文档',
  sidebarContinueWriting: '继续写作',
  sidebarDocuments: '文档列表',
  mcpMetricTotal: '总请求',
  mcpMetricFailed: '失败',
  mcpMetricAvgLatency: '平均延迟',
  mcpMetricMaxLatency: '最大延迟',
  editorWordCount: '字数',
  editorCharCount: '字符',
  editorReadingTime: '约 {min} 分钟阅读',
  editorAutoSaved: '已保存',
  editorPlaceholder: '输入 / 唤出 AI 命令，或直接开始写作...',
  editorAiGenerating: 'AI 生成中...',
  editorAiCancel: '取消',
  editorCmdGenerate: 'AI 生成段落',
  editorCmdGenerateDesc: '根据上下文生成一段文本',
  editorCmdContinue: 'AI 续写',
  editorCmdContinueDesc: '从当前位置继续写作',
  editorCmdFullArticle: 'AI 生成文章',
  editorCmdFullArticleDesc: '生成一篇完整文章',
  editorCmdHeading1: '标题 1',
  editorCmdHeading1Desc: '大标题',
  editorCmdHeading2: '标题 2',
  editorCmdHeading2Desc: '中标题',
  editorCmdHeading3: '标题 3',
  editorCmdHeading3Desc: '小标题',
  editorCmdBulletList: '无序列表',
  editorCmdBulletListDesc: '创建无序列表',
  editorCmdOrderedList: '有序列表',
  editorCmdOrderedListDesc: '创建有序列表',
  editorCmdBlockquote: '引用',
  editorCmdBlockquoteDesc: '插入引用块',
  editorCmdCodeBlock: '代码块',
  editorCmdCodeBlockDesc: '插入代码块',
  editorCmdHorizontalRule: '分割线',
  editorCmdHorizontalRuleDesc: '插入水平分割线',
  editorBubbleBold: '加粗',
  editorBubbleItalic: '斜体',
  editorBubbleStrikethrough: '删除线',
  editorBubbleRewrite: 'AI 改写',
  editorBubblePolish: '润色',
  editorBubbleSimplify: '简化',
  editorBubbleExpand: '扩写',
  editorBubbleFormal: '正式化',
  editorBubbleCasual: '口语化',
  editorBubbleSummarize: '总结',
  editorBubbleContinue: '续写',
  exportMarkdown: '导出 Markdown',
  exportHtml: '导出 HTML',
  exportPdf: '导出 PDF',
  exportDialogTitle: '导出文档',
  exportFilename: '文件名',
  exportFormat: '格式',
  exportButton: '导出',
  exportCancel: '取消',
  exportHistoryTitle: '最近导出',
  exportHistoryEmpty: '暂无导出记录',
  editorStatusSaving: '保存中...',
  editorStatusSavedAt: '已于 {time} 保存',
  editorDraftRestored: '草稿已恢复',
  editorDraftRestoredAt: '草稿已恢复 — {time}保存',
}

export const enEditor: Translations = {
  sidebarNewDocument: 'New Document',
  sidebarContinueWriting: 'Continue writing',
  sidebarDocuments: 'Documents',
  mcpMetricTotal: 'Total',
  mcpMetricFailed: 'Failed',
  mcpMetricAvgLatency: 'Avg Latency',
  mcpMetricMaxLatency: 'Max Latency',
  editorWordCount: 'Words',
  editorCharCount: 'Chars',
  editorReadingTime: '~{min} min read',
  editorAutoSaved: 'Saved',
  editorPlaceholder: 'Type / for AI commands, or just start writing...',
  editorAiGenerating: 'AI generating...',
  editorAiCancel: 'Cancel',
  editorCmdGenerate: 'AI Generate',
  editorCmdGenerateDesc: 'Generate text based on context',
  editorCmdContinue: 'AI Continue',
  editorCmdContinueDesc: 'Continue writing from cursor',
  editorCmdFullArticle: 'AI Full Article',
  editorCmdFullArticleDesc: 'Generate a complete article',
  editorCmdHeading1: 'Heading 1',
  editorCmdHeading1Desc: 'Large heading',
  editorCmdHeading2: 'Heading 2',
  editorCmdHeading2Desc: 'Medium heading',
  editorCmdHeading3: 'Heading 3',
  editorCmdHeading3Desc: 'Small heading',
  editorCmdBulletList: 'Bullet List',
  editorCmdBulletListDesc: 'Create a bullet list',
  editorCmdOrderedList: 'Ordered List',
  editorCmdOrderedListDesc: 'Create an ordered list',
  editorCmdBlockquote: 'Blockquote',
  editorCmdBlockquoteDesc: 'Insert a blockquote',
  editorCmdCodeBlock: 'Code Block',
  editorCmdCodeBlockDesc: 'Insert a code block',
  editorCmdHorizontalRule: 'Divider',
  editorCmdHorizontalRuleDesc: 'Insert a horizontal rule',
  editorBubbleBold: 'Bold',
  editorBubbleItalic: 'Italic',
  editorBubbleStrikethrough: 'Strikethrough',
  editorBubbleRewrite: 'AI Rewrite',
  editorBubblePolish: 'Polish',
  editorBubbleSimplify: 'Simplify',
  editorBubbleExpand: 'Expand',
  editorBubbleFormal: 'Formal',
  editorBubbleCasual: 'Casual',
  editorBubbleSummarize: 'Summarize',
  editorBubbleContinue: 'Continue',
  exportMarkdown: 'Export Markdown',
  exportHtml: 'Export HTML',
  exportPdf: 'Export PDF',
  exportDialogTitle: 'Export Document',
  exportFilename: 'Filename',
  exportFormat: 'Format',
  exportButton: 'Export',
  exportCancel: 'Cancel',
  exportHistoryTitle: 'Recent Exports',
  exportHistoryEmpty: 'No exports yet',
  editorStatusSaving: 'Saving...',
  editorStatusSavedAt: 'Saved at {time}',
  editorDraftRestored: 'Draft restored',
  editorDraftRestoredAt: 'Draft restored — saved {time}',
}
