type KnowledgeKeys =
  'knowledgeTitle'
  | 'knowledgeClose'
  | 'knowledgeTabCharacters'
  | 'knowledgeTabLocations'
  | 'knowledgeTabPlots'
  | 'knowledgeTabSkills'
  | 'knowledgeTaskLookup'
  | 'knowledgeTaskAugment'
  | 'knowledgeTaskReference'
  | 'knowledgeTaskLookupHint'
  | 'knowledgeTaskAugmentHint'
  | 'knowledgeTaskReferenceHint'
  | 'knowledgeTaskScopeTitle'
  | 'knowledgeTaskScopeEmpty'
  | 'knowledgeTaskBrowseTitle'
  | 'knowledgeTaskBrowseHint'
  | 'knowledgeTaskAugmentMemory'
  | 'knowledgeTaskAugmentSkills'
  | 'knowledgeTaskSkillsHint'
  | 'knowledgeSearchPlaceholder'
  | 'knowledgeTaskMatch'
  | 'knowledgeSkillDetails'
  | 'knowledgeSkillChain'
  | 'knowledgeCurrentSkill'
  | 'knowledgeLoading'
  | 'knowledgeEmpty'
  | 'knowledgeAddPrefix'
  | 'knowledgeNoDescription'
  | 'knowledgeItemFallback'
  | 'knowledgePromoteCanon'
  | 'knowledgePromotingCanon'
  | 'knowledgePromoteCanonSuccess'
  | 'knowledgePromoteCanonFailure'
  | 'knowledgeSkillDetailsLoadFailed'
  | 'knowledgeTemporalTitle'
  | 'knowledgeTemporalEntityPlaceholder'
  | 'knowledgeTemporalAtTimePlaceholder'
  | 'knowledgeTemporalAction'
  | 'knowledgeTemporalEntityRequired'
  | 'knowledgeTemporalLoaded'
  | 'knowledgeCharacterTitle'
  | 'knowledgeCharacterNamePlaceholder'
  | 'knowledgeCharacterAction'
  | 'knowledgeCharacterNameRequired'
  | 'knowledgeCharacterLoaded'
  | 'knowledgeDepthTitle'
  | 'knowledgeDepthAnalyze'
  | 'knowledgeDepthLevel'
  | 'knowledgeDepthScores'
  | 'knowledgeDepthSuggestions'
  | 'knowledgeProfileTitle'
  | 'knowledgeProfileLoad'
  | 'knowledgeProfileNotFound'
  | 'knowledgeRelationshipsTitle'
  | 'knowledgeRelationshipsLoad'
  | 'knowledgeConsistencyTitle'
  | 'knowledgeConsistencyValid'
  | 'knowledgeConsistencyIssues'
  | 'knowledgeForeshadowTitle'
  | 'knowledgeForeshadowStatusPlaceholder'
  | 'knowledgeForeshadowStatusPending'
  | 'knowledgeForeshadowStatusResolved'
  | 'knowledgeForeshadowStatusAll'
  | 'knowledgeForeshadowChapterPlaceholder'
  | 'knowledgeForeshadowAction'
  | 'knowledgeForeshadowsLoaded'
  | 'knowledgeForeshadowPlantDescPlaceholder'
  | 'knowledgeForeshadowPlantAction'
  | 'knowledgeForeshadowHintAction'
  | 'knowledgeForeshadowHarvestAction'
  | 'knowledgeForeshadowPlanted'
  | 'knowledgeForeshadowHinted'
  | 'knowledgeForeshadowHarvested'
  | 'knowledgeForeshadowStatsLoaded'
  | 'knowledgeMemoryTitle'
  | 'knowledgeMemoryContentPlaceholder'
  | 'knowledgeMemoryLayerPlaceholder'
  | 'knowledgeMemoryDimensionPlaceholder'
  | 'knowledgeMemoryEntityPlaceholder'
  | 'knowledgeMemoryTagsPlaceholder'
  | 'knowledgeMemoryAction'
  | 'knowledgeMemoryContentRequired'
  | 'knowledgeMemoryAdded'
  | 'knowledgeRequestFailed'
  | 'intelligenceLoading'
  | 'intelligenceError'
  | 'intelligenceClose'
  | 'intelligenceAll'
  | 'foreshadowTitle'
  | 'foreshadowSummary'
  | 'foreshadowTotal'
  | 'foreshadowPlanted'
  | 'foreshadowHinted'
  | 'foreshadowHarvested'
  | 'foreshadowHints'
  | 'foreshadowImportance'
  | 'foreshadowNoData'
  | 'patternTitle'
  | 'patternOccurrences'
  | 'sessionTitle'
  | 'sessionSummary'
  | 'sessionTotalSessions'
  | 'sessionAvgDuration'
  | 'sessionTotalWords'
  | 'sessionClusters'
  | 'sessionNoData'
  | 'evalDrillTitle'
  | 'evalDrillOverall'
  | 'evalDrillDimensions'
  | 'evalDrillDetailFor'
  | 'evalDrillNoData'
  | 'charRelTitle'
  | 'charRelNoData'

export type Translations = Record<KnowledgeKeys, string>

export const zhKnowledge: Translations = {
  knowledgeTitle: '故事设定',
  knowledgeClose: '关闭故事设定',
  knowledgeTabCharacters: '角色',
  knowledgeTabLocations: '地点',
  knowledgeTabPlots: '剧情',
  knowledgeTabSkills: '技能',
  knowledgeTaskLookup: '查设定',
  knowledgeTaskAugment: '补资料',
  knowledgeTaskReference: '引用资料',
  knowledgeTaskLookupHint: '先查角色、地点和剧情设定，再决定下一步写法。',
  knowledgeTaskAugmentHint: '把新事实、伏笔和补充记忆写回当前项目，技能能力也收在这里。',
  knowledgeTaskReferenceHint: '先锁定这段写作要参考的对象，后续 AI 会优先围绕它继续工作。',
  knowledgeTaskScopeTitle: '当前写作范围',
  knowledgeTaskScopeEmpty: '当前还没有绑定明确项目，先浏览通用资料。',
  knowledgeTaskBrowseTitle: '设定分类',
  knowledgeTaskBrowseHint: '先从角色、地点和剧情里找到你要查看或引用的内容。',
  knowledgeTaskAugmentMemory: '记忆与线索',
  knowledgeTaskAugmentSkills: '技能辅助',
  knowledgeTaskSkillsHint: '技能库作为补资料时的辅助入口保留在这里，不再占用一级导航。',
  knowledgeSearchPlaceholder: '搜索...',
  knowledgeTaskMatch: '任务匹配',
  knowledgeSkillDetails: '技能详情',
  knowledgeSkillChain: '推荐链路',
  knowledgeCurrentSkill: '当前技能：{skillId}',
  knowledgeLoading: '加载中...',
  knowledgeEmpty: '暂无数据',
  knowledgeAddPrefix: '添加',
  knowledgeNoDescription: '暂无描述',
  knowledgeItemFallback: '条目 {index}',
  knowledgePromoteCanon: '提升到 Canon',
  knowledgePromotingCanon: '正在提升到 Canon…',
  knowledgePromoteCanonSuccess: '已将条目提升到 Canon。',
  knowledgePromoteCanonFailure: '提升条目到 Canon 失败。',
  knowledgeSkillDetailsLoadFailed: '加载技能详情失败',
  knowledgeTemporalTitle: '时间事实',
  knowledgeTemporalEntityPlaceholder: '实体ID',
  knowledgeTemporalAtTimePlaceholder: '时间点（可选，ISO 时间）',
  knowledgeTemporalAction: '查询时间事实',
  knowledgeTemporalEntityRequired: '请输入时间事实查询的实体ID。',
  knowledgeTemporalLoaded: '时间事实查询完成。',
  knowledgeCharacterTitle: '角色详情',
  knowledgeCharacterNamePlaceholder: '角色名',
  knowledgeCharacterAction: '查询角色详情',
  knowledgeCharacterNameRequired: '请输入角色名。',
  knowledgeCharacterLoaded: '角色详情加载完成。',
  knowledgeDepthTitle: '深度分析',
  knowledgeDepthAnalyze: '分析深度',
  knowledgeDepthLevel: '深度等级',
  knowledgeDepthScores: '五维评分',
  knowledgeDepthSuggestions: '改进建议',
  knowledgeProfileTitle: '角色档案',
  knowledgeProfileLoad: '加载档案',
  knowledgeProfileNotFound: '未找到角色档案。',
  knowledgeRelationshipsTitle: '关系网络',
  knowledgeRelationshipsLoad: '加载关系',
  knowledgeConsistencyTitle: '一致性检查',
  knowledgeConsistencyValid: '角色一致',
  knowledgeConsistencyIssues: '问题',
  knowledgeForeshadowTitle: '伏笔筛选',
  knowledgeForeshadowStatusPlaceholder: '状态',
  knowledgeForeshadowStatusPending: '待处理',
  knowledgeForeshadowStatusResolved: '已解决',
  knowledgeForeshadowStatusAll: '全部',
  knowledgeForeshadowChapterPlaceholder: '章节',
  knowledgeForeshadowAction: '查询伏笔',
  knowledgeForeshadowsLoaded: '伏笔查询完成。',
  knowledgeForeshadowPlantDescPlaceholder: '伏笔描述',
  knowledgeForeshadowPlantAction: '埋设伏笔',
  knowledgeForeshadowHintAction: '暗示',
  knowledgeForeshadowHarvestAction: '回收',
  knowledgeForeshadowPlanted: '已埋设',
  knowledgeForeshadowHinted: '已暗示',
  knowledgeForeshadowHarvested: '已回收',
  knowledgeForeshadowStatsLoaded: '伏笔统计已加载。',
  knowledgeMemoryTitle: '添加记忆',
  knowledgeMemoryContentPlaceholder: '记忆内容',
  knowledgeMemoryLayerPlaceholder: '会话',
  knowledgeMemoryDimensionPlaceholder: '上下文',
  knowledgeMemoryEntityPlaceholder: '实体ID（可选）',
  knowledgeMemoryTagsPlaceholder: '标签（英文逗号分隔）',
  knowledgeMemoryAction: '添加记忆',
  knowledgeMemoryContentRequired: '请输入记忆内容。',
  knowledgeMemoryAdded: '记忆添加成功。',
  knowledgeRequestFailed: '请求失败，请稍后重试。',
  intelligenceLoading: '加载中…',
  intelligenceError: '加载失败，请稍后重试。',
  intelligenceClose: '关闭',
  intelligenceAll: '全部',
  foreshadowTitle: '伏笔追踪',
  foreshadowSummary: '概览',
  foreshadowTotal: '总计',
  foreshadowPlanted: '已埋设',
  foreshadowHinted: '已暗示',
  foreshadowHarvested: '已回收',
  foreshadowHints: '线索',
  foreshadowImportance: '重要度',
  foreshadowNoData: '暂无伏笔数据 — 在故事中埋设伏笔后这里会自动显示。',
  patternTitle: '叙事模式',
  patternOccurrences: '出现次数',
  sessionTitle: '会话分析',
  sessionSummary: '概览',
  sessionTotalSessions: '总会话',
  sessionAvgDuration: '平均时长',
  sessionTotalWords: '总字数',
  sessionClusters: '话题聚类',
  sessionNoData: '暂无会话数据 — 开始写作后这里会自动显示。',
  evalDrillTitle: '评估详情',
  evalDrillOverall: '综合评分',
  evalDrillDimensions: '维度评分',
  evalDrillDetailFor: '评估详情 —',
  evalDrillNoData: '暂无评估数据 — 完成一次评估后这里会自动显示。',
  charRelTitle: '角色关系',
  charRelNoData: '暂无角色关系 — 添加角色后这里会自动显示。',
}

export const enKnowledge: Translations = {
  knowledgeTitle: 'Story Notes',
  knowledgeClose: 'Close story notes',
  knowledgeTabCharacters: 'Characters',
  knowledgeTabLocations: 'Locations',
  knowledgeTabPlots: 'Plots',
  knowledgeTabSkills: 'Skills',
  knowledgeTaskLookup: 'Look Up',
  knowledgeTaskAugment: 'Add Material',
  knowledgeTaskReference: 'Use References',
  knowledgeTaskLookupHint: 'Check characters, locations, and plot references before deciding the next writing move.',
  knowledgeTaskAugmentHint: 'Add facts, foreshadows, and memory for the current project. Skill tools now live here as a secondary path.',
  knowledgeTaskReferenceHint: 'Lock in the references for this passage first so later AI actions stay anchored to the right material.',
  knowledgeTaskScopeTitle: 'Current writing scope',
  knowledgeTaskScopeEmpty: 'No project scope is bound yet, so the browser is showing general material.',
  knowledgeTaskBrowseTitle: 'Story categories',
  knowledgeTaskBrowseHint: 'Start with characters, locations, or plot threads to find what you want to inspect or cite.',
  knowledgeTaskAugmentMemory: 'Memory and clues',
  knowledgeTaskAugmentSkills: 'Skill support',
  knowledgeTaskSkillsHint: 'The skill library stays available here as a secondary helper instead of competing in the top navigation.',
  knowledgeSearchPlaceholder: 'Search...',
  knowledgeTaskMatch: 'Task Match',
  knowledgeSkillDetails: 'Skill Details',
  knowledgeSkillChain: 'Recommended Chain',
  knowledgeCurrentSkill: 'Current skill: {skillId}',
  knowledgeLoading: 'Loading...',
  knowledgeEmpty: 'No data',
  knowledgeAddPrefix: 'Add',
  knowledgeNoDescription: 'No description',
  knowledgeItemFallback: 'Item {index}',
  knowledgePromoteCanon: 'Promote to Canon',
  knowledgePromotingCanon: 'Promoting to canon…',
  knowledgePromoteCanonSuccess: 'Item promoted to canon.',
  knowledgePromoteCanonFailure: 'Failed to promote item to canon.',
  knowledgeSkillDetailsLoadFailed: 'Failed to load skill details',
  knowledgeTemporalTitle: 'Temporal Facts',
  knowledgeTemporalEntityPlaceholder: 'entity_id',
  knowledgeTemporalAtTimePlaceholder: 'at_time (optional, ISO time)',
  knowledgeTemporalAction: 'Query temporal facts',
  knowledgeTemporalEntityRequired: 'Please enter entity_id for temporal facts query.',
  knowledgeTemporalLoaded: 'Temporal facts loaded.',
  knowledgeCharacterTitle: 'Character Details',
  knowledgeCharacterNamePlaceholder: 'Character name',
  knowledgeCharacterAction: 'Load character details',
  knowledgeCharacterNameRequired: 'Please enter character name.',
  knowledgeCharacterLoaded: 'Character details loaded.',
  knowledgeDepthTitle: 'Depth Analysis',
  knowledgeDepthAnalyze: 'Analyze depth',
  knowledgeDepthLevel: 'Depth Level',
  knowledgeDepthScores: 'Five-Dimension Scores',
  knowledgeDepthSuggestions: 'Suggestions',
  knowledgeProfileTitle: 'Character Profile',
  knowledgeProfileLoad: 'Load profile',
  knowledgeProfileNotFound: 'Character profile not found.',
  knowledgeRelationshipsTitle: 'Relationship Network',
  knowledgeRelationshipsLoad: 'Load relationships',
  knowledgeConsistencyTitle: 'Consistency Check',
  knowledgeConsistencyValid: 'Character is consistent',
  knowledgeConsistencyIssues: 'Issues',
  knowledgeForeshadowTitle: 'Foreshadow Filters',
  knowledgeForeshadowStatusPlaceholder: 'status',
  knowledgeForeshadowStatusPending: 'pending',
  knowledgeForeshadowStatusResolved: 'resolved',
  knowledgeForeshadowStatusAll: 'all',
  knowledgeForeshadowChapterPlaceholder: 'chapter',
  knowledgeForeshadowAction: 'Query foreshadows',
  knowledgeForeshadowsLoaded: 'Foreshadows loaded.',
  knowledgeForeshadowPlantDescPlaceholder: 'Foreshadow description',
  knowledgeForeshadowPlantAction: 'Plant',
  knowledgeForeshadowHintAction: 'Hint',
  knowledgeForeshadowHarvestAction: 'Harvest',
  knowledgeForeshadowPlanted: 'Planted',
  knowledgeForeshadowHinted: 'Hinted',
  knowledgeForeshadowHarvested: 'Harvested',
  knowledgeForeshadowStatsLoaded: 'Foreshadow stats loaded.',
  knowledgeMemoryTitle: 'Add Memory',
  knowledgeMemoryContentPlaceholder: 'Memory content',
  knowledgeMemoryLayerPlaceholder: 'layer',
  knowledgeMemoryDimensionPlaceholder: 'dimension',
  knowledgeMemoryEntityPlaceholder: 'entity_id (optional)',
  knowledgeMemoryTagsPlaceholder: 'tags (comma separated)',
  knowledgeMemoryAction: 'Add memory',
  knowledgeMemoryContentRequired: 'Please enter memory content.',
  knowledgeMemoryAdded: 'Memory added successfully.',
  knowledgeRequestFailed: 'Request failed. Please try again.',
  intelligenceLoading: 'Loading…',
  intelligenceError: 'Failed to load. Please try again.',
  intelligenceClose: 'Close',
  intelligenceAll: 'All',
  foreshadowTitle: 'Foreshadowing Tracker',
  foreshadowSummary: 'Summary',
  foreshadowTotal: 'Total',
  foreshadowPlanted: 'Planted',
  foreshadowHinted: 'Hinted',
  foreshadowHarvested: 'Harvested',
  foreshadowHints: 'Hints',
  foreshadowImportance: 'Importance',
  foreshadowNoData: 'No foreshadowing data yet — plant foreshadowing in your story and it will appear here.',
  patternTitle: 'Narrative Patterns',
  patternOccurrences: 'Occurrences',
  sessionTitle: 'Session Analytics',
  sessionSummary: 'Summary',
  sessionTotalSessions: 'Total Sessions',
  sessionAvgDuration: 'Avg Duration',
  sessionTotalWords: 'Total Words',
  sessionClusters: 'Topic Clusters',
  sessionNoData: 'No session data yet — start writing and sessions will appear here.',
  evalDrillTitle: 'Evaluation Details',
  evalDrillOverall: 'Overall Score',
  evalDrillDimensions: 'Dimension Scores',
  evalDrillDetailFor: 'Evaluation for',
  evalDrillNoData: 'No evaluation data yet — complete an evaluation and results will appear here.',
  charRelTitle: 'Character Relationships',
  charRelNoData: 'No character relationships — add characters to your story first.',
}
