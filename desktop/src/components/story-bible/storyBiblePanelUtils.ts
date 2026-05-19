import {
  isStyleId,
  loadFromStorage,
  STORY_BIBLE_DRAFT_VERSION,
  STORY_BIBLE_STORAGE_KEYS,
  type StoryBibleDraftPayload,
} from './storyBibleDraftUtils'

export const GENRE_PRESETS_ZH = ['奇幻', '言情', '悬疑', '科幻', '恐怖', '历史', '武侠', '都市', '青春', '冒险', '宫斗', '末世', '仙侠', '推理', '轻小说']

export type StyleId = 'tried' | 'matchMy' | 'soundsLike' | 'custom'
export type StoryBibleMessage = { type: 'success' | 'error'; text: string } | null
export type StoryBibleSyncState = 'loading' | 'idle' | 'saving' | 'saved' | 'error'

export function readNarrativeAuthoringCopy(language: 'zh' | 'en') {
  if (language === 'zh') {
    return {
      scene: {
        sectionTitle: '场景',
        titleLabel: '场景标题',
        titlePlaceholder: '输入场景标题',
        summaryLabel: '场景摘要',
        summaryPlaceholder: '记录场景目标、冲突、结果和关键线索。',
        chapterLabel: '章节 ID',
        chapterPlaceholder: 'chapter-1',
        orderLabel: '场次序号',
        orderPlaceholder: '1',
        addLabel: '添加场景',
        saveLabel: '保存场景',
        activateLabel: '设为当前场景',
        activeLabel: '当前场景',
        emptyLabel: '当前工作区还没有场景记录。',
        saveSuccess: '场景已保存到当前工作区。',
        saveError: '保存场景失败，请稍后重试。',
      },
      event: {
        sectionTitle: '事件',
        titleLabel: '事件标题',
        titlePlaceholder: '输入事件标题',
        summaryLabel: '事件摘要',
        summaryPlaceholder: '记录事件触发原因、参与者与后果。',
        sceneLabel: '关联场景 ID',
        scenePlaceholder: 'scene-default-project-opening',
        addLabel: '添加事件',
        saveLabel: '保存事件',
        activateLabel: '设为当前事件',
        activeLabel: '当前事件',
        emptyLabel: '当前工作区还没有事件记录。',
        saveSuccess: '事件已保存到当前工作区。',
        saveError: '保存事件失败，请稍后重试。',
      },
      timeline: {
        sectionTitle: '时间线',
        titleLabel: '时间线标题',
        titlePlaceholder: '输入时间线标题',
        summaryLabel: '时间线摘要',
        summaryPlaceholder: '说明这条时间线覆盖的范围和排序原则。',
        modeLabel: '时间线模式',
        modeStory: '故事时间',
        modeNarrative: '叙事时间',
        addLabel: '添加时间线',
        saveLabel: '保存时间线',
        activateLabel: '设为当前时间线',
        activeLabel: '当前时间线',
        emptyLabel: '当前工作区还没有时间线记录。',
        saveSuccess: '时间线已保存到当前工作区。',
        saveError: '保存时间线失败，请稍后重试。',
      },
    } as const
  }

  return {
    scene: {
      sectionTitle: 'Scenes',
      titleLabel: 'Scene title',
      titlePlaceholder: 'Enter a scene title',
      summaryLabel: 'Scene summary',
      summaryPlaceholder: 'Capture the goal, conflict, outcome, and key clues for this scene.',
      chapterLabel: 'Chapter ID',
      chapterPlaceholder: 'chapter-1',
      orderLabel: 'Scene order',
      orderPlaceholder: '1',
      addLabel: 'Add scene',
      saveLabel: 'Save scene',
      activateLabel: 'Set active scene',
      activeLabel: 'Active scene',
      emptyLabel: 'No scene records exist for this workspace yet.',
      saveSuccess: 'Scene saved to the current workspace.',
      saveError: 'Failed to save the scene. Please try again.',
    },
    event: {
      sectionTitle: 'Events',
      titleLabel: 'Event title',
      titlePlaceholder: 'Enter an event title',
      summaryLabel: 'Event summary',
      summaryPlaceholder: 'Capture the trigger, participants, and aftermath for this event.',
      sceneLabel: 'Related scene ID',
      scenePlaceholder: 'scene-default-project-opening',
      addLabel: 'Add event',
      saveLabel: 'Save event',
      activateLabel: 'Set active event',
      activeLabel: 'Active event',
      emptyLabel: 'No event records exist for this workspace yet.',
      saveSuccess: 'Event saved to the current workspace.',
      saveError: 'Failed to save the event. Please try again.',
    },
    timeline: {
      sectionTitle: 'Timelines',
      titleLabel: 'Timeline title',
      titlePlaceholder: 'Enter a timeline title',
      summaryLabel: 'Timeline summary',
      summaryPlaceholder: 'Describe the ordering principle and coverage for this timeline.',
      modeLabel: 'Timeline mode',
      modeStory: 'Story time',
      modeNarrative: 'Narrative time',
      addLabel: 'Add timeline',
      saveLabel: 'Save timeline',
      activateLabel: 'Set active timeline',
      activeLabel: 'Active timeline',
      emptyLabel: 'No timeline records exist for this workspace yet.',
      saveSuccess: 'Timeline saved to the current workspace.',
      saveError: 'Failed to save the timeline. Please try again.',
    },
  } as const
}

export function buildLegacyDraftPayload(): StoryBibleDraftPayload | null {
  const braindump = loadFromStorage(STORY_BIBLE_STORAGE_KEYS.braindump)
  const genres = loadFromStorage(STORY_BIBLE_STORAGE_KEYS.genres)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  const synopsis = loadFromStorage(STORY_BIBLE_STORAGE_KEYS.synopsis)
  const outline = loadFromStorage(STORY_BIBLE_STORAGE_KEYS.outline)
  const style = loadFromStorage(STORY_BIBLE_STORAGE_KEYS.style)

  if (!braindump && genres.length === 0 && !synopsis && !outline && !style) {
    return null
  }

  return {
    version: STORY_BIBLE_DRAFT_VERSION,
    kind: 'story-bible-local-draft',
    exportedAt: new Date().toISOString(),
    draft: {
      braindump,
      genres,
      synopsis,
      outline,
      style: isStyleId(style) ? style : 'tried',
    },
  }
}

export function readSyncCopy(language: 'zh' | 'en', state: StoryBibleSyncState): string {
  if (language === 'zh') {
    switch (state) {
      case 'loading':
        return '正在加载工作区 Story Bible...'
      case 'saving':
        return '正在同步到当前工作区...'
      case 'saved':
        return '已同步到当前工作区'
      case 'error':
        return '同步失败，请稍后重试'
      default:
        return '等待新的工作区改动'
    }
  }

  switch (state) {
    case 'loading':
      return 'Loading workspace Story Bible...'
    case 'saving':
      return 'Syncing to the active workspace...'
    case 'saved':
      return 'Synced to the active workspace'
    case 'error':
      return 'Sync failed. Please try again.'
    default:
      return 'Waiting for workspace edits'
  }
}

export function readCanonCopy(language: 'zh' | 'en') {
  if (language === 'zh') {
    return {
      promoteSynopsis: '提升概要到 Canon',
      promoteSuccess: '已将概要提升到 Canon。',
      promoteFailed: '提升概要到 Canon 失败。',
      synopsisRequired: '请先填写概要后再提升到 Canon。',
      reviewTitle: 'Canon Review',
      reviewHint: '显式提升后的 canon 页面会出现在这里，并保持为只读检查视图。',
      reviewRefresh: '刷新 Canon',
      reviewLoading: '正在加载 canon…',
      reviewEmpty: '当前还没有 canon 页面。',
      reviewSelectHint: '选择一个 canon 页面以查看内容。',
      reviewReadFailed: '读取 canon 页面失败。',
      reviewLoadFailed: '刷新 canon 列表失败。',
    } as const
  }

  return {
    promoteSynopsis: 'Promote Synopsis to Canon',
    promoteSuccess: 'Synopsis promoted to canon.',
    promoteFailed: 'Failed to promote synopsis to canon.',
    synopsisRequired: 'Add a synopsis before promoting it to canon.',
    reviewTitle: 'Canon Review',
    reviewHint: 'Promoted canon pages appear here as an inspectable read-only view.',
    reviewRefresh: 'Refresh Canon',
    reviewLoading: 'Loading canon…',
    reviewEmpty: 'No canon pages exist yet.',
    reviewSelectHint: 'Select a canon page to inspect its content.',
    reviewReadFailed: 'Failed to read the selected canon page.',
    reviewLoadFailed: 'Failed to refresh canon pages.',
  } as const
}
