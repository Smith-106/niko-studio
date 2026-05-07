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
// Suspense Subgenres
// Source: H:\写作\悬疑 — 4条学习路径
// ============================================================

export enum SuspenseSubgenre {
  HONKAKU = 'honkaku',           // 本格推理：公平线索、逻辑推演
  SOCIETAL = 'societal',         // 社会派：社会批判、动机深度
  HARD_BOILED = 'hard_boiled',   // 硬汉派：氛围优先、道德灰色
  THRILLER = 'thriller',         // 惊悚悬疑：不可靠叙述者、心理操控
}

export interface SubgenreRules {
  subgenre: SuspenseSubgenre;
  label: string;
  description: string;
  coreRules: string[];
  requiredElements: string[];
  forbiddenElements: string[];
  keywords: { typical: string[]; atypical: string[] };
  referenceWorks: string[];
}

export const SUBGENRE_RULES: Record<SuspenseSubgenre, SubgenreRules> = {
  [SuspenseSubgenre.HONKAKU]: {
    subgenre: SuspenseSubgenre.HONKAKU,
    label: '本格推理',
    description: '以逻辑推理为核心，强调公平线索原则，读者可以和侦探同时推理',
    coreRules: [
      '公平线索规则：所有关键线索必须在揭晓前呈现给读者',
      '逻辑自洽：推理过程必须严格遵循逻辑',
      '不可能犯罪：犯罪手法看似不可能，但有合理解释',
      '密室/暴风雪山庄：封闭空间，有限嫌疑人',
    ],
    requiredElements: ['侦探角色', '公平线索', '推理过程', '逻辑闭环', '嫌疑人列表'],
    forbiddenElements: ['超自然解释', '未呈现的关键线索', '巧合破案', '天降灵感'],
    keywords: {
      typical: ['密室', '不在场证明', '线索', '推理', '嫌疑人', '诡计', '不可能', '真凶', '不在场'],
      atypical: ['超自然', '鬼神', '灵异', '巧合'],
    },
    referenceWorks: ['阿加莎·克里斯蒂《无人生还》', '希区柯克悬念故事全集'],
  },
  [SuspenseSubgenre.SOCIETAL]: {
    subgenre: SuspenseSubgenre.SOCIETAL,
    label: '社会派',
    description: '以社会问题为背景，深入挖掘犯罪动机和人性复杂面',
    coreRules: [
      '社会批判：犯罪动机与社会问题紧密关联',
      '动机深度：每个角色都有复杂的动机，无纯粹善恶',
      '人性描写：重点刻画人物心理和情感',
      '现实背景：故事植根于真实的社会环境',
    ],
    requiredElements: ['社会问题', '复杂动机', '人性描写', '情感深度', '现实感'],
    forbiddenElements: ['纯粹善恶', '脸谱化角色', '脱离社会的犯罪', '无动机的恶'],
    keywords: {
      typical: ['动机', '社会', '不公', '人性', '挣扎', '灰色', '苦衷', '不得已', '为什么'],
      atypical: ['密室', '诡计', '纯粹', '天赋', '超能力'],
    },
    referenceWorks: ['东野圭吾《白夜行》', '山口雅也《生尸之死》'],
  },
  [SuspenseSubgenre.HARD_BOILED]: {
    subgenre: SuspenseSubgenre.HARD_BOILED,
    label: '硬汉派',
    description: '以硬汉侦探为主角，氛围和风格优先，道德灰色地带',
    coreRules: [
      '氛围优先：环境的氛围描写与情节同等重要',
      '硬汉侦探：主角坚韧、独立、有道德底线但不完美',
      '道德灰色：没有绝对的正义和邪恶',
      '暴力美学：动作和暴力描写直接而有力',
      '第一人称：通常使用第一人称叙事',
    ],
    requiredElements: ['硬汉主角', '氛围描写', '道德灰色', '城市/黑暗背景', '暴力元素'],
    forbiddenElements: ['温情过度', '纯粹正义', '完美主角', '轻松愉快'],
    keywords: {
      typical: ['侦探', '黑暗', '雨夜', '烟', '酒', '孤独', '正义', '街头', '危险', '枪'],
      atypical: ['温馨', '阳光', '纯粹', '天真'],
    },
    referenceWorks: ['雷蒙德·钱德勒《漫长的告别》'],
  },
  [SuspenseSubgenre.THRILLER]: {
    subgenre: SuspenseSubgenre.THRILLER,
    label: '惊悚悬疑',
    description: '以心理操控和叙述欺骗为核心，读者无法确定叙事者的可靠性',
    coreRules: [
      '不可靠叙述者：叙事者可能隐瞒、歪曲或遗忘事实',
      '心理操控：通过信息控制操控读者的判断',
      '反转设计：至少一个颠覆性的重大反转',
      '选择性叙述：关键信息被故意延迟或隐藏',
    ],
    requiredElements: ['不可靠叙述', '心理操控', '重大反转', '信息不对称', '悬念持续'],
    forbiddenElements: ['完全可靠的叙述者', '无反转', '线形叙事', '透明信息'],
    keywords: {
      typical: ['原来', '没想到', '被骗', '不可信', '记忆', '谎言', '反转', '真相', '隐藏'],
      atypical: ['透明', '直接', '简单', '明确'],
    },
    referenceWorks: ['吉莉安·弗琳《消失的爱人》'],
  },
};

// ============================================================
// Narrative Techniques (Frey高级叙事技巧)
// Source: Frey《劲爆小说秘境游走》+《悬疑小说创作指导》
// ============================================================

export enum NarrativeTechnique {
  ESCALATION_LADDER = 'escalation_ladder',
  REVERSAL_TIMING = 'reversal_timing',
  MULTI_THREAD_WEAVING = 'multi_thread_weaving',
  READER_MANIPULATION = 'reader_manipulation',
  FALSE_RESOLUTION = 'false_resolution',
  TICKING_CLOCK = 'ticking_clock',
  RED_HERRING = 'red_herring',
  DRAMATIC_IRONY = 'dramatic_irony',
}

export interface NarrativeTechniqueDef {
  technique: NarrativeTechnique;
  label: string;
  description: string;
  source: string;
  detectionKeywords: string[];
  effectDescription: string;
  applicationContext: string[];
}

export const NARRATIVE_TECHNIQUES: Record<NarrativeTechnique, NarrativeTechniqueDef> = {
  [NarrativeTechnique.ESCALATION_LADDER]: {
    technique: NarrativeTechnique.ESCALATION_LADDER,
    label: '升级阶梯',
    description: '威胁或冲突按阶梯式逐步升级，每一级都比前一级更危险，让读者的紧张感持续攀升',
    source: 'Frey《劲爆小说秘境游走》',
    detectionKeywords: ['升级', '更加', '进一步', '恶化', '加剧', '层层'],
    effectDescription: '制造持续递增的紧张感，让读者无法放松',
    applicationContext: ['悬疑', '恐怖', '动作', '灾难'],
  },
  [NarrativeTechnique.REVERSAL_TIMING]: {
    technique: NarrativeTechnique.REVERSAL_TIMING,
    label: '反转时机',
    description: '精准控制反转的时机——在读者预期反转时推迟，在读者放松时突袭',
    source: 'Frey《悬疑小说创作指导》',
    detectionKeywords: ['原来', '竟然', '没想到', '反转', '出乎意料', '突然'],
    effectDescription: '打破读者预期，制造最大的心理冲击力',
    applicationContext: ['推理', '悬疑', '惊悚', '所有类型'],
  },
  [NarrativeTechnique.MULTI_THREAD_WEAVING]: {
    technique: NarrativeTechnique.MULTI_THREAD_WEAVING,
    label: '多线编织',
    description: '多条叙事线在关键节点交汇，每条线单独推进但互相关联，最终编织成一个整体',
    source: 'Frey《劲爆小说秘境游走》',
    detectionKeywords: ['同时', '另一边', '视角切换', '回到', '与此同时', '交替'],
    effectDescription: '增加故事层次感和复杂度，多线交汇时产生倍增的戏剧效果',
    applicationContext: ['长篇', '史诗', '社会派', '多视角叙事'],
  },
  [NarrativeTechnique.READER_MANIPULATION]: {
    technique: NarrativeTechnique.READER_MANIPULATION,
    label: '读者操控',
    description: '通过选择性呈现信息、控制叙述视角、操控信息落差来引导读者的判断和情绪',
    source: 'Frey《悬疑小说创作指导》',
    detectionKeywords: ['隐瞒', '视角限制', '不知道', '被误导', '以为', '实际'],
    effectDescription: '制造信息不对称，让读者产生特定判断然后在揭示时产生冲击',
    applicationContext: ['推理', '悬疑', '惊悚', '不可靠叙述'],
  },
  [NarrativeTechnique.FALSE_RESOLUTION]: {
    technique: NarrativeTechnique.FALSE_RESOLUTION,
    label: '虚假解决',
    description: '在故事中段制造一个看似解决但实际未解决的假结局，让角色和读者暂时放松警惕',
    source: 'Frey《劲爆小说秘境游走》',
    detectionKeywords: ['终于', '一切结束', '以为安全', '风平浪静', '松一口气', '原来还没'],
    effectDescription: '制造"安全"的假象然后打破它，在读者最放松时给予最大冲击',
    applicationContext: ['恐怖', '悬疑', '惊悚', '冒险'],
  },
  [NarrativeTechnique.TICKING_CLOCK]: {
    technique: NarrativeTechnique.TICKING_CLOCK,
    label: '倒计时',
    description: '设置明确的时限，让读者和角色都能感知到时间的紧迫感',
    source: 'Frey《悬疑小说创作指导》',
    detectionKeywords: ['时间', '倒计时', '还剩', '截止', '最后', '来不及', '紧迫'],
    effectDescription: '以时间压力驱动节奏，让叙事自然加速',
    applicationContext: ['惊悚', '动作', '冒险', '所有类型'],
  },
  [NarrativeTechnique.RED_HERRING]: {
    technique: NarrativeTechnique.RED_HERRING,
    label: '红鲱鱼',
    description: '在叙事中故意布置误导性线索，将读者引向错误的结论',
    source: 'Frey《劲爆小说秘境游走》',
    detectionKeywords: ['怀疑', '误导', '线索', '看似', '指向', '嫌疑', '假象'],
    effectDescription: '保护真正的谜底，同时增加解谜的趣味性和反转力度',
    applicationContext: ['推理', '侦探', '悬疑', '间谍'],
  },
  [NarrativeTechnique.DRAMATIC_IRONY]: {
    technique: NarrativeTechnique.DRAMATIC_IRONY,
    label: '戏剧反讽',
    description: '读者知道角色所不知道的信息，让读者为角色的无知感到焦虑或期待',
    source: 'Frey《劲爆小说秘境游走》',
    detectionKeywords: ['读者知道', '只有他不知道', '还在以为', '其实已经', '暗中', '浑然不觉'],
    effectDescription: '制造"观众知情"的紧张感，读者在屏幕外为角色呐喊',
    applicationContext: ['悬疑', '悲剧', '喜剧', '所有类型'],
  },
};

// ============================================================
// Genre Beat Templates (救猫咪2类型片节拍)
// Source: Snyder《救猫咪2经典电影剧本解析》
// ============================================================

export enum GenreBeatType {
  MONSTER_IN_THE_HOUSE = 'monster_in_the_house',
  GOLDEN_FLEECE = 'golden_fleece',
  OUT_OF_THE_BOTTLE = 'out_of_the_bottle',
  DUDE_WITH_PROBLEM = 'dude_with_problem',
  RITES_OF_PASSAGE = 'rites_of_passage',
  BUDDY_LOVE = 'buddy_love',
  WHYDUNIT = 'whydunit',
  FOOL_TRIUMPHANT = 'fool_triumphant',
  INSTITUTIONALIZED = 'institutionalized',
  SUPERHERO = 'superhero',
}

export interface GenreBeatTemplate {
  genreType: GenreBeatType;
  label: string;
  description: string;
  beatSequence: { name: string; position: number; description: string; required: boolean }[];
  characterArchetypes: string[];
  keyScenes: string[];
  typicalKeywords: string[];
}

export const GENRE_BEATS: Record<GenreBeatType, GenreBeatTemplate> = {
  [GenreBeatType.MONSTER_IN_THE_HOUSE]: {
    genreType: GenreBeatType.MONSTER_IN_THE_HOUSE,
    label: '屋里有怪物',
    description: '封闭空间+隐藏的怪物/杀手。核心规则：封闭空间不能轻易离开；怪物必须杀人或有致命威胁；罪人设定——角色有原罪',
    beatSequence: [
      { name: '开场画面', position: 0.01, description: '展示封闭空间和日常状态', required: true },
      { name: '铺垫', position: 0.05, description: '建立角色关系和隐藏的罪', required: true },
      { name: '催化事件', position: 0.1, description: '第一起死亡或怪物出现', required: true },
      { name: '争论', position: 0.15, description: '角色犹豫是否相信危险存在', required: false },
      { name: '进入第二幕', position: 0.25, description: '决定对抗/逃亡', required: true },
      { name: '游戏乐趣', position: 0.35, description: '逐一被怪物猎杀', required: true },
      { name: '中点', position: 0.5, description: '怪物真正的力量和罪被揭露', required: true },
      { name: '敌人逼近', position: 0.6, description: '怪物力量加强，空间进一步封闭', required: true },
      { name: '失去一切', position: 0.75, description: '最后希望破灭', required: true },
      { name: '高潮', position: 0.92, description: '直面怪物，利用罪的力量反杀', required: true },
      { name: '终场画面', position: 0.99, description: '生存者状态，罪被偿还', required: false },
    ],
    characterArchetypes: ['罪人/幸存者', '怪物/杀手', '怀疑论者', '祭品角色', '知情者'],
    keyScenes: ['封闭空间建立', '第一次袭击', '怀疑者被说服/被杀', '怪物动机揭露', '最终反杀'],
    typicalKeywords: ['封闭', '怪物', '逃不出去', '死了', '只剩', '罪', '隐藏', '生存', '恐惧', '猎杀'],
  },
  [GenreBeatType.GOLDEN_FLEECE]: {
    genreType: GenreBeatType.GOLDEN_FLEECE,
    label: '金羊毛',
    description: '公路冒险/征途故事。核心规则：旅程比目的地更重要；路上伙伴是成长催化剂；真正的奖赏是自我发现而非目标',
    beatSequence: [
      { name: '开场画面', position: 0.01, description: '主角的平凡/被困状态', required: true },
      { name: '铺垫', position: 0.05, description: '显示主角的缺陷和渴望', required: true },
      { name: '催化事件', position: 0.1, description: '踏上旅程的触发事件', required: true },
      { name: '争论', position: 0.15, description: '犹豫是否出发', required: false },
      { name: '进入第二幕', position: 0.25, description: '正式上路', required: true },
      { name: 'B故事/伙伴', position: 0.27, description: '认识关键伙伴', required: true },
      { name: '游戏乐趣', position: 0.35, description: '路上的奇遇和考验', required: true },
      { name: '中点', position: 0.5, description: '假目标实现/发现真正的目标', required: true },
      { name: '敌人逼近', position: 0.6, description: '追兵或障碍加强', required: false },
      { name: '失去一切', position: 0.75, description: '团队分裂或失去方向', required: true },
      { name: '高潮', position: 0.92, description: '真正目标的达成/自我发现', required: true },
      { name: '终场画面', position: 0.99, description: '回到起点但角色已不同', required: true },
    ],
    characterArchetypes: ['渴望者/旅人', '伙伴', '导师', '追兵', '路上偶遇者'],
    keyScenes: ['出发场景', '伙伴加入', '路上的标志性地点', '假目标实现', '真正目标揭示'],
    typicalKeywords: ['旅程', '出发', '路上', '伙伴', '寻找', '目标', '冒险', '奇遇', '回到', '改变'],
  },
  [GenreBeatType.OUT_OF_THE_BOTTLE]: {
    genreType: GenreBeatType.OUT_OF_THE_BOTTLE,
    label: '瓶子里的妖怪',
    description: '愿望实现/诅咒。核心规则：愿望必须实现但附带代价；魔法/超能力有规则限制；最终要摆脱愿望的力量而非保留它',
    beatSequence: [
      { name: '开场画面', position: 0.01, description: '主角的不满足状态', required: true },
      { name: '铺垫', position: 0.05, description: '建立主角想要改变的东西', required: true },
      { name: '催化事件', position: 0.1, description: '获得愿望/诅咒', required: true },
      { name: '争论', position: 0.15, description: '试探愿望的真实性', required: false },
      { name: '进入第二幕', position: 0.25, description: '开始使用愿望的力量', required: true },
      { name: '游戏乐趣', position: 0.35, description: '愿望带来好处和乐趣', required: true },
      { name: '中点', position: 0.5, description: '愿望开始显现代价', required: true },
      { name: '敌人逼近', position: 0.6, description: '代价越来越大，失控', required: true },
      { name: '失去一切', position: 0.75, description: '愿望带来的最坏结果', required: true },
      { name: '高潮', position: 0.92, description: '放弃愿望/打破诅咒', required: true },
      { name: '终场画面', position: 0.99, description: '接受原来的自己/生活', required: true },
    ],
    characterArchetypes: ['许愿者', '愿望来源/瓶子', '受益者', '代价承担者', '警告者'],
    keyScenes: ['获得愿望', '第一次使用', '代价初现', '尝试放弃', '最终破除'],
    typicalKeywords: ['愿望', '代价', '诅咒', '魔法', '规则', '失控', '回到', '原来', '放弃', '接受'],
  },
  [GenreBeatType.DUDE_WITH_PROBLEM]: {
    genreType: GenreBeatType.DUDE_WITH_PROBLEM,
    label: '遇到问题的家伙',
    description: '普通人vs极端困境。核心规则：主角能力越普通冲突越精彩；困境必须不断升级；英雄出于生存本能而非英雄主义',
    beatSequence: [
      { name: '开场画面', position: 0.01, description: '普通人的普通生活', required: true },
      { name: '铺垫', position: 0.05, description: '建立主角的平凡和局限', required: true },
      { name: '催化事件', position: 0.1, description: '问题降临', required: true },
      { name: '争论', position: 0.15, description: '主角试图回避/否认问题', required: true },
      { name: '进入第二幕', position: 0.25, description: '被迫面对问题', required: true },
      { name: '游戏乐趣', position: 0.35, description: '用普通人的智慧对付困境', required: true },
      { name: '中点', position: 0.5, description: '问题比想的更严重', required: true },
      { name: '敌人逼近', position: 0.6, description: '困境全面爆发', required: true },
      { name: '失去一切', position: 0.75, description: '所有退路被封死', required: true },
      { name: '高潮', position: 0.92, description: '以普通人的方式力挽狂澜', required: true },
      { name: '终场画面', position: 0.99, description: '回到普通但有变化的生活', required: true },
    ],
    characterArchetypes: ['普通人', '困境制造者', '帮手', '怀疑者', '背后黑手'],
    keyScenes: ['困境降临', '第一次尝试失败', '升级困境', '绝地反击'],
    typicalKeywords: ['普通', '突然', '没办法', '必须', '不可能', '只好', '拼命', '拼尽', '化解', '回到'],
  },
  [GenreBeatType.RITES_OF_PASSAGE]: {
    genreType: GenreBeatType.RITES_OF_PASSAGE,
    label: '成人礼',
    description: '成长转变。核心规则：主角必须经历"死亡"（象征或实际）才能重生；转变不可逆；导师/向导可以牺牲但不可缺席',
    beatSequence: [
      { name: '开场画面', position: 0.01, description: '主角的少年状态', required: true },
      { name: '铺垫', position: 0.05, description: '显示主角的不成熟', required: true },
      { name: '催化事件', position: 0.1, description: '被迫离开舒适区', required: true },
      { name: '争论', position: 0.15, description: '抗拒成长', required: false },
      { name: '进入第二幕', position: 0.25, description: '接受挑战/进入新世界', required: true },
      { name: 'B故事/导师', position: 0.27, description: '遇到导师', required: true },
      { name: '游戏乐趣', position: 0.35, description: '在新世界摸索学习', required: true },
      { name: '中点', position: 0.5, description: '象征性死亡/重大失败', required: true },
      { name: '敌人逼近', position: 0.6, description: '旧我不断被挑战', required: true },
      { name: '失去一切', position: 0.75, description: '导师可能死亡/旧我彻底崩塌', required: true },
      { name: '高潮', position: 0.92, description: '重生/象征性成年礼', required: true },
      { name: '终场画面', position: 0.99, description: '新我回归', required: true },
    ],
    characterArchetypes: ['成长者', '导师', '对手', '同龄伙伴', '父母角色'],
    keyScenes: ['离开舒适区', '导师传授', '象征性死亡', '独自面对', '重生仪式'],
    typicalKeywords: ['成长', '转变', '以前', '现在', '学会', '懂得', '放下', '成熟', '逝去', '重生'],
  },
  [GenreBeatType.BUDDY_LOVE]: {
    genreType: GenreBeatType.BUDDY_LOVE,
    label: '哥们之爱',
    description: '两个截然不同的角色从冲突到互补。核心规则：两人必须有明显差异；关系曲线：互相讨厌→被迫合作→真正理解→互补',
    beatSequence: [
      { name: '开场画面', position: 0.01, description: '分别展示两人各自的生活', required: true },
      { name: '铺垫', position: 0.05, description: '建立两人性格对比', required: true },
      { name: '催化事件', position: 0.1, description: '被迫相遇/合作', required: true },
      { name: '争论', position: 0.15, description: '互相排斥/争吵', required: true },
      { name: '进入第二幕', position: 0.25, description: '达成暂时联盟', required: true },
      { name: '游戏乐趣', position: 0.35, description: '互补优势显现', required: true },
      { name: '中点', position: 0.5, description: '关系加深但暗藏裂痕', required: true },
      { name: '敌人逼近', position: 0.6, description: '外部压力和内部矛盾', required: true },
      { name: '失去一切', position: 0.75, description: '分裂/决裂', required: true },
      { name: '高潮', position: 0.92, description: '重新联手/互相拯救', required: true },
      { name: '终场画面', position: 0.99, description: '真正的伙伴关系', required: true },
    ],
    characterArchetypes: ['主动者', '被动者/互补者', '催化剂角色', '反对者', '共同敌人'],
    keyScenes: ['初次冲突', '被迫合作', '第一次欣赏对方', '分裂时刻', '重新联手'],
    typicalKeywords: ['搭档', '合作', '看不惯', '只好', '发现', '原来', '分裂', '合力', '彼此', '互补'],
  },
  [GenreBeatType.WHYDUNIT]: {
    genreType: GenreBeatType.WHYDUNIT,
    label: '谁的尸体',
    description: '探寻黑暗人性。核心规则：侦探自身被案件改变；核心问题是"为什么人变成这样"；调查者自身的人性也被审视',
    beatSequence: [
      { name: '开场画面', position: 0.01, description: '调查者的正常状态', required: true },
      { name: '铺垫', position: 0.05, description: '展示调查者的世界观', required: true },
      { name: '催化事件', position: 0.1, description: '案件降临——第一具尸体', required: true },
      { name: '争论', position: 0.15, description: '犹豫是否深入', required: false },
      { name: '进入第二幕', position: 0.25, description: '正式调查开始', required: true },
      { name: '游戏乐趣', position: 0.35, description: '追踪线索，探索嫌疑人', required: true },
      { name: '中点', position: 0.5, description: '触及人性的黑暗面', required: true },
      { name: '敌人逼近', position: 0.6, description: '调查威胁到自己', required: true },
      { name: '失去一切', position: 0.75, description: '调查者自身迷失', required: true },
      { name: '高潮', position: 0.92, description: '揭示人性真相', required: true },
      { name: '终场画面', position: 0.99, description: '调查者被永久改变', required: true },
    ],
    characterArchetypes: ['调查者', '受害者', '嫌疑人', '知情人', '幕后真凶'],
    keyScenes: ['案件发现', '调查者世界观动摇', '人性质疑', '调查者被改变'],
    typicalKeywords: ['为什么', '动机', '人性', '黑暗', '过去', '隐藏', '渐渐', '原先', '改变', '真相'],
  },
  [GenreBeatType.FOOL_TRIUMPHANT]: {
    genreType: GenreBeatType.FOOL_TRIUMPHANT,
    label: '愚者胜',
    description: '被低估的角色最终证明所有人错了。核心规则：主角被世界低估是故事核心；愚者必须以自己的"不聪明"方式获胜；胜利证明的是不同价值的合理性',
    beatSequence: [
      { name: '开场画面', position: 0.01, description: '展示主角被世界忽视', required: true },
      { name: '铺垫', position: 0.05, description: '建立主角的"愚蠢"和世界的"聪明"', required: true },
      { name: '催化事件', position: 0.1, description: '意外的机会', required: true },
      { name: '争论', position: 0.15, description: '主角不确定/被嘲笑', required: true },
      { name: '进入第二幕', position: 0.25, description: '用自己独特的方式行动', required: true },
      { name: '游戏乐趣', position: 0.35, description: '愚者的方法意外有效', required: true },
      { name: '中点', position: 0.5, description: '虚伪胜利/暂时的认可', required: true },
      { name: '敌人逼近', position: 0.6, description: '聪明人的规则开始反击', required: true },
      { name: '失去一切', position: 0.75, description: '被完全否定', required: true },
      { name: '高潮', position: 0.92, description: '以愚者的方式彻底证明', required: true },
      { name: '终场画面', position: 0.99, description: '获得真正的尊重', required: true },
    ],
    characterArchetypes: ['愚者', '嘲笑者', '伪装者/内奸', '真正相信者', '被颠覆者'],
    keyScenes: ['被嘲笑', '意外成果', '被否定', '方式获得胜利'],
    typicalKeywords: ['傻', '天真', '不懂', '嘲笑', '看不起', '竟然', '原来', '证明', '认同', '独特'],
  },
  [GenreBeatType.INSTITUTIONALIZED]: {
    genreType: GenreBeatType.INSTITUTIONALIZED,
    label: '体制内',
    description: '个体vs体制的两难。核心规则：体制有不合理的规则但也有存在的理由；角色必须在改变体制前理解体制；结局是体制微调而非彻底推翻',
    beatSequence: [
      { name: '开场画面', position: 0.01, description: '展示体制和个体的位置', required: true },
      { name: '铺垫', position: 0.05, description: '建立体制的正常/不公', required: true },
      { name: '催化事件', position: 0.1, description: '个体的利益被体制伤害', required: true },
      { name: '争论', position: 0.15, description: '犹豫是否挑战体制', required: true },
      { name: '进入第二幕', position: 0.25, description: '开始挑战/融入体制', required: true },
      { name: '游戏乐趣', position: 0.35, description: '在体制规则下博弈', required: true },
      { name: '中点', position: 0.5, description: '体制奖励个体', required: true },
      { name: '敌人逼近', position: 0.6, description: '体制的反噬', required: true },
      { name: '失去一切', position: 0.75, description: '被体制驱逐/自己选择离开', required: true },
      { name: '高潮', position: 0.92, description: '以体制的方式改变体制', required: true },
      { name: '终场画面', position: 0.99, description: '体制微变/个体获得自主', required: true },
    ],
    characterArchetypes: ['个体/反叛者', '体制代表', '体制受益者', '体制受害者', '调停者'],
    keyScenes: ['体制展示', '个体被伤害', '尝试融入', '被驱逐', '体制改变'],
    typicalKeywords: ['体制', '规则', '服从', '反抗', '融入', '异化', '权力', '选择', '坚守', '适应'],
  },
  [GenreBeatType.SUPERHERO]: {
    genreType: GenreBeatType.SUPERHERO,
    label: '超级英雄',
    description: '能力越大责任越大。核心规则：特殊能力同时是诅咒和孤独之源；真正战斗是与自己内心的对抗；最终必须做出个人牺牲',
    beatSequence: [
      { name: '开场画面', position: 0.01, description: '展示非凡能力和对其的隐藏', required: true },
      { name: '铺垫', position: 0.05, description: '建立能力的孤独', required: true },
      { name: '催化事件', position: 0.1, description: '被迫使用能力/敌人出现', required: true },
      { name: '争论', position: 0.15, description: '犹豫是否承担英雄角色', required: true },
      { name: '进入第二幕', position: 0.25, description: '接受英雄身份', required: true },
      { name: 'B故事/常人身份', position: 0.27, description: '与常人世界的关系', required: true },
      { name: '游戏乐趣', position: 0.35, description: '使用能力的快感和代价', required: true },
      { name: '中点', position: 0.5, description: '能力无法解决根本问题', required: true },
      { name: '敌人逼近', position: 0.6, description: '敌人利用主角的弱点', required: true },
      { name: '失去一切', position: 0.75, description: '能力失去/最重要的东西被夺走', required: true },
      { name: '高潮', position: 0.92, description: '不求能力只求牺牲', required: true },
      { name: '终场画面', position: 0.99, description: '接受孤独/找到平衡', required: true },
    ],
    characterArchetypes: ['英雄', '克星/宿敌', '常人伙伴', '导师', '公众/民众代表'],
    keyScenes: ['能力展示', '拒绝召唤', '第一次公开行动', '敌人反击', '牺牲与孤独'],
    typicalKeywords: ['能力', '责任', '孤独', '敌人', '牺牲', '保护', '害怕', '必须', '普通人', '隐藏'],
  },
};

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
  truby_22_steps: {
    name: 'Truby 22步 (故事写作大师班)',
    beats: [
      { name: '1.幽灵/过去伤口', position: 0.02, description: '主角过去的创伤，影响当前行为' },
      { name: '2.故事世界', position: 0.04, description: '建立故事发生的环境和规则' },
      { name: '3.需求/弱点', position: 0.06, description: '主角的心理弱点，需要弥补的缺陷' },
      { name: '4.引发事件', position: 0.08, description: '打破平衡的外部事件' },
      { name: '5.欲望', position: 0.1, description: '主角明确的目标和追求' },
      { name: '6.对手', position: 0.12, description: '直接阻碍主角的核心对手' },
      { name: '7.计划', position: 0.15, description: '主角的初步行动计划' },
      { name: '8.盟友', position: 0.17, description: '帮助主角的角色' },
      { name: '9.对手的盟友', position: 0.19, description: '帮助对手的角色' },
      { name: '10.第一次揭露', position: 0.22, description: '主角获得新信息，认知改变' },
      { name: '11.驱动欲望', position: 0.26, description: '更强的行动动力' },
      { name: '12.盟友的攻击', position: 0.3, description: '盟友质疑主角的计划' },
      { name: '13.转向揭露', position: 0.35, description: '重大信息揭示，改变方向' },
      { name: '14.看似落败', position: 0.4, description: '主角的虚假失败' },
      { name: '15.批评者的抱怨', position: 0.44, description: '他人对主角的质疑和反对' },
      { name: '16.看似胜利', position: 0.48, description: '主角的虚假成功' },
      { name: '17.失控暴露', position: 0.55, description: '事态超出主角控制' },
      { name: '18.第二次揭露', position: 0.6, description: '更深层的真相揭示' },
      { name: '19.道德决定', position: 0.7, description: '主角面临道德抉择' },
      { name: '20.最终揭露', position: 0.78, description: '最终的关键信息' },
      { name: '21.道德自省', position: 0.85, description: '主角的内心转变' },
      { name: '22.最终对决', position: 0.92, description: '主角与对手的最终较量' },
    ],
  },
  edson_23_sequence: {
    name: 'Edson 23段故事策略',
    beats: [
      { name: '1.开场画面', position: 0.01, description: '展示主角的缺陷和现状' },
      { name: '2.设定', position: 0.03, description: '建立主角的世界和关系' },
      { name: '3.催化事件', position: 0.07, description: '打破平衡的突发事件' },
      { name: '4.辩论', position: 0.12, description: '主角犹豫是否应对变化' },
      { name: '5.进入第二幕', position: 0.17, description: '主角做出选择进入新世界' },
      { name: '6.B故事', position: 0.2, description: '副线开始(通常是感情线)' },
      { name: '7.游戏乐趣', position: 0.25, description: '主角在新世界探索和体验' },
      { name: '8.中点', position: 0.35, description: '虚假胜利或虚假失败' },
      { name: '9.敌人逼近', position: 0.4, description: '反方势力加强攻势' },
      { name: '10.失去一切', position: 0.5, description: '主角跌入最低谷' },
      { name: '11.灵魂黑夜', position: 0.55, description: '主角内心崩溃与反思' },
      { name: '12.进入第三幕', position: 0.6, description: '主角找到新的解决方案' },
      { name: '13.收网', position: 0.65, description: 'AB故事线开始交汇' },
      { name: '14.风暴逼近', position: 0.7, description: '最终对决前的紧张积蓄' },
      { name: '15.高潮', position: 0.8, description: '最终决战和核心冲突解决' },
      { name: '16.终场画面', position: 0.95, description: '展示主角成长后的状态' },
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

// ============================================================
// M15: Upgrade Systems (升级体系)
// Source: 《网络文学创作原理》(王祥) + 中国网络文学阅读潮流研究
// ============================================================

export enum UpgradeSystem {
  LEVEL_BASED = 'level_based',
  SKILL_TREE = 'skill_tree',
  REALM_BREAKTHROUGH = 'realm_breakthrough',
  RESOURCE_ACCUMULATION = 'resource_accumulation',
  SOCIAL_RANK = 'social_rank',
}

export interface UpgradeSystemDef {
  system: UpgradeSystem;
  label: string;
  description: string;
  detectionKeywords: string[];
  progressionMarkers: string[];
  satisfactionTriggers: string[];
}

export const UPGRADE_SYSTEMS: Record<UpgradeSystem, UpgradeSystemDef> = {
  [UpgradeSystem.LEVEL_BASED]: {
    system: UpgradeSystem.LEVEL_BASED,
    label: '等级制',
    description: '明确的数值等级体系，从低到高逐级提升',
    detectionKeywords: ['等级', 'Lv', '级别', '段位', '阶位', '品级', '星级', '级', '升级', '升到'],
    progressionMarkers: ['经验值', '升级', '经验', '点数', '属性'],
    satisfactionTriggers: ['连升', '突破', '暴涨', '飞跃'],
  },
  [UpgradeSystem.SKILL_TREE]: {
    system: UpgradeSystem.SKILL_TREE,
    label: '技能树',
    description: '通过学习/觉醒获得新技能或技能升级',
    detectionKeywords: ['技能', '功法', '武技', '术式', '天赋', '被动', '主动', '解锁'],
    progressionMarkers: ['领悟', '修炼', '掌握', '学会', '觉醒', '突破'],
    satisfactionTriggers: ['秒杀', '一招制敌', '威力暴涨', '领悟真谛'],
  },
  [UpgradeSystem.REALM_BREAKTHROUGH]: {
    system: UpgradeSystem.REALM_BREAKTHROUGH,
    label: '境界突破',
    description: '修仙/玄幻类境界体系，需要悟道或突破瓶颈',
    detectionKeywords: ['境界', '修为', '筑基', '金丹', '元婴', '化神', '渡劫', '大乘', '飞升', '突破'],
    progressionMarkers: ['瓶颈', '感悟', '顿悟', '机缘', '天劫', '蜕变'],
    satisfactionTriggers: ['一步登天', '脱胎换骨', '质的飞跃', '碾压同阶'],
  },
  [UpgradeSystem.RESOURCE_ACCUMULATION]: {
    system: UpgradeSystem.RESOURCE_ACCUMULATION,
    label: '资源积累',
    description: '通过收集资源/财富/装备提升实力',
    detectionKeywords: ['灵石', '金币', '装备', '丹药', '材料', '宝物', '道具', '资源', '财富'],
    progressionMarkers: ['获得', '收集', '打造', '炼制', '收购', '掠夺'],
    satisfactionTriggers: ['一夜暴富', '满载而归', '绝世神兵', '传世之宝'],
  },
  [UpgradeSystem.SOCIAL_RANK]: {
    system: UpgradeSystem.SOCIAL_RANK,
    label: '社会地位',
    description: '通过势力扩张/声望提升/人际关系网提升地位',
    detectionKeywords: ['势力', '帮派', '宗门', '城主', '郡守', '皇帝', '声望', '地位', '名望', '权势'],
    progressionMarkers: ['招揽', '收服', '结盟', '征服', '封赏', '提拔'],
    satisfactionTriggers: ['一人之下', '号令天下', '臣服', '俯首称臣'],
  },
};

// ============================================================
// M15: Golden Finger Types (金手指分类)
// Source: 《网络文学创作原理》+ 中国网络文学阅读潮流研究
// ============================================================

export enum GoldenFingerType {
  SYSTEM_CHEAT = 'system_cheat',
  REBIRTH_KNOWLEDGE = 'rebirth_knowledge',
  ANCIENT_INHERITANCE = 'ancient_inheritance',
  SPACE_ARTIFACT = 'space_artifact',
  SPECIAL_ABILITY = 'special_ability',
  FORTUNE_REBIRTH = 'fortune_rebirth',
}

export interface GoldenFingerDef {
  type: GoldenFingerType;
  label: string;
  description: string;
  detectionKeywords: string[];
  typicalManifestations: string[];
  powerGrowthPattern: string;
}

export const GOLDEN_FINGERS: Record<GoldenFingerType, GoldenFingerDef> = {
  [GoldenFingerType.SYSTEM_CHEAT]: {
    type: GoldenFingerType.SYSTEM_CHEAT,
    label: '系统流',
    description: '获得一个系统辅助，提供任务、奖励、商店等功能',
    detectionKeywords: ['系统', '叮', '任务', '奖励', '商店', '兑换', '宿主', '面板', '属性'],
    typicalManifestations: ['任务奖励', '抽奖', '商店兑换', '成就系统'],
    powerGrowthPattern: '任务驱动型 — 完成任务获得奖励逐步变强',
  },
  [GoldenFingerType.REBIRTH_KNOWLEDGE]: {
    type: GoldenFingerType.REBIRTH_KNOWLEDGE,
    label: '重生/穿越先知',
    description: '凭借前世记忆或现代知识在异世界获得优势',
    detectionKeywords: ['前世', '重生', '穿越', '记忆', '历史', '先知', '上一世', '上一辈', '再来一次'],
    typicalManifestations: ['预知未来', '提前布局', '抢夺先机', '避免悲剧'],
    powerGrowthPattern: '知识驱动型 — 利用先知信息抢占资源/避免错误',
  },
  [GoldenFingerType.ANCIENT_INHERITANCE]: {
    type: GoldenFingerType.ANCIENT_INHERITANCE,
    label: '远古传承',
    description: '获得远古大能的传承/记忆/血脉觉醒',
    detectionKeywords: ['传承', '血脉', '觉醒', '远古', '上古', '遗迹', '秘境', '前任', '遗留'],
    typicalManifestations: ['功法传承', '血脉觉醒', '神器认主', '秘境收获'],
    powerGrowthPattern: '传承驱动型 — 获得远超当前层次的功法/宝物',
  },
  [GoldenFingerType.SPACE_ARTIFACT]: {
    type: GoldenFingerType.SPACE_ARTIFACT,
    label: '空间法宝',
    description: '拥有一个随身空间或特殊法宝',
    detectionKeywords: ['空间', '储物', '戒指', '珠子', '随身', '法宝', '灵田', '炼丹炉'],
    typicalManifestations: ['储物空间', '修炼加速', '炼丹/炼器', '灵田种植'],
    powerGrowthPattern: '资源驱动型 — 空间提供资源产出和修炼加速',
  },
  [GoldenFingerType.SPECIAL_ABILITY]: {
    type: GoldenFingerType.SPECIAL_ABILITY,
    label: '异能/天赋',
    description: '拥有与生俱来或意外获得的特殊能力',
    detectionKeywords: ['异能', '天赋', '能力', '超能力', '变异', '觉醒', '特殊体质', '独特'],
    typicalManifestations: ['时间操控', '复制能力', '透视', '预知', '治愈'],
    powerGrowthPattern: '觉醒驱动型 — 能力逐步觉醒和解锁',
  },
  [GoldenFingerType.FORTUNE_REBIRTH]: {
    type: GoldenFingerType.FORTUNE_REBIRTH,
    label: '气运之子',
    description: '运气逆天，关键节点总有奇遇',
    detectionKeywords: ['运气', '气运', '奇遇', '机缘', '运气好', '天命', '命运', '天选', '造化'],
    typicalManifestations: ['掉崖不死得宝', '随手买中大奖', '危难时贵人相助'],
    powerGrowthPattern: '机缘驱动型 — 关键时刻触发奇遇/机缘',
  },
};

// ============================================================
// M15: Anti-Patterns (反面模式/常见写作错误)
// Source: 《你的剧本逊毙了》100个化腐朽为神奇的对策
// ============================================================

export enum AntiPattern {
  INFO_DUMP = 'info_dump',
  PASSIVE_PROTAGONIST = 'passive_protagonist',
  ON_THE_NOSE_DIALOGUE = 'on_the_nose_dialogue',
  WALKING_TALKING = 'walking_talking',
  DEUS_EX_MACHINA = 'deus_ex_machina',
  REDUNDANT_DESCRIPTION = 'redundant_description',
  TELL_NOT_SHOW = 'tell_not_show',
  CONVENIENT_COINCIDENCE = 'convenient_coincidence',
  STATIC_CHARACTER = 'static_character',
  THREAD_ABANDONMENT = 'thread_abandonment',
}

export interface AntiPatternDef {
  pattern: AntiPattern;
  label: string;
  description: string;
  detectionKeywords: string[];
  severity: 'critical' | 'warning' | 'minor';
  fixSuggestion: string;
}

export const ANTI_PATTERNS: Record<AntiPattern, AntiPatternDef> = {
  [AntiPattern.INFO_DUMP]: {
    pattern: AntiPattern.INFO_DUMP,
    label: '信息倾倒',
    description: '大段背景/设定解释，中断叙事节奏',
    detectionKeywords: ['众所周知', '在这个世界', '据说', '传说中', '根据记载', '话说回来', '这里需要说明'],
    severity: 'critical',
    fixSuggestion: '将背景信息分散到角色行动和对话中，每次只透露读者当下需要知道的',
  },
  [AntiPattern.PASSIVE_PROTAGONIST]: {
    pattern: AntiPattern.PASSIVE_PROTAGONIST,
    label: '被动主角',
    description: '主角被事件推着走，缺乏主动决策',
    detectionKeywords: ['只好', '只能', '无奈', '被迫', '别无选择', '身不由己', '不由自主', '不得不'],
    severity: 'critical',
    fixSuggestion: '让主角在每个关键节点做出主动选择，即使是错误的选择也比没有选择好',
  },
  [AntiPattern.ON_THE_NOSE_DIALOGUE]: {
    pattern: AntiPattern.ON_THE_NOSE_DIALOGUE,
    label: '直白对话',
    description: '角色直说内心想法，缺少潜台词和言外之意',
    detectionKeywords: ['我爱你', '我恨你', '我想要', '我害怕', '你知道吗', '让我告诉你', '我的意思是'],
    severity: 'warning',
    fixSuggestion: '让角色通过行动和间接表达传递情感，真正的情感往往在不说出口的话里',
  },
  [AntiPattern.WALKING_TALKING]: {
    pattern: AntiPattern.WALKING_TALKING,
    label: '走路聊天',
    description: '角色无目的地走路并交换信息，缺乏戏剧冲突',
    detectionKeywords: ['他们边走边说', '走在路上', '一边走一边', '沿路', '途中'],
    severity: 'minor',
    fixSuggestion: '给对话场景增加压力或冲突，在特定环境中让角色面临选择',
  },
  [AntiPattern.DEUS_EX_MACHINA]: {
    pattern: AntiPattern.DEUS_EX_MACHINA,
    label: '机械降神',
    description: '关键时刻出现意外的力量/人物解决问题',
    detectionKeywords: ['就在这时', '突然出现', '想不到', '意外地', '奇迹般地', '万没想到', '突然有人'],
    severity: 'critical',
    fixSuggestion: '解决问题的关键元素必须在前文铺垫过，读者应该能事后回溯到线索',
  },
  [AntiPattern.REDUNDANT_DESCRIPTION]: {
    pattern: AntiPattern.REDUNDANT_DESCRIPTION,
    label: '重复描写',
    description: '对同一事物反复描写，拖慢节奏',
    detectionKeywords: ['正如前文所述', '如上所述', '再次', '又一次', '还是那个', '同样的'],
    severity: 'warning',
    fixSuggestion: '信任读者的记忆力，只在需要强调变化时才重复提及',
  },
  [AntiPattern.TELL_NOT_SHOW]: {
    pattern: AntiPattern.TELL_NOT_SHOW,
    label: '告知而非展示',
    description: '直接告知情感/状态而非通过行动展示',
    detectionKeywords: ['他很伤心', '她很害怕', '他感到愤怒', '她非常紧张', '他很开心', '他觉得很'],
    severity: 'warning',
    fixSuggestion: '用具体的身体反应、行为变化、环境细节来传达情感状态',
  },
  [AntiPattern.CONVENIENT_COINCIDENCE]: {
    pattern: AntiPattern.CONVENIENT_COINCIDENCE,
    label: '巧合解决',
    description: '用巧合而非角色努力解决冲突',
    detectionKeywords: ['碰巧', '巧合', '恰好', '刚好', '正好', '刚好在那时', '不早不晚'],
    severity: 'warning',
    fixSuggestion: '巧合可以制造麻烦，但不应该解决麻烦。解决必须来自角色的行动',
  },
  [AntiPattern.STATIC_CHARACTER]: {
    pattern: AntiPattern.STATIC_CHARACTER,
    label: '静态角色',
    description: '角色在整个故事中没有变化或成长',
    detectionKeywords: ['依然如故', '一如既往', '从始至终', '永远都是', '始终没有改变', '还是那样'],
    severity: 'critical',
    fixSuggestion: '给角色一个需要克服的内在缺陷，让经历的事件真正改变角色',
  },
  [AntiPattern.THREAD_ABANDONMENT]: {
    pattern: AntiPattern.THREAD_ABANDONMENT,
    label: '线索弃置',
    description: '设定了重要的伏笔或支线但从未回收',
    detectionKeywords: ['之后再也没有提及', '后来再也没有', '这件事不了了之', '再也没有出现过'],
    severity: 'warning',
    fixSuggestion: '每个埋下的伏笔都必须有回应。如果无法回收，就不要铺垫',
  },
};

// ============================================================
// M15: Narrative Principles (叙事原则)
// Source: 《畅销作家写作全技巧》(大泽在昌)
// ============================================================

export enum NarrativePrinciple {
  SUPPORTING_CHARACTER_RULE = 'supporting_character_rule',
  DIALOGUE_SUBTEXT = 'dialogue_subtext',
  SCENE_CUTTING = 'scene_cutting',
  REVERSAL_SURPRISE = 'reversal_surprise',
  CHARACTER_TRANSFORMATION = 'character_transformation',
  OBSTACLE_ESCALATION = 'obstacle_escalation',
}

export interface NarrativePrincipleDef {
  principle: NarrativePrinciple;
  label: string;
  description: string;
  source: string;
  applicationGuide: string;
  detectionKeywords: string[];
}

export const NARRATIVE_PRINCIPLES: Record<NarrativePrinciple, NarrativePrincipleDef> = {
  [NarrativePrinciple.SUPPORTING_CHARACTER_RULE]: {
    principle: NarrativePrinciple.SUPPORTING_CHARACTER_RULE,
    label: '配角驱动法则',
    description: '有趣的主角需要有趣的配角来衬托，每个配角都应有鲜明的说话方式和动机',
    source: '大泽在昌',
    applicationGuide: '确保每个出场角色有独特的说话方式、行为模式和明确动机',
    detectionKeywords: ['语气', '口头禅', '习惯', '风格不同', '各有特色', '鲜明个性'],
  },
  [NarrativePrinciple.DIALOGUE_SUBTEXT]: {
    principle: NarrativePrinciple.DIALOGUE_SUBTEXT,
    label: '对话潜台词',
    description: '角色说的和想的不一样，对话要隐藏真实意图',
    source: '大泽在昌',
    applicationGuide: '让对话包含表意和深意两层，角色的真实情感通过暗示而非直说表达',
    detectionKeywords: ['言外之意', '暗示', '话里有话', '弦外之音', '欲言又止', '意有所指'],
  },
  [NarrativePrinciple.SCENE_CUTTING]: {
    principle: NarrativePrinciple.SCENE_CUTTING,
    label: '场景剪裁',
    description: '只写有变化有冲突的场景，跳过无聊的过渡',
    source: '大泽在昌',
    applicationGuide: '进入场景时已经在发生冲突，离开时状态已经改变',
    detectionKeywords: ['切入', '跳转', '直接进入', '时间跳过', '之后', '数天后'],
  },
  [NarrativePrinciple.REVERSAL_SURPRISE]: {
    principle: NarrativePrinciple.REVERSAL_SURPRISE,
    label: '反转惊喜',
    description: '每章至少一个让读者意想不到的转折',
    source: '大泽在昌',
    applicationGuide: '在读者以为故事走向A时揭示其实是B，但回看又觉得合理',
    detectionKeywords: ['竟然', '没想到', '出乎意料', '原来', '真相是', '并非如此', '大反转'],
  },
  [NarrativePrinciple.CHARACTER_TRANSFORMATION]: {
    principle: NarrativePrinciple.CHARACTER_TRANSFORMATION,
    label: '角色蜕变',
    description: '角色在故事开始和结束时必须发生本质改变',
    source: '大泽在昌',
    applicationGuide: '开篇确立角色的初始状态和核心缺陷，结尾展示根本性的转变',
    detectionKeywords: ['成长', '蜕变', '改变', '不再是', '终于明白', '重新认识', '变得不同'],
  },
  [NarrativePrinciple.OBSTACLE_ESCALATION]: {
    principle: NarrativePrinciple.OBSTACLE_ESCALATION,
    label: '障碍递增',
    description: '每次解决问题后，下一个障碍必须更大更难',
    source: '大泽在昌',
    applicationGuide: '确保后出现的困难比前面的更复杂，读者永远感到压力在升级',
    detectionKeywords: ['更大的危机', '更强的对手', '更艰难', '前所未有的', '比之前更', '升级'],
  },
};
