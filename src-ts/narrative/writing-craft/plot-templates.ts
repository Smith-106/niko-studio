/**
 * Writing Craft — Plot Templates
 *
 * 20 classic plot patterns from Ronald B. Tobias "20 Master Plots".
 * Each pattern defines structural stages, keywords, and proportions
 * for niko-studio's plot structure detection engine.
 */

// ============================================================
// 20 Classic Plot Patterns
// Source: 《经典情节20种》(Ronald B. Tobias)
// ============================================================

export enum PlotPattern {
  QUEST = 'quest',                     // 探寻：寻找某人/某物/某地
  ADVENTURE = 'adventure',             // 冒险：踏上未知旅程
  PURSUIT = 'pursuit',                 // 追逐：追逐与被追逐
  RESCUE = 'rescue',                   // 救援：拯救被俘/被困者
  ESCAPE = 'escape',                   // 逃亡：逃离困境/追捕
  REVENGE = 'revenge',                 // 复仇：对伤害的报复
  RIDDLE = 'riddle',                   // 谜题：解开谜团/悬案
  RIVALRY = 'rivalry',                 // 竞争：对手之间的对抗
  UNDERDOG = 'underdog',              // 弱者逆袭：以弱胜强
  TEMPTATION = 'temptation',           // 诱惑：被诱惑引入歧途
  METAMORPHOSIS = 'metamorphosis',     // 变形：物理/精神上的转变
  TRANSFORMATION = 'transformation',   // 蜕变：内在自我的改变
  MATURATION = 'maturation',           // 成长：从幼稚到成熟
  LOVE = 'love',                       // 爱情：相爱过程中的阻碍
  FORBIDDEN_LOVE = 'forbidden_love',   // 禁忌之恋：不被允许的爱情
  SACRIFICE = 'sacrifice',             // 牺牲：为他人/理想付出代价
  DISCOVERY = 'discovery',             // 发现：发现自我/真相/新世界
  WRETCHED_EXCESS = 'wretched_excess', // 极度放纵：沉溺到自我毁灭
  ASCENSION = 'ascension',             // 升腾：从低谷到巅峰
  DESCENSION = 'descension',           // 堕落：从巅峰到深渊
}

export interface PlotPatternDef {
  pattern: PlotPattern;
  label: string;
  description: string;
  /** 典型结构阶段 (3-5阶段) */
  stages: string[];
  /** 每阶段的篇幅比例 */
  proportions: number[];
  /** 每阶段的关键词信号 */
  keywords: { stage: string; terms: string[] }[];
  /** 常见变体 */
  variations: string[];
}

export const PLOT_PATTERNS: Record<PlotPattern, PlotPatternDef> = {
  [PlotPattern.QUEST]: {
    pattern: PlotPattern.QUEST,
    label: '探寻',
    description: '主角踏上寻找某人、某物或某地的旅程，过程改变主角自身',
    stages: ['动机触发', '踏上旅途', '沿途考验', '到达目标', '回归/改变'],
    proportions: [0.1, 0.2, 0.4, 0.2, 0.1],
    keywords: [
      { stage: '动机触发', terms: ['寻找', '需要', '必须找到', '失踪', '丢失'] },
      { stage: '踏上旅途', terms: ['出发', '离开', '上路', '告别', '出发'] },
      { stage: '沿途考验', terms: ['遭遇', '阻碍', '困难', '敌人', '险境'] },
      { stage: '到达目标', terms: ['找到', '到达', '终于', '目的地'] },
      { stage: '回归/改变', terms: ['回来', '成长', '改变', '不再是', '新的自己'] },
    ],
    variations: ['圣杯探寻', '宝藏猎寻', '寻人之旅'],
  },
  [PlotPattern.ADVENTURE]: {
    pattern: PlotPattern.ADVENTURE,
    label: '冒险',
    description: '主角因外在力量卷入未知世界，经历一连串惊险事件',
    stages: ['日常被打破', '进入未知', '冒险经历', '危机高潮', '回归日常'],
    proportions: [0.1, 0.15, 0.35, 0.3, 0.1],
    keywords: [
      { stage: '日常被打破', terms: ['突然', '意外', '没想到', '打破'] },
      { stage: '进入未知', terms: ['进入', '发现', '新世界', '从未见过'] },
      { stage: '冒险经历', terms: ['冒险', '探索', '遭遇', '危险', '奇遇'] },
      { stage: '危机高潮', terms: ['危机', '决战', '最危险', '生死'] },
      { stage: '回归日常', terms: ['回到', '恢复', '平静', '一切结束'] },
    ],
    variations: ['异世界冒险', '探险考古', '太空探索'],
  },
  [PlotPattern.PURSUIT]: {
    pattern: PlotPattern.PURSUIT,
    label: '追逐',
    description: '一方追捕另一方，追捕者与被追者之间的猫鼠游戏',
    stages: ['犯事/被盯上', '开始追逐', '追逐中的博弈', '险些被抓/逃脱', '终结追逐'],
    proportions: [0.15, 0.2, 0.35, 0.2, 0.1],
    keywords: [
      { stage: '犯事/被盯上', terms: ['追捕', '逃', '罪犯', '目标'] },
      { stage: '开始追逐', terms: ['追赶', '跟踪', '逃跑', '追上'] },
      { stage: '追逐中的博弈', terms: ['险些', '差点', '擦肩', '线索', '设局'] },
      { stage: '险些被抓/逃脱', terms: ['千钧一发', '就差一点', '被围', '脱身'] },
      { stage: '终结追逐', terms: ['抓住', '逃脱', '结束', '终于'] },
    ],
    variations: ['警匪追逐', '间谍逃亡', '猎人与猎物'],
  },
  [PlotPattern.RESCUE]: {
    pattern: PlotPattern.RESCUE,
    label: '救援',
    description: '主角必须拯救被囚禁或陷入危险的人，常伴随时间压力',
    stages: ['发现危险/被劫', '决定营救', '克服障碍', '执行救援', '成功/失败'],
    proportions: [0.15, 0.1, 0.3, 0.3, 0.15],
    keywords: [
      { stage: '发现危险/被劫', terms: ['被绑', '失踪', '被困', '危险', '落入'] },
      { stage: '决定营救', terms: ['必须救', '不能不管', '一定', '赶去'] },
      { stage: '克服障碍', terms: ['守卫', '机关', '陷阱', '阻碍'] },
      { stage: '执行救援', terms: ['救出', '打开', '突破', '抢在'] },
      { stage: '成功/失败', terms: ['救出', '来不及', '终于', '安全'] },
    ],
    variations: ['人质营救', '公主拯救', '战俘营救'],
  },
  [PlotPattern.ESCAPE]: {
    pattern: PlotPattern.ESCAPE,
    label: '逃亡',
    description: '主角被困于不利境地，必须设法逃离',
    stages: ['被困', '发现弱点/机会', '策划逃跑', '执行逃亡', '自由/代价'],
    proportions: [0.15, 0.2, 0.25, 0.3, 0.1],
    keywords: [
      { stage: '被困', terms: ['困', '囚', '关押', '无法', '封锁'] },
      { stage: '发现弱点/机会', terms: ['发现', '漏洞', '机会', '疏忽'] },
      { stage: '策划逃跑', terms: ['计划', '准备', '等待时机', '暗自'] },
      { stage: '执行逃亡', terms: ['逃', '跑', '冲出', '突破'] },
      { stage: '自由/代价', terms: ['自由', '逃出', '代价', '牺牲'] },
    ],
    variations: ['越狱', '密室逃脱', '敌营逃亡'],
  },
  [PlotPattern.REVENGE]: {
    pattern: PlotPattern.REVENGE,
    label: '复仇',
    description: '主角遭受不公正对待，策划并实施报复行动',
    stages: ['遭受不公/伤害', '立誓复仇', '隐忍准备', '实施报复', '后果/反思'],
    proportions: [0.15, 0.1, 0.3, 0.3, 0.15],
    keywords: [
      { stage: '遭受不公/伤害', terms: ['屈辱', '背叛', '夺走', '毁掉', '杀害'] },
      { stage: '立誓复仇', terms: ['发誓', '一定要', '不会放过', '报仇'] },
      { stage: '隐忍准备', terms: ['忍耐', '等待', '积蓄', '暗中', '布局'] },
      { stage: '实施报复', terms: ['反击', '清算', '以牙还牙', '加倍奉还'] },
      { stage: '后果/反思', terms: ['值得吗', '空虚', '放下', '代价'] },
    ],
    variations: ['血债血偿', '商战复仇', '迟来的正义'],
  },
  [PlotPattern.RIDDLE]: {
    pattern: PlotPattern.RIDDLE,
    label: '谜题',
    description: '主角面对一个谜团或悬案，通过推理和调查揭开真相',
    stages: ['谜题出现', '收集线索', '误导/假答案', '关键突破', '真相揭晓'],
    proportions: [0.1, 0.25, 0.25, 0.25, 0.15],
    keywords: [
      { stage: '谜题出现', terms: ['谜', '谜团', '不解', '奇怪', '不可能'] },
      { stage: '收集线索', terms: ['线索', '证据', '调查', '发现', '疑点'] },
      { stage: '误导/假答案', terms: ['原来不是', '误导', '假象', '看似'] },
      { stage: '关键突破', terms: ['突破', '关键', '恍然大悟', '终于明白'] },
      { stage: '真相揭晓', terms: ['真相', '原来是', '凶手是', '答案', '水落石出'] },
    ],
    variations: ['推理悬疑', '密室杀人', '身份之谜'],
  },
  [PlotPattern.RIVALRY]: {
    pattern: PlotPattern.RIVALRY,
    label: '竞争',
    description: '两个对手在某个领域展开竞争，胜负取决于各自的努力和策略',
    stages: ['对手相遇', '产生竞争', '你来我往', '关键对决', '胜负分明'],
    proportions: [0.15, 0.15, 0.3, 0.25, 0.15],
    keywords: [
      { stage: '对手相遇', terms: ['对手', '竞争', '较量', '旗鼓相当'] },
      { stage: '产生竞争', terms: ['比', '胜负', '不服', '谁更强'] },
      { stage: '你来我往', terms: ['反击', '超越', '再次', '各有胜负'] },
      { stage: '关键对决', terms: ['决赛', '决战', '最后一战', '终极较量'] },
      { stage: '胜负分明', terms: ['赢了', '败了', '承认', '心服'] },
    ],
    variations: ['商战竞争', '武道对决', '智力较量'],
  },
  [PlotPattern.UNDERDOG]: {
    pattern: PlotPattern.UNDERDOG,
    label: '弱者逆袭',
    description: '明显处于劣势的主角，通过坚持和智慧最终取胜',
    stages: ['弱势处境', '不屈抗争', '受挫坚持', '找到破局', '以弱胜强'],
    proportions: [0.2, 0.2, 0.2, 0.2, 0.2],
    keywords: [
      { stage: '弱势处境', terms: ['不如', '差距', '弱', '看不起', '不可能赢'] },
      { stage: '不屈抗争', terms: ['不服', '坚持', '不放弃', '努力'] },
      { stage: '受挫坚持', terms: ['失败', '跌倒', '再来', '更加'] },
      { stage: '找到破局', terms: ['发现', '机会', '弱点', '突破'] },
      { stage: '以弱胜强', terms: ['赢了', '逆袭', '不可置信', '奇迹'] },
    ],
    variations: ['草根逆袭', '以少胜多', '弱旅夺魁'],
  },
  [PlotPattern.TEMPTATION]: {
    pattern: PlotPattern.TEMPTATION,
    label: '诱惑',
    description: '主角被某种诱惑吸引，逐渐偏离正道',
    stages: ['诱惑出现', '内心挣扎', '屈服诱惑', '沉沦堕落', '醒悟/毁灭'],
    proportions: [0.15, 0.2, 0.25, 0.25, 0.15],
    keywords: [
      { stage: '诱惑出现', terms: ['诱惑', '捷径', '不劳而获', '太好了'] },
      { stage: '内心挣扎', terms: ['犹豫', '不对', '但', '万一'] },
      { stage: '屈服诱惑', terms: ['算了', '就一次', '没什么', '试一试'] },
      { stage: '沉沦堕落', terms: ['越来越多', '无法自拔', '失去', '沉沦'] },
      { stage: '醒悟/毁灭', terms: ['后悔', '来不及', '代价', '醒悟'] },
    ],
    variations: ['权力诱惑', '金钱诱惑', '禁果之恋'],
  },
  [PlotPattern.METAMORPHOSIS]: {
    pattern: PlotPattern.METAMORPHOSIS,
    label: '变形',
    description: '主角经历物理或精神上的转变，外在改变引发内在变化',
    stages: ['变化发生', '适应变化', '因变化被排斥/接纳', '变化的代价', '接受/恢复'],
    proportions: [0.15, 0.2, 0.25, 0.25, 0.15],
    keywords: [
      { stage: '变化发生', terms: ['变了', '变成', '不同', '突然不一样'] },
      { stage: '适应变化', terms: ['适应', '接受', '新能力', '发现'] },
      { stage: '因变化被排斥/接纳', terms: ['不理解', '恐惧', '排斥', '重新认识'] },
      { stage: '变化的代价', terms: ['代价', '失去', '承受', '痛苦'] },
      { stage: '接受/恢复', terms: ['接受', '和解', '恢复', '真正的自己'] },
    ],
    variations: ['变身英雄', '变异异能', '灵魂转换'],
  },
  [PlotPattern.TRANSFORMATION]: {
    pattern: PlotPattern.TRANSFORMATION,
    label: '蜕变',
    description: '主角经历内在的自我转变，从一种人格状态转变为另一种',
    stages: ['旧的自我', '触发事件', '挣扎抗拒', '转折接受', '新的自我'],
    proportions: [0.15, 0.15, 0.3, 0.25, 0.15],
    keywords: [
      { stage: '旧的自我', terms: ['一直', '习惯', '从不', '以前'] },
      { stage: '触发事件', terms: ['改变', '打破', '不得不', '面临'] },
      { stage: '挣扎抗拒', terms: ['不想', '抗拒', '做不到', '逃避'] },
      { stage: '转折接受', terms: ['终于', '明白', '接受', '选择'] },
      { stage: '新的自我', terms: ['成为', '不再是', '成长', '改变'] },
    ],
    variations: ['反派洗白', '英雄堕落', '弱者变强'],
  },
  [PlotPattern.MATURATION]: {
    pattern: PlotPattern.MATURATION,
    label: '成长',
    description: '主角从幼稚走向成熟，经历人生重要阶段的洗礼',
    stages: ['天真/无知', '初遇挫折', '艰难成长', '领悟道理', '走向成熟'],
    proportions: [0.15, 0.2, 0.3, 0.2, 0.15],
    keywords: [
      { stage: '天真/无知', terms: ['不懂', '天真', '以为', '简单'] },
      { stage: '初遇挫折', terms: ['失败', '受伤', '第一次', '原来不是'] },
      { stage: '艰难成长', terms: ['艰难', '学会', '经历', '磨砺'] },
      { stage: '领悟道理', terms: ['明白了', '理解', '原来', '终于懂了'] },
      { stage: '走向成熟', terms: ['成长', '成熟', '不再是孩子', '担起'] },
    ],
    variations: ['成人礼', '学徒出师', '从校园到社会'],
  },
  [PlotPattern.LOVE]: {
    pattern: PlotPattern.LOVE,
    label: '爱情',
    description: '两个角色相爱的过程，面对外部和内部阻碍',
    stages: ['相遇', '互生好感', '感情升温', '阻碍/冲突', '在一起/分离'],
    proportions: [0.15, 0.2, 0.25, 0.25, 0.15],
    keywords: [
      { stage: '相遇', terms: ['遇见', '第一次', '注意到', '眼神'] },
      { stage: '互生好感', terms: ['心动', '喜欢', '在意', '挂念'] },
      { stage: '感情升温', terms: ['在一起', '甜蜜', '关心', '越来越'] },
      { stage: '阻碍/冲突', terms: ['阻碍', '分开', '误会', '反对'] },
      { stage: '在一起/分离', terms: ['在一起', '永远', '选择', '放手'] },
    ],
    variations: ['欢喜冤家', '青梅竹马', '一见钟情'],
  },
  [PlotPattern.FORBIDDEN_LOVE]: {
    pattern: PlotPattern.FORBIDDEN_LOVE,
    label: '禁忌之恋',
    description: '不被社会/道德/家族允许的爱情，主角在爱与禁忌间挣扎',
    stages: ['禁忌背景', '产生感情', '秘密相恋', '被发现/施压', '在一起/分离'],
    proportions: [0.15, 0.2, 0.25, 0.25, 0.15],
    keywords: [
      { stage: '禁忌背景', terms: ['不能', '不允许', '家族', '身份', '敌对'] },
      { stage: '产生感情', terms: ['却', '偏偏', '忍不住', '无法控制'] },
      { stage: '秘密相恋', terms: ['秘密', '偷偷', '只能', '无人知晓'] },
      { stage: '被发现/施压', terms: ['发现', '反对', '威胁', '逼迫'] },
      { stage: '在一起/分离', terms: ['不顾一切', '私奔', '牺牲', '放手'] },
    ],
    variations: ['罗密欧与朱丽叶', '师生恋', '仇人相恋'],
  },
  [PlotPattern.SACRIFICE]: {
    pattern: PlotPattern.SACRIFICE,
    label: '牺牲',
    description: '主角为了更高的目标或所爱之人，自愿付出巨大代价',
    stages: ['平静/拥有', '面临抉择', '内心挣扎', '做出牺牲', '结果/意义'],
    proportions: [0.15, 0.2, 0.25, 0.25, 0.15],
    keywords: [
      { stage: '平静/拥有', terms: ['幸福', '拥有', '珍惜', '平凡'] },
      { stage: '面临抉择', terms: ['抉择', '两难', '只能选', '必须'] },
      { stage: '内心挣扎', terms: ['不舍', '犹豫', '痛苦', '挣扎'] },
      { stage: '做出牺牲', terms: ['牺牲', '放弃', '让出', '成全'] },
      { stage: '结果/意义', terms: ['值得', '换来了', '终于', '铭记'] },
    ],
    variations: ['自我牺牲', '为爱牺牲', '为理想牺牲'],
  },
  [PlotPattern.DISCOVERY]: {
    pattern: PlotPattern.DISCOVERY,
    label: '发现',
    description: '主角发现关于自我、他人或世界的重要真相',
    stages: ['无知/误解', '疑点出现', '追寻真相', '发现真相', '理解/改变'],
    proportions: [0.15, 0.2, 0.25, 0.25, 0.15],
    keywords: [
      { stage: '无知/误解', terms: ['以为', '以为知道', '一直相信', '从不知道'] },
      { stage: '疑点出现', terms: ['不对', '奇怪', '矛盾', '疑点'] },
      { stage: '追寻真相', terms: ['调查', '追问', '寻找', '挖掘'] },
      { stage: '发现真相', terms: ['原来', '真相', '竟然', '没想到'] },
      { stage: '理解/改变', terms: ['理解', '释然', '重新', '改变'] },
    ],
    variations: ['身世之谜', '秘密揭露', '世界观颠覆'],
  },
  [PlotPattern.WRETCHED_EXCESS]: {
    pattern: PlotPattern.WRETCHED_EXCESS,
    label: '极度放纵',
    description: '主角沉溺于某种欲望或行为，逐步走向自我毁灭',
    stages: ['初始状态', '开始沉溺', '逐步失控', '彻底崩溃', '毁灭/救赎'],
    proportions: [0.1, 0.2, 0.3, 0.25, 0.15],
    keywords: [
      { stage: '初始状态', terms: ['好奇', '试试', '一次', '没什么'] },
      { stage: '开始沉溺', terms: ['越来越', '忍不住', '需要', '渴望'] },
      { stage: '逐步失控', terms: ['失去', '不管', '无法控制', '越界'] },
      { stage: '彻底崩溃', terms: ['崩溃', '破碎', '失去一切', '众叛亲离'] },
      { stage: '毁灭/救赎', terms: ['毁灭', '悔恨', '太晚', '重新开始'] },
    ],
    variations: ['权力沉沦', '贪欲膨胀', '瘾症深渊'],
  },
  [PlotPattern.ASCENSION]: {
    pattern: PlotPattern.ASCENSION,
    label: '升腾',
    description: '主角从低谷逐步攀升到人生巅峰',
    stages: ['低谷起点', '获得机遇', '逐步攀升', '突破瓶颈', '到达巅峰'],
    proportions: [0.15, 0.15, 0.3, 0.25, 0.15],
    keywords: [
      { stage: '低谷起点', terms: ['落魄', '低谷', '一无所有', '被看不起'] },
      { stage: '获得机遇', terms: ['机会', '机遇', '转机', '贵人'] },
      { stage: '逐步攀升', terms: ['进步', '提升', '越来越好', '崭露头角'] },
      { stage: '突破瓶颈', terms: ['突破', '飞跃', '超越', '质变'] },
      { stage: '到达巅峰', terms: ['巅峰', '第一', '传奇', '无人能及'] },
    ],
    variations: ['草根崛起', '废柴逆袭', '白手起家'],
  },
  [PlotPattern.DESCENSION]: {
    pattern: PlotPattern.DESCENSION,
    label: '堕落',
    description: '主角从高峰逐步滑向深渊',
    stages: ['巅峰状态', '失误/诱惑', '逐步下滑', '彻底堕落', '深渊/觉醒'],
    proportions: [0.1, 0.2, 0.3, 0.25, 0.15],
    keywords: [
      { stage: '巅峰状态', terms: ['辉煌', '巅峰', '一切', '风光'] },
      { stage: '失误/诱惑', terms: ['但', '然而', '失误', '诱惑', '贪婪'] },
      { stage: '逐步下滑', terms: ['失去', '下滑', '越来越差', '不再'] },
      { stage: '彻底堕落', terms: ['堕落', '沦落', '不堪', '众叛亲离'] },
      { stage: '深渊/觉醒', terms: ['深渊', '后悔', '已经太晚', '如果可以重来'] },
    ],
    variations: ['英雄堕落', '王朝衰落', '天才陨落'],
  },
};

// ============================================================
// Plot Detection
// ============================================================

export interface PlotDetectionResult {
  pattern: PlotPattern;
  label: string;
  confidence: number;
  matchedStages: string[];
  evidence: string[];
}

const DEFAULT_OPTIONS = { topK: 5, minConfidence: 0.2 };

export function detectPlotPatterns(
  text: string,
  options?: { topK?: number; minConfidence?: number },
): PlotDetectionResult[] {
  const { topK, minConfidence } = { ...DEFAULT_OPTIONS, ...options };
  const results: PlotDetectionResult[] = [];

  for (const def of Object.values(PLOT_PATTERNS)) {
    const matchedStages: string[] = [];
    const evidence: string[] = [];
    let totalHits = 0;
    let totalKeywords = 0;

    for (const stageKw of def.keywords) {
      const hits = stageKw.terms.filter((term) => text.includes(term));
      totalKeywords += stageKw.terms.length;
      if (hits.length > 0) {
        matchedStages.push(stageKw.stage);
        evidence.push(...hits);
      }
      totalHits += hits.length;
    }

    const stageCoverage = matchedStages.length / def.stages.length;
    const keywordHitRate = totalKeywords > 0 ? totalHits / totalKeywords : 0;
    const confidence = stageCoverage * 0.6 + keywordHitRate * 0.4;

    if (confidence >= minConfidence) {
      results.push({
        pattern: def.pattern,
        label: def.label,
        confidence: Math.round(confidence * 100) / 100,
        matchedStages,
        evidence: [...new Set(evidence)],
      });
    }
  }

  return results
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, topK);
}
