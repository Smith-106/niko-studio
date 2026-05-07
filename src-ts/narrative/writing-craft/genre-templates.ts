/**
 * Writing Craft — Genre Templates
 *
 * 7 web novel genres with genre-specific analysis rules,
 * satisfaction patterns, and structural conventions.
 * Extracted from 191 prompt templates + genre-specific knowledge.
 */

// ============================================================
// Genre Definition
// ============================================================

export enum WebNovelGenre {
  GENERAL = 'general',           // 通用网文
  SLICE_OF_LIFE = 'slice_of_life', // 世情文
  FANTASY = 'fantasy',           // 玄幻小说
  PERIOD_DRAMA = 'period_drama', // 年代剧 (情满四合院)
  MELODRAMA = 'melodrama',       // 狗血女文
  ZHIHU_SHORT = 'zhihu_short',   // 知乎短篇
  RULES_HORROR = 'rules_horror', // 规则怪谈
}

export interface GenreTemplate {
  genre: WebNovelGenre;
  label: string;
  description: string;

  /** Expected satisfaction density (points per 1000 chars) */
  satisfactionDensity: { min: number; optimal: number };

  /** Typical chapter word count range */
  chapterSize: { min: number; max: number };

  /** Hook strength threshold for this genre */
  hookThreshold: number;

  /** Genre-specific satisfaction patterns */
  satisfactionWeights: Record<SatisfactionCategory, number>;

  /** Key structural beats for this genre */
  structuralBeats: StructuralBeat[];

  /** Genre-specific analysis rules */
  analysisRules: string[];

  /** Common clichés to watch for */
  cliches: string[];
}

export enum SatisfactionCategory {
  POWER_FANTASY = 'power_fantasy',
  FACE_SLAPPING = 'face_slapping',
  REVELATION = 'revelation',
  VICTORY = 'victory',
  EMOTIONAL_PAYOFF = 'emotional_payoff',
  ROMANCE = 'romance',
  HORROR = 'horror',
  MYSTERY_SOLVE = 'mystery_solve',
  GROWTH = 'growth',
  SOCIAL = 'social',
}

export interface StructuralBeat {
  name: string;
  positionRange: [number, number];
  description: string;
  required: boolean;
  keywords: string[];
}

// ============================================================
// Genre Templates
// ============================================================

export const GENRE_TEMPLATES: Record<WebNovelGenre, GenreTemplate> = {
  [WebNovelGenre.GENERAL]: {
    genre: WebNovelGenre.GENERAL,
    label: '通用网文',
    description: '通用网络小说，适用于多种题材',
    satisfactionDensity: { min: 1.5, optimal: 3.0 },
    chapterSize: { min: 2000, max: 4000 },
    hookThreshold: 5,
    satisfactionWeights: {
      [SatisfactionCategory.POWER_FANTASY]: 0.2,
      [SatisfactionCategory.FACE_SLAPPING]: 0.2,
      [SatisfactionCategory.REVELATION]: 0.15,
      [SatisfactionCategory.VICTORY]: 0.15,
      [SatisfactionCategory.EMOTIONAL_PAYOFF]: 0.1,
      [SatisfactionCategory.ROMANCE]: 0.05,
      [SatisfactionCategory.HORROR]: 0.0,
      [SatisfactionCategory.MYSTERY_SOLVE]: 0.05,
      [SatisfactionCategory.GROWTH]: 0.05,
      [SatisfactionCategory.SOCIAL]: 0.05,
    },
    structuralBeats: [
      { name: '开篇钩子', positionRange: [0, 0.05], description: '前3段必须抓住读者', required: true, keywords: ['突然', '意外', '发现'] },
      { name: '扰动事件', positionRange: [0.1, 0.2], description: '打破日常平衡', required: true, keywords: ['不料', '然而', '却'] },
      { name: '第一个爽点', positionRange: [0.08, 0.15], description: '黄金三章内必须有满足感', required: true, keywords: ['震惊', '碾压', '终于'] },
      { name: '中点转折', positionRange: [0.45, 0.55], description: '改变故事方向', required: true, keywords: ['原来', '转折', '出人意料'] },
      { name: '失去一切', positionRange: [0.7, 0.8], description: '主角最低谷', required: false, keywords: ['失去', '失败', '绝望'] },
      { name: '高潮决战', positionRange: [0.85, 0.95], description: '最终冲突解决', required: true, keywords: ['决战', '最终', '真相大白'] },
    ],
    analysisRules: [
      '每3000字至少1个爽点',
      '章节末尾必须有钩子（悬念/问题/预告）',
      '对话占比应在30-50%之间',
      '避免连续2章无冲突',
      '黄金三章的钩子强度不低于7分',
    ],
    cliches: [
      '开局就获得无敌金手指',
      '反派无脑挑衅',
      '女主一见钟情',
      '配角全员捧主角',
      '穿越/重生自带前世记忆',
      '主角运气好到离谱',
      '每次危机都有贵人相助',
      '女配全是恶毒反派',
      '打脸过后马上又被打脸',
    ],
  },

  [WebNovelGenre.FANTASY]: {
    genre: WebNovelGenre.FANTASY,
    label: '玄幻小说',
    description: '修仙/升级/战斗为核心的玄幻类小说',
    satisfactionDensity: { min: 2.0, optimal: 4.0 },
    chapterSize: { min: 2500, max: 4000 },
    hookThreshold: 5,
    satisfactionWeights: {
      [SatisfactionCategory.POWER_FANTASY]: 0.3,
      [SatisfactionCategory.FACE_SLAPPING]: 0.2,
      [SatisfactionCategory.REVELATION]: 0.1,
      [SatisfactionCategory.VICTORY]: 0.2,
      [SatisfactionCategory.EMOTIONAL_PAYOFF]: 0.05,
      [SatisfactionCategory.ROMANCE]: 0.03,
      [SatisfactionCategory.HORROR]: 0.0,
      [SatisfactionCategory.MYSTERY_SOLVE]: 0.02,
      [SatisfactionCategory.GROWTH]: 0.05,
      [SatisfactionCategory.SOCIAL]: 0.05,
    },
    structuralBeats: [
      { name: '天赋觉醒/灵根测试', positionRange: [0.0, 0.1], description: '展示主角特殊之处', required: true, keywords: ['觉醒', '灵根', '天赋', '测试'] },
      { name: '第一战', positionRange: [0.1, 0.2], description: '首次展现实力', required: true, keywords: ['战斗', '比试', '对决'] },
      { name: '突破升级', positionRange: [0.2, 0.35], description: '第一次突破境界', required: true, keywords: ['突破', '晋级', '境界'] },
      { name: '势力冲突', positionRange: [0.35, 0.5], description: '卷入更大格局', required: true, keywords: ['宗门', '势力', '门派'] },
      { name: '越级战斗', positionRange: [0.5, 0.65], description: '以弱胜强的核心爽点', required: true, keywords: ['越级', '以弱胜强', '不可思议'] },
      { name: '大秘境/副本', positionRange: [0.65, 0.8], description: '进入秘境获取机缘', required: false, keywords: ['秘境', '遗迹', '宝物'] },
      { name: '巅峰之战', positionRange: [0.85, 0.95], description: '最终决战', required: true, keywords: ['最终', '巅峰', '决战'] },
    ],
    analysisRules: [
      '升级节奏：每5-10章一次小突破，每30-50章一次大突破',
      '战力系统必须一致：不能无理由突破天花板',
      '金手指使用要有代价和限制',
      '战斗场景需要动作细节+内心活动+环境描写三要素',
      '境界差距要明确：越级战斗需要合理解释',
    ],
    cliches: [
      '废柴逆袭天才',
      '拍卖会捡漏',
      '悬崖底获得传承',
      '美女师傅',
      '打脸世家公子',
      '灵根全属性',
      '炼丹必成功',
      '秘境必得宝物',
      '女主冰清玉洁',
      '反派只为衬托主角',
      '越级战斗毫无代价',
    ],
  },

  [WebNovelGenre.RULES_HORROR]: {
    genre: WebNovelGenre.RULES_HORROR,
    label: '规则怪谈',
    description: '以规则系统为核心的恐怖悬疑类小说',
    satisfactionDensity: { min: 1.0, optimal: 2.0 },
    chapterSize: { min: 2000, max: 3500 },
    hookThreshold: 7,
    satisfactionWeights: {
      [SatisfactionCategory.POWER_FANTASY]: 0.05,
      [SatisfactionCategory.FACE_SLAPPING]: 0.05,
      [SatisfactionCategory.REVELATION]: 0.3,
      [SatisfactionCategory.VICTORY]: 0.1,
      [SatisfactionCategory.EMOTIONAL_PAYOFF]: 0.05,
      [SatisfactionCategory.ROMANCE]: 0.0,
      [SatisfactionCategory.HORROR]: 0.25,
      [SatisfactionCategory.MYSTERY_SOLVE]: 0.2,
      [SatisfactionCategory.GROWTH]: 0.0,
      [SatisfactionCategory.SOCIAL]: 0.0,
    },
    structuralBeats: [
      { name: '规则呈现', positionRange: [0.0, 0.1], description: '展示规则/禁忌', required: true, keywords: ['规则', '禁忌', '不允许', '必须'] },
      { name: '首次违规', positionRange: [0.1, 0.25], description: '有人违反规则，展示后果', required: true, keywords: ['违反', '后果', '消失', '死'] },
      { name: '规则漏洞发现', positionRange: [0.25, 0.4], description: '发现隐藏的规则逻辑', required: true, keywords: ['漏洞', '隐藏', '真正', '其实'] },
      { name: '副本深入', positionRange: [0.4, 0.6], description: '进入更深层', required: false, keywords: ['副本', '第二层', '更深处'] },
      { name: '真假规则辨识', positionRange: [0.6, 0.75], description: '区分真假规则', required: true, keywords: ['真假', '伪装', '矛盾'] },
      { name: '真相揭示', positionRange: [0.8, 0.95], description: '规则背后的真相', required: true, keywords: ['真相', '原来', '秘密'] },
    ],
    analysisRules: [
      '规则一致性：所有规则不能互相矛盾',
      '公平线索规则：读者必须有足够线索推理出真相',
      '恐怖节奏：每章至少1个恐怖/诡异元素',
      '规则必须有明确边界：什么能做什么不能做',
      '违反规则的后果必须一致',
      '每个副本有完整的规则体系',
    ],
    cliches: [
      '规则都是废话只有最后一条有用',
      '主角天生免疫一切规则',
      'NPC全是演员',
      '违反规则居然没事',
      '主角第一个就破解所有规则',
      '规则只对配角生效',
      '最后发现是做梦',
    ],
  },

  [WebNovelGenre.MELODRAMA]: {
    genre: WebNovelGenre.MELODRAMA,
    label: '狗血女文',
    description: '以情感冲突为核心的虐恋类小说',
    satisfactionDensity: { min: 1.5, optimal: 3.0 },
    chapterSize: { min: 2000, max: 3500 },
    hookThreshold: 6,
    satisfactionWeights: {
      [SatisfactionCategory.POWER_FANTASY]: 0.0,
      [SatisfactionCategory.FACE_SLAPPING]: 0.1,
      [SatisfactionCategory.REVELATION]: 0.15,
      [SatisfactionCategory.VICTORY]: 0.05,
      [SatisfactionCategory.EMOTIONAL_PAYOFF]: 0.3,
      [SatisfactionCategory.ROMANCE]: 0.2,
      [SatisfactionCategory.HORROR]: 0.0,
      [SatisfactionCategory.MYSTERY_SOLVE]: 0.05,
      [SatisfactionCategory.GROWTH]: 0.1,
      [SatisfactionCategory.SOCIAL]: 0.05,
    },
    structuralBeats: [
      { name: '相遇冲突', positionRange: [0.0, 0.1], description: '男女主冲突性相遇', required: true, keywords: ['碰撞', '误解', '冲突'] },
      { name: '虐点设计', positionRange: [0.15, 0.3], description: '制造情感伤害', required: true, keywords: ['伤害', '背叛', '误会'] },
      { name: '催泪情节', positionRange: [0.3, 0.45], description: '触动读者情感', required: true, keywords: ['眼泪', '心碎', '不舍'] },
      { name: '反转设计', positionRange: [0.45, 0.6], description: '颠覆读者认知', required: true, keywords: ['反转', '原来', '真相'] },
      { name: '冲突升级', positionRange: [0.6, 0.75], description: '矛盾最大化', required: true, keywords: ['决裂', '不可能', '绝望'] },
      { name: '甜蜜和解', positionRange: [0.8, 0.95], description: '冲突解决', required: true, keywords: ['终于', '在一起', '原谅'] },
    ],
    analysisRules: [
      '虐甜比应在3:7到4:6之间',
      '每3章至少1个情感高潮',
      '误会必须有合理解释空间',
      '反转需要充分铺垫',
      '虐点设计要能引起共情而非厌烦',
    ],
    cliches: [
      '失忆梗',
      '白月光替身',
      '总裁爱上灰姑娘',
      '假怀孕',
      '车祸导致失忆',
      '闺蜜背叛抢男友',
      '误会从不开口解释',
      '男主永远迟来一步',
      '配角全是恋爱脑',
    ],
  },

  [WebNovelGenre.ZHIHU_SHORT]: {
    genre: WebNovelGenre.ZHIHU_SHORT,
    label: '知乎短篇',
    description: '知乎付费短篇，注重快节奏和付费卡点',
    satisfactionDensity: { min: 2.0, optimal: 5.0 },
    chapterSize: { min: 800, max: 1500 },
    hookThreshold: 8,
    satisfactionWeights: {
      [SatisfactionCategory.POWER_FANTASY]: 0.05,
      [SatisfactionCategory.FACE_SLAPPING]: 0.15,
      [SatisfactionCategory.REVELATION]: 0.3,
      [SatisfactionCategory.VICTORY]: 0.1,
      [SatisfactionCategory.EMOTIONAL_PAYOFF]: 0.15,
      [SatisfactionCategory.ROMANCE]: 0.05,
      [SatisfactionCategory.HORROR]: 0.0,
      [SatisfactionCategory.MYSTERY_SOLVE]: 0.1,
      [SatisfactionCategory.GROWTH]: 0.05,
      [SatisfactionCategory.SOCIAL]: 0.05,
    },
    structuralBeats: [
      { name: '第一人称代入', positionRange: [0.0, 0.05], description: '用第一人称迅速建立代入感', required: true, keywords: ['我', '那天', '事情'] },
      { name: '快速冲突', positionRange: [0.05, 0.15], description: '前300字必须有冲突', required: true, keywords: ['却', '不料', '矛盾'] },
      { name: '冲突升级', positionRange: [0.15, 0.35], description: '矛盾层层升级', required: true, keywords: ['更', '甚至', '竟然'] },
      { name: '付费卡点', positionRange: [0.35, 0.45], description: '在最抓人处设置付费墙', required: true, keywords: ['突然', '就在这时', '却不知道'] },
      { name: '反转揭示', positionRange: [0.6, 0.75], description: '核心反转', required: true, keywords: ['原来', '真相', '其实'] },
      { name: '余韵结尾', positionRange: [0.9, 1.0], description: '留下回味', required: false, keywords: ['后来', '至今', '有时候'] },
    ],
    analysisRules: [
      '前300字必须有强力钩子',
      '付费卡点前的爽点密度要最高',
      '每800字至少1个反转或冲突升级',
      '必须用第一人称叙事',
      '结尾必须有回味空间',
      '节奏要快：短句、快转、不留缓冲',
    ],
    cliches: [
      '开头就是"我叫XXX"',
      '全篇反转没有铺垫',
      '付费后质量断崖下跌',
      '第一段就交代所有背景',
      '反转全靠巧合',
      '结局强行大团圆',
      '每个角色都是棋子',
      '标题党和内容不符',
    ],
  },

  [WebNovelGenre.SLICE_OF_LIFE]: {
    genre: WebNovelGenre.SLICE_OF_LIFE,
    label: '世情文',
    description: '以生活细节和人情世故为核心的现实题材',
    satisfactionDensity: { min: 0.8, optimal: 1.5 },
    chapterSize: { min: 2500, max: 4000 },
    hookThreshold: 4,
    satisfactionWeights: {
      [SatisfactionCategory.POWER_FANTASY]: 0.0,
      [SatisfactionCategory.FACE_SLAPPING]: 0.1,
      [SatisfactionCategory.REVELATION]: 0.1,
      [SatisfactionCategory.VICTORY]: 0.1,
      [SatisfactionCategory.EMOTIONAL_PAYOFF]: 0.3,
      [SatisfactionCategory.ROMANCE]: 0.1,
      [SatisfactionCategory.HORROR]: 0.0,
      [SatisfactionCategory.MYSTERY_SOLVE]: 0.0,
      [SatisfactionCategory.GROWTH]: 0.2,
      [SatisfactionCategory.SOCIAL]: 0.1,
    },
    structuralBeats: [
      { name: '生活场景建立', positionRange: [0.0, 0.1], description: '建立生活氛围', required: true, keywords: ['小区', '菜市场', '邻居'] },
      { name: '人情冲突', positionRange: [0.1, 0.3], description: '人情世故的矛盾', required: true, keywords: ['婆媳', '邻里', '亲戚'] },
      { name: '情感描写', positionRange: [0.3, 0.5], description: '细腻的情感刻画', required: true, keywords: ['心疼', '不舍', '感动'] },
      { name: '世情转折', positionRange: [0.5, 0.7], description: '生活变故', required: false, keywords: ['变故', '困境', '坚持'] },
      { name: '温暖收束', positionRange: [0.8, 0.95], description: '温情解决', required: true, keywords: ['团圆', '温暖', '理解'] },
    ],
    analysisRules: [
      '细节真实性：生活场景必须有足够的真实细节',
      '情感描写要克制而有力',
      '人物关系要有烟火气',
      '避免过于理想化的结局',
    ],
    cliches: [
      '婆媳必吵架',
      '邻居都是好人',
      '结尾大团圆',
      '所有矛盾最后都化解',
      '穷人都善良富人都坏',
      '生活困难必有贵人',
      '坏人最后一定悔改',
    ],
  },

  [WebNovelGenre.PERIOD_DRAMA]: {
    genre: WebNovelGenre.PERIOD_DRAMA,
    label: '年代剧',
    description: '以特定历史年代为背景的写实故事',
    satisfactionDensity: { min: 0.8, optimal: 1.5 },
    chapterSize: { min: 2500, max: 4000 },
    hookThreshold: 4,
    satisfactionWeights: {
      [SatisfactionCategory.POWER_FANTASY]: 0.0,
      [SatisfactionCategory.FACE_SLAPPING]: 0.1,
      [SatisfactionCategory.REVELATION]: 0.05,
      [SatisfactionCategory.VICTORY]: 0.1,
      [SatisfactionCategory.EMOTIONAL_PAYOFF]: 0.3,
      [SatisfactionCategory.ROMANCE]: 0.1,
      [SatisfactionCategory.HORROR]: 0.0,
      [SatisfactionCategory.MYSTERY_SOLVE]: 0.0,
      [SatisfactionCategory.GROWTH]: 0.25,
      [SatisfactionCategory.SOCIAL]: 0.1,
    },
    structuralBeats: [
      { name: '年代感建立', positionRange: [0.0, 0.1], description: '建立年代氛围', required: true, keywords: ['那年', '粮票', '大院'] },
      { name: '年代冲突', positionRange: [0.1, 0.3], description: '特定年代的矛盾', required: true, keywords: ['成分', '户口', '下乡'] },
      { name: '年代感描写', positionRange: [0.3, 0.5], description: '深度时代细节', required: true, keywords: ['自行车', '缝纫机', '收音机'] },
      { name: '时代转折', positionRange: [0.5, 0.7], description: '历史事件影响', required: false, keywords: ['改革开放', '下岗', '进城'] },
      { name: '岁月收束', positionRange: [0.8, 0.95], description: '时代沉淀后的感悟', required: true, keywords: ['回望', '一生', '值得'] },
    ],
    analysisRules: [
      '年代细节准确性：物品/用语/价格必须符合时代',
      '社会背景要有据可查',
      '人物行为要符合年代观念',
      '避免用现代观念评判历史人物',
    ],
    cliches: [
      '穿越带现代知识',
      '所有困难都能靠先知先觉解决',
      '历史人物都对主角另眼相看',
      '用现代观念改造古人',
      '物资匮乏但主角总有余粮',
      '所有女性角色都喜欢主角',
      '政治斗争简单粗暴',
      '主角永远站在道德制高点',
    ],
  },
};

export function getGenreTemplate(genre: WebNovelGenre): GenreTemplate {
  return GENRE_TEMPLATES[genre] ?? GENRE_TEMPLATES[WebNovelGenre.GENERAL];
}
