/**
 * Writing Craft — Craft Catalog
 *
 * Core writing technique catalog extracted from:
 * - 54 writing craft books (Bell, McKee, Truby, Snyder, 蔡骏, 大泽在昌, etc.)
 * - 191 prompt templates (multi-layer thought chains)
 * - 5 volumes of Chinese web novel research
 *
 * Each technique has a name, source, description, and evaluable criteria
 * that niko-studio's analysis engines can use.
 */

// ============================================================
// Satisfaction Point Patterns (爽点模式)
// Source: 052-进阶技巧-爽点设计 + 爽点宇宙/爽感爆款系统
// ============================================================

export enum SatisfactionPattern {
  POWER_DISPLAY = 'power_display',       // 装逼打脸：对方轻视→主角展示实力→震惊
  HIDDEN_POWER = 'hidden_power',         // 扮猪吃虎：表面弱小→关键时刻爆发→众人惊艳
  UNDERDOG_WIN = 'underdog_win',         // 越级反杀：实力差距→主角逆袭→敌人不可置信
  AUTHORITY_SLAP = 'authority_slap',      // 打脸权威：权威质疑→实力证明→权威认可
  VILLAIN_FAIL = 'villain_fail',         // 反派翻车：反派得意→计划破产→反派狼狈
  SWEET_SURPRISE = 'sweet_surprise',      // 甜蜜超预期：平淡日常→意外惊喜→情感升温
  MYSTERY_SOLVE = 'mystery_solve',       // 真相揭晓：层层铺垫→关键证据→真相大白
  LEVEL_UP = 'level_up',                 // 突破升级：瓶颈积累→顿悟/机缘→实力飞跃
  RECOGNITION = 'recognition',           // 获得认可：被轻视→展现实力→获得承认
  REVENGE = 'revenge',                   // 复仇兑现：受辱→隐忍→全力反击
}

export interface SatisfactionPatternDef {
  pattern: SatisfactionPattern;
  label: string;
  /** 三拍子节奏：铺垫 → 兑现 → 微反转 */
  structure: [string, string, string];
  /** 每拍的大致篇幅比例 */
  proportion: [number, number, number];
  /** 关键词信号 */
  keywords: {
    setup: string[];
    payoff: string[];
    twist: string[];
  };
  /** 信息差类型 */
  informationGap: 'reader_ahead' | 'character_ahead' | 'audience_only' | 'none';
}

export const SATISFACTION_PATTERNS: Record<SatisfactionPattern, SatisfactionPatternDef> = {
  [SatisfactionPattern.POWER_DISPLAY]: {
    pattern: SatisfactionPattern.POWER_DISPLAY,
    label: '装逼打脸',
    structure: ['对方轻视/挑衅', '主角展示碾压实力', '旁观者震惊+对方后悔'],
    proportion: [0.3, 0.4, 0.3],
    keywords: {
      setup: ['不屑', '冷笑', '不过如此', '不自量力', '就这'],
      payoff: ['一击', '秒杀', '碾压', '恐怖如斯', '震惊全场'],
      twist: ['原来', '竟然还', '只是热身', '不过'],
    },
    informationGap: 'reader_ahead',
  },
  [SatisfactionPattern.HIDDEN_POWER]: {
    pattern: SatisfactionPattern.HIDDEN_POWER,
    label: '扮猪吃虎',
    structure: ['主角表面弱小/低调', '关键时刻暴露实力', '所有人重新审视'],
    proportion: [0.35, 0.35, 0.3],
    keywords: {
      setup: ['低调', '平凡', '不起眼', '没什么特别'],
      payoff: ['爆发', '展现', '原来', '隐藏', '竟然是'],
      twist: ['真正的实力', '还没用全力', '不可思议'],
    },
    informationGap: 'reader_ahead',
  },
  [SatisfactionPattern.UNDERDOG_WIN]: {
    pattern: SatisfactionPattern.UNDERDOG_WIN,
    label: '越级反杀',
    structure: ['实力差距明显，所有人看衰', '主角逆袭翻盘', '对手不敢置信'],
    proportion: [0.3, 0.4, 0.3],
    keywords: {
      setup: ['不可能', '差距', '毫无胜算', '送死'],
      payoff: ['逆袭', '翻盘', '战胜', '打破'],
      twist: ['还能更强', '没用全力', '底牌'],
    },
    informationGap: 'none',
  },
  [SatisfactionPattern.AUTHORITY_SLAP]: {
    pattern: SatisfactionPattern.AUTHORITY_SLAP,
    label: '打脸权威',
    structure: ['权威质疑/否定', '主角用实力证明', '权威认可或尴尬'],
    proportion: [0.3, 0.4, 0.3],
    keywords: {
      setup: ['你不懂', '不可能', '凭你', '资格'],
      payoff: ['证明', '做到了', '不可能的事'],
      twist: ['超越', '打脸', '哑口无言'],
    },
    informationGap: 'reader_ahead',
  },
  [SatisfactionPattern.VILLAIN_FAIL]: {
    pattern: SatisfactionPattern.VILLAIN_FAIL,
    label: '反派翻车',
    structure: ['反派得计/得意的巅峰', '计划被破解', '反派狼狈不堪'],
    proportion: [0.3, 0.35, 0.35],
    keywords: {
      setup: ['得意', '以为', '掌控', '计划'],
      payoff: ['破灭', '反被', '自食其果', '计划失败'],
      twist: ['更惨', '连锁崩溃', '恶有恶报'],
    },
    informationGap: 'character_ahead',
  },
  [SatisfactionPattern.SWEET_SURPRISE]: {
    pattern: SatisfactionPattern.SWEET_SURPRISE,
    label: '甜蜜超预期',
    structure: ['平淡日常/小期望', '意外惊喜', '情感升温'],
    proportion: [0.35, 0.35, 0.3],
    keywords: {
      setup: ['以为', '本以为', '只是'],
      payoff: ['惊喜', '没想到', '竟然'],
      twist: ['更甜蜜', '还有', '更特别'],
    },
    informationGap: 'none',
  },
  [SatisfactionPattern.MYSTERY_SOLVE]: {
    pattern: SatisfactionPattern.MYSTERY_SOLVE,
    label: '真相揭晓',
    structure: ['迷团积累到顶点', '关键证据/推理揭露真相', '读者恍然大悟'],
    proportion: [0.4, 0.35, 0.25],
    keywords: {
      setup: ['谜团', '秘密', '疑问', '不解'],
      payoff: ['真相', '原来是', '终于明白', '水落石出'],
      twist: ['更深层的真相', '还有隐情', '不止如此'],
    },
    informationGap: 'character_ahead',
  },
  [SatisfactionPattern.LEVEL_UP]: {
    pattern: SatisfactionPattern.LEVEL_UP,
    label: '突破升级',
    structure: ['瓶颈/修炼/积累', '顿悟或获得机缘', '实力飞跃+众人惊叹'],
    proportion: [0.35, 0.3, 0.35],
    keywords: {
      setup: ['瓶颈', '停滞', '修炼', '积累'],
      payoff: ['突破', '晋级', '觉醒', '进化'],
      twist: ['连升', '超预期', '天才'],
    },
    informationGap: 'none',
  },
  [SatisfactionPattern.RECOGNITION]: {
    pattern: SatisfactionPattern.RECOGNITION,
    label: '获得认可',
    structure: ['被忽视/轻视', '展现实力/价值', '获得承认和尊重'],
    proportion: [0.35, 0.35, 0.3],
    keywords: {
      setup: ['忽视', '看不起', '不屑'],
      payoff: ['刮目相看', '震惊', '佩服'],
      twist: ['成为核心', '被邀请', '获得重用'],
    },
    informationGap: 'none',
  },
  [SatisfactionPattern.REVENGE]: {
    pattern: SatisfactionPattern.REVENGE,
    label: '复仇兑现',
    structure: ['受辱/被害', '隐忍积累', '全力反击'],
    proportion: [0.3, 0.3, 0.4],
    keywords: {
      setup: ['屈辱', '欺压', '失去'],
      payoff: ['反击', '复仇', '清算', '以牙还牙'],
      twist: ['更狠', '加倍奉还', '彻底'],
    },
    informationGap: 'none',
  },
};

// ============================================================
// Foreshadow Types (伏笔类型)
// Source: 053-进阶技巧-悬疑伏笔 + 182-规则怪谈-悬疑伏笔
// ============================================================

export enum ForeshadowCategory {
  IDENTITY = 'identity',     // 身份伏笔：隐藏角色真实身份/关系
  ITEM = 'item',             // 物品伏笔：关键物品的隐藏用途
  DIALOGUE = 'dialogue',     // 台词伏笔：话语的深层含义
  SCENE = 'scene',           // 场景伏笔：场景细节的隐藏信息
  BEHAVIOR = 'behavior',     // 行为伏笔：角色行为的隐藏动机
  RULE = 'rule',             // 规则伏笔：规则中的隐藏逻辑
  WORLD = 'world',           // 世界观伏笔：世界设定的隐藏真相
}

export const FORESHADOW_HIERARCHY = {
  core: { label: '核心伏笔', description: '1-2个关键线索，影响主线剧情', maxCount: 2 },
  subplot: { label: '支线伏笔', description: '2-3个辅助线索，丰富故事层次', maxCount: 3 },
  decorative: { label: '装饰伏笔', description: '2-3个细节线索，增强真实感', maxCount: 3 },
} as const;

export const FORESHADOW_RECOVERY_METHODS = [
  'direct',       // 直接揭示：明确说明伏笔真相
  'progressive',  // 逐步揭示：分步骤揭露
  'accidental',   // 意外揭示：通过意外事件揭露
  'deduction',    // 推理揭示：通过逻辑推理揭露
] as const;

// ============================================================
// Dialogue Rules (对白规则)
// Source: McKee《对白》+ 048-创作阶段-对话与潜台词
// ============================================================

export const DIALOGUE_RULES = {
  /** McKee三功能法则：每句对白应满足至少两个 */
  mckeeThreeFunctions: {
    functions: ['推动情节', '揭示角色', '表达主题', '制造冲突'] as const,
    minimumRequired: 2,
  },
  /** Show don't tell — 用潜台词代替直接说明 */
  showDontTell: {
    badPatterns: ['我很难过', '他很生气', '我很害怕', '我知道你在想什么'],
    goodPatterns: ['动作+沉默', '反问代替回答', '转移话题', '语气变化'],
  },
  /** 每个角色应有独特的说话方式 */
  characterVoiceDifferentiation: {
    dimensions: ['用词习惯', '句式长短', '口头禅', '情绪表达方式', '回避策略'] as const,
  },
} as const;

// ============================================================
// Story Structure Templates
// Source: Bell三幕 + Snyder节拍表 + Truby22步 + 23段故事策略
// ============================================================

export const STORY_STRUCTURES = {
  bell_three_act: {
    name: 'Bell三幕结构',
    beats: [
      { name: '扰动事件', position: 0.15, description: '打破日常平衡' },
      { name: '第一幕转折', position: 0.25, description: '主角被迫踏上旅程' },
      { name: '中点', position: 0.5, description: '虚假胜利或虚假失败' },
      { name: '失去一切', position: 0.75, description: '主角的最低谷' },
      { name: '高潮', position: 0.9, description: '最终决战/揭示' },
    ],
  },
  snyder_beat_sheet: {
    name: 'Snyder节拍表 (Save the Cat)',
    beats: [
      { name: '开场画面', position: 0.01, description: '展示主角的"之前"状态' },
      { name: '铺垫', position: 0.05, description: '建立主角的世界和缺陷' },
      { name: '催化事件', position: 0.1, description: '不可逆的改变事件' },
      { name: '争论', position: 0.15, description: '主角犹豫是否行动' },
      { name: '进入第二幕', position: 0.25, description: '主角做出选择' },
      { name: 'B故事', position: 0.27, description: '副线/感情线开始' },
      { name: '游戏乐趣', position: 0.35, description: '主角在新世界探索' },
      { name: '中点', position: 0.5, description: '虚假胜利或失败' },
      { name: '敌人逼近', position: 0.6, description: '反方力量加强' },
      { name: '失去一切', position: 0.75, description: '一切崩塌' },
      { name: '灵魂黑夜', position: 0.78, description: '主角的内心觉醒' },
      { name: '进入第三幕', position: 0.82, description: '找到解决方案' },
      { name: '高潮', position: 0.92, description: '最终决战' },
      { name: '终场画面', position: 0.99, description: '展示"之后"状态' },
    ],
  },
} as const;

// ============================================================
// Web Novel Reader Psychology
// Source: 爽文时代/爽点宇宙/爽感爆款系统/文运迷楼说/蚂蚁哲学
// ============================================================

export const WEB_NOVEL_PSYCHOLOGY = {
  /** 爽点4层模型 */
  satisfactionLayers: {
    physical: { label: '生理爽', description: '力量碾压、速度感、战斗爽快', keywords: ['碾压', '秒杀', '一击', '恐怖如斯'] },
    psychological: { label: '心理爽', description: '智商碾压、计谋得逞、真相大白', keywords: ['算计', '看穿', '原来如此', '早有预谋'] },
    social: { label: '社交爽', description: '被认可、被尊重、打脸众人', keywords: ['刮目相看', '震惊', '佩服', '目瞪口呆'] },
    achievement: { label: '成就爽', description: '突破、升级、获得、征服', keywords: ['突破', '升级', '获得', '征服'] },
  },

  /** 期待-延迟-释放 节奏 */
  expectDelayRelease: {
    description: '建立期待→制造挫折/延迟→最终兑现释放',
    timing: { expectRatio: 0.3, delayRatio: 0.3, releaseRatio: 0.4 },
  },

  /** 章节钩子类型 */
  chapterHooks: {
    cliffhanger: '在最紧张处断章',
    question: '抛出新问题让读者想知道答案',
    revelation_hint: '暗示即将揭示某个秘密',
    threat: '新的危险/敌人出现',
    promise: '暗示即将到来的满足感',
  },

  /** 留存设计规则 */
  retentionRules: [
    '每章末尾必须有钩子',
    '每3章一个小爽点，每10章一个大爽点',
    '付费卡点前密度最高',
    '黄金三章决定读者留存率',
  ],
} as const;
