import type { Template, TemplatePlaceholder } from '../../types/template'

const ph = (name: string, label: string, defaultValue: string, type: TemplatePlaceholder['type'] = 'text', options?: string[]): TemplatePlaceholder => ({
  name, label, defaultValue, type, options,
})

export const basicChapter: Template = {
  id: 'builtin-basic-chapter',
  title: '基础章节',
  description: '标准章节结构，适用于大多数叙事场景',
  category: 'structure',
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '{{chapter_title}}' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{opening_paragraph}}' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '正文' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{main_content}}' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '章节小结' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{closing_paragraph}}' }] },
    ],
  },
  placeholders: [
    ph('chapter_title', '章节标题', '新章节'),
    ph('opening_paragraph', '开篇段落', '在此输入开篇内容...'),
    ph('main_content', '正文内容', '在此输入正文...'),
    ph('closing_paragraph', '结尾段落', '在此输入结尾内容...'),
  ],
  isBuiltIn: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

export const threeAct: Template = {
  id: 'builtin-three-act',
  title: '三幕结构',
  description: '经典三幕剧结构：建置、对抗、结局',
  category: 'structure',
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '{{chapter_title}}' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '第一幕：建置' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{setup_content}}' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '第二幕：对抗' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{confrontation_content}}' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '第三幕：结局' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{resolution_content}}' }] },
    ],
  },
  placeholders: [
    ph('chapter_title', '章节标题', '新章节'),
    ph('setup_content', '建置内容', '介绍人物、背景和初始冲突...'),
    ph('confrontation_content', '对抗内容', '冲突升级、转折和挑战...'),
    ph('resolution_content', '结局内容', '冲突解决和收尾...'),
  ],
  isBuiltIn: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

export const heroJourney: Template = {
  id: 'builtin-hero-journey',
  title: '英雄之旅',
  description: '基于约瑟夫·坎贝尔英雄之旅结构的叙事模板',
  category: 'genre',
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '{{chapter_title}}' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '召唤' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{call_to_adventure}}' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '试炼' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{trials_content}}' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '蜕变' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{transformation_content}}' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '归来' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{return_content}}' }] },
    ],
  },
  placeholders: [
    ph('chapter_title', '章节标题', '新章节'),
    ph('call_to_adventure', '冒险召唤', '主角收到冒险的召唤...'),
    ph('trials_content', '试炼经历', '主角面对的挑战和考验...'),
    ph('transformation_content', '蜕变过程', '主角经历转变和成长...'),
    ph('return_content', '归来', '主角带着收获归来...'),
  ],
  isBuiltIn: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

export const parallelTimeline: Template = {
  id: 'builtin-parallel-timeline',
  title: '平行时间线',
  description: '多条时间线交织叙事结构',
  category: 'format',
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '{{chapter_title}}' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '时间线 A：{{timeline_a_label}}' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{timeline_a_content}}' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '时间线 B：{{timeline_b_label}}' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{timeline_b_content}}' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '交汇点' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{convergence_content}}' }] },
    ],
  },
  placeholders: [
    ph('chapter_title', '章节标题', '新章节'),
    ph('timeline_a_label', '时间线 A 标签', '现在'),
    ph('timeline_a_content', '时间线 A 内容', '时间线 A 的故事...'),
    ph('timeline_b_label', '时间线 B 标签', '过去'),
    ph('timeline_b_content', '时间线 B 内容', '时间线 B 的故事...'),
    ph('convergence_content', '交汇内容', '两条时间线在此交汇...'),
  ],
  isBuiltIn: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

export const epistolary: Template = {
  id: 'builtin-epistolary',
  title: '书信体',
  description: '以书信、日记、文件等形式展开叙事',
  category: 'format',
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '{{chapter_title}}' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{sender}} · {{date}}' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '{{letter_content}}' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '—— {{sign_off}}' }] },
    ],
  },
  placeholders: [
    ph('chapter_title', '章节标题', '新章节'),
    ph('sender', '发送者', '作者'),
    ph('date', '日期', '某年某月某日'),
    ph('letter_content', '书信内容', '亲爱的读者...'),
    ph('sign_off', '署名', '此致敬礼'),
  ],
  isBuiltIn: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

export const ALL_BUILTINS: Template[] = [
  basicChapter,
  threeAct,
  heroJourney,
  parallelTimeline,
  epistolary,
]
