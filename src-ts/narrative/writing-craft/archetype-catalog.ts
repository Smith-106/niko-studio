/**
 * Writing Craft — Character Archetype Catalog
 *
 * 45 classic character archetypes from Victoria Lynn Schmidt
 * "45 Master Characters" based on Campbell's Hero's Journey.
 * 8 categories with archetype definitions including motivations,
 * fears, character arcs, and keyword signals.
 */

// ============================================================
// Archetype Categories (Campbell's Hero's Journey roles)
// ============================================================

export enum ArchetypeCategory {
  HERO = 'hero',                     // 英雄
  MENTOR = 'mentor',                 // 导师
  SHADOW = 'shadow',                 // 阴影/反派
  HERALD = 'herald',                 // 信使
  THRESHOLD_GUARDIAN = 'threshold_guardian', // 阈限守卫
  SHAPESHIFTER = 'shapeshifter',     // 变形者
  TRICKSTER = 'trickster',           // 诡术师
  ALLY = 'ally',                     // 盟友
}

// ============================================================
// 45 Character Archetypes
// ============================================================

export enum CharacterArchetype {
  // Hero archetypes (6)
  WARRIOR = 'warrior',
  SURVIVOR = 'survivor',
  PRODIGY = 'prodigy',
  LOST_SOUL = 'lost_soul',
  CRUSADER = 'crusader',
  WONDER_CHILD = 'wonder_child',
  // Mentor archetypes (5)
  MENTOR_PROTECTOR = 'mentor_protector',
  MENTOR_RULES = 'mentor_rules',
  MENTOR_TEACHER = 'mentor_teacher',
  MENTOR_GENIUS = 'mentor_genius',
  MENTOR_LOVING = 'mentor_loving',
  // Shadow archetypes (7)
  VILLAIN = 'villain',
  TYRANT = 'tyrant',
  SEDUCTRESS = 'seductress',
  TRAITOR = 'traitor',
  EVIL_GENIUS = 'evil_genius',
  DARK_MAGE = 'dark_mage',
  CORRUPTOR = 'corruptor',
  // Herald archetypes (5)
  MESSENGER = 'messenger',
  PIONEER = 'pioneer',
  HERALD_WITNESS = 'herald_witness',
  CHALLENGER = 'challenger',
  AWAKENER = 'awakener',
  // Threshold Guardian archetypes (5)
  GATEKEEPER = 'gatekeeper',
  TESTER = 'tester',
  SENTINEL = 'sentinel',
  RIVAL_GUARDIAN = 'rival_guardian',
  DOUBTING_THOMAS = 'doubting_thomas',
  // Shapeshifter archetypes (6)
  CHAMELEON = 'chameleon',
  DOUBLE_AGENT = 'double_agent',
  MYSTERIOUS_STRANGER = 'mysterious_stranger',
  LOVER_BETRAYER = 'lover_betrayer',
  ENCHANTER = 'enchanter',
  FICKLE_ONE = 'fickle_one',
  // Trickster archetypes (6)
  FOOL = 'fool',
  JESTER = 'jester',
  CON_ARTIST = 'con_artist',
  NEMESIS = 'nemesis',
  SABOTEUR = 'saboteur',
  CHAOS_AGENT = 'chaos_agent',
  // Ally archetypes (5)
  LOYAL_COMPANION = 'loyal_companion',
  BEST_FRIEND = 'best_friend',
  HEALER = 'healer',
  SAGE_ALLY = 'sage_ally',
  PROTECTOR_ALLY = 'protector_ally',
}

export interface ArchetypeDef {
  archetype: CharacterArchetype;
  category: ArchetypeCategory;
  label: string;
  description: string;
  motivation: string;
  fear: string;
  arc: { positive: string; negative: string };
  keywords: string[];
  shadowTraits: string[];
}

export const ARCHETYPE_CATALOG: Record<CharacterArchetype, ArchetypeDef> = {
  // ── Hero (6) ──
  [CharacterArchetype.WARRIOR]: {
    archetype: CharacterArchetype.WARRIOR,
    category: ArchetypeCategory.HERO,
    label: '战士',
    description: '以行动力为核心，用实力和勇气直面挑战',
    motivation: '证明自己的价值和力量',
    fear: '软弱无力，无法保护重要之人',
    arc: { positive: '从好斗战士变为守护者', negative: '从保护者变为暴君' },
    keywords: ['战斗', '强大', '勇猛', '不屈', '力量', '守护', '冲锋', '热血'],
    shadowTraits: ['暴力倾向', '过度好斗', '轻视弱者'],
  },
  [CharacterArchetype.SURVIVOR]: {
    archetype: CharacterArchetype.SURVIVOR,
    category: ArchetypeCategory.HERO,
    label: '幸存者',
    description: '经历过极端困境后依然活着，靠韧性和适应力存活',
    motivation: '活下去，不再被击倒',
    fear: '再次陷入无助的境地',
    arc: { positive: '从创伤中恢复并帮助他人', negative: '变得冷酷无情' },
    keywords: ['幸存', '活下来', '经历', '承受', '韧性', '不倒', '适应'],
    shadowTraits: ['过度警觉', '难以信任', '情感封闭'],
  },
  [CharacterArchetype.PRODIGY]: {
    archetype: CharacterArchetype.PRODIGY,
    category: ArchetypeCategory.HERO,
    label: '天才',
    description: '天资过人但可能缺乏人情世故，需要在天才与平凡间找平衡',
    motivation: '发挥天赋，证明能力',
    fear: '江郎才尽，成为平庸之人',
    arc: { positive: '学会谦逊并善用天赋', negative: '骄傲自大走向失败' },
    keywords: ['天才', '天赋', '过人', '聪慧', '领悟', '超常', '一学就会'],
    shadowTraits: ['傲慢', '轻视他人', '完美主义'],
  },
  [CharacterArchetype.LOST_SOUL]: {
    archetype: CharacterArchetype.LOST_SOUL,
    category: ArchetypeCategory.HERO,
    label: '迷失者',
    description: '内心充满迷惘，在寻找自我的过程中成长',
    motivation: '找到真正的自我和归属',
    fear: '永远找不到答案，永远迷茫',
    arc: { positive: '找到内在力量和方向', negative: '彻底迷失自我' },
    keywords: ['迷失', '寻找', '不知道', '彷徨', '孤独', '迷茫', '我到底是谁'],
    shadowTraits: ['自我否定', '逃避现实', '依赖他人'],
  },
  [CharacterArchetype.CRUSADER]: {
    archetype: CharacterArchetype.CRUSADER,
    category: ArchetypeCategory.HERO,
    label: '十字军',
    description: '为理想和正义而战的理想主义者',
    motivation: '实现理想，改变世界',
    fear: '理想破灭，一切毫无意义',
    arc: { positive: '学会务实但仍保理想', negative: '变成极端主义者' },
    keywords: ['正义', '理想', '使命', '信念', '改变世界', '不惜一切'],
    shadowTraits: ['偏执', '牺牲他人', '不择手段'],
  },
  [CharacterArchetype.WONDER_CHILD]: {
    archetype: CharacterArchetype.WONDER_CHILD,
    category: ArchetypeCategory.HERO,
    label: '神童',
    description: '保持孩童般纯真和好奇心的英雄，用纯净之心感化他人',
    motivation: '探索世界，保持好奇',
    fear: '失去纯真，变成冷漠的大人',
    arc: { positive: '保持纯真同时获得智慧', negative: '被现实磨灭光芒' },
    keywords: ['纯真', '好奇', '天真', '善良', '孩子', '纯净', '无邪'],
    shadowTraits: ['幼稚', '轻信他人', '拒绝成长'],
  },

  // ── Mentor (5) ──
  [CharacterArchetype.MENTOR_PROTECTOR]: {
    archetype: CharacterArchetype.MENTOR_PROTECTOR,
    category: ArchetypeCategory.MENTOR,
    label: '守护导师',
    description: '以保护和引导后辈为核心，愿意为学员牺牲',
    motivation: '保护和培养下一代',
    fear: '学员超越自己或不受保护',
    arc: { positive: '放手让学生独立', negative: '过度控制变成束缚' },
    keywords: ['师父', '保护', '教导', '照顾', '引导', '不要怕', '放心'],
    shadowTraits: ['过度保护', '控制欲', '无法放手'],
  },
  [CharacterArchetype.MENTOR_RULES]: {
    archetype: CharacterArchetype.MENTOR_RULES,
    category: ArchetypeCategory.MENTOR,
    label: '严厉导师',
    description: '用严格规则和纪律培养学员，外表严厉内心关爱',
    motivation: '让学员成为最强者',
    fear: '学员不争气，自己的心血白费',
    arc: { positive: '严厉中展现关怀', negative: '冷酷无情失去学员' },
    keywords: ['严格', '规矩', '训斥', '再练', '不够好', '必须', '不许'],
    shadowTraits: ['冷酷', '精神虐待', '否定一切'],
  },
  [CharacterArchetype.MENTOR_TEACHER]: {
    archetype: CharacterArchetype.MENTOR_TEACHER,
    category: ArchetypeCategory.MENTOR,
    label: '智慧教师',
    description: '以知识和智慧引导学员，强调理解和领悟',
    motivation: '传授知识，启发思考',
    fear: '知识断代，无人传承',
    arc: { positive: '启发学员独立思考', negative: '只重理论脱离实践' },
    keywords: ['知识', '道理', '明白', '领悟', '想想看', '智慧', '道理是'],
    shadowTraits: ['学究气', '纸上谈兵', '看不起实践者'],
  },
  [CharacterArchetype.MENTOR_GENIUS]: {
    archetype: CharacterArchetype.MENTOR_GENIUS,
    category: ArchetypeCategory.MENTOR,
    label: '疯癫天才',
    description: '行为古怪但拥有深不可测的实力和智慧',
    motivation: '以自己的方式引导有缘人',
    fear: '被真正理解后失去神秘感',
    arc: { positive: '展现真面目并传承', negative: '疯癫成真失去价值' },
    keywords: ['古怪', '疯', '怪人', '不按常理', '高手', '深藏不露', '看似'],
    shadowTraits: ['不可预测', '真疯癫', '不负责任'],
  },
  [CharacterArchetype.MENTOR_LOVING]: {
    archetype: CharacterArchetype.MENTOR_LOVING,
    category: ArchetypeCategory.MENTOR,
    label: '慈爱导师',
    description: '以温暖和爱引导学员成长，给予情感支持',
    motivation: '用爱帮助学员找到自己的路',
    fear: '学员受伤或走上歧路',
    arc: { positive: '爱与智慧平衡', negative: '溺爱阻碍成长' },
    keywords: ['孩子', '没关系', '慢慢来', '支持', '温暖', '别怕', '我相信你'],
    shadowTraits: ['溺爱', '无法拒绝', '纵容'],
  },

  // ── Shadow (7) ──
  [CharacterArchetype.VILLAIN]: {
    archetype: CharacterArchetype.VILLAIN,
    category: ArchetypeCategory.SHADOW,
    label: '反派',
    description: '主角的主要对手，目标与主角对立',
    motivation: '实现自己的目标，不惜一切',
    fear: '被主角击败，计划失败',
    arc: { positive: '认识到错误并改变', negative: '彻底堕落不可救药' },
    keywords: ['敌人', '对手', '威胁', '阴谋', '野心', '计划', '必须阻止'],
    shadowTraits: ['无情', '欺骗', '利用他人'],
  },
  [CharacterArchetype.TYRANT]: {
    archetype: CharacterArchetype.TYRANT,
    category: ArchetypeCategory.SHADOW,
    label: '暴君',
    description: '以权力和恐惧统治他人，追求绝对控制',
    motivation: '获得和维持绝对权力',
    fear: '失去控制，被推翻',
    arc: { positive: '权力腐蚀前的觉醒', negative: '暴政到毁灭' },
    keywords: ['统治', '控制', '权力', '服从', '不允许', '命令', '恐惧'],
    shadowTraits: ['偏执', '残暴', '孤立'],
  },
  [CharacterArchetype.SEDUCTRESS]: {
    archetype: CharacterArchetype.SEDUCTRESS,
    category: ArchetypeCategory.SHADOW,
    label: '蛇蝎美人',
    description: '用魅力和诱惑达到目的，美丽是最大的武器',
    motivation: '通过操控获得想要的一切',
    fear: '失去魅力，被人看穿',
    arc: { positive: '找到真正被爱的感觉', negative: '被自己的游戏吞噬' },
    keywords: ['魅力', '诱惑', '迷住', '无法抗拒', '吸引', '风情', '掌控'],
    shadowTraits: ['操控欲', '欺骗', '利用感情'],
  },
  [CharacterArchetype.TRAITOR]: {
    archetype: CharacterArchetype.TRAITOR,
    category: ArchetypeCategory.SHADOW,
    label: '叛徒',
    description: '表面忠诚实际背叛，信任是其最大的武器',
    motivation: '为自己谋取最大利益',
    fear: '被识破，失去信任资本',
    arc: { positive: '良心发现赎罪', negative: '反复背叛无人信' },
    keywords: ['背叛', '出卖', '背后', '算计', '两面', '假装', '表面'],
    shadowTraits: ['无信义', '投机', '两面三刀'],
  },
  [CharacterArchetype.EVIL_GENIUS]: {
    archetype: CharacterArchetype.EVIL_GENIUS,
    category: ArchetypeCategory.SHADOW,
    label: '邪恶天才',
    description: '拥有超凡智力但用于邪恶目的，享受智力游戏',
    motivation: '证明自己比所有人都聪明',
    fear: '被人看穿计划，智力不如人',
    arc: { positive: '用天赋造福他人', negative: '自大导致失败' },
    keywords: ['计划', '算计', '棋局', '一切尽在掌握', '聪明', '预料之中'],
    shadowTraits: ['自恋', '不择手段', '视人如棋子'],
  },
  [CharacterArchetype.DARK_MAGE]: {
    archetype: CharacterArchetype.DARK_MAGE,
    category: ArchetypeCategory.SHADOW,
    label: '黑暗法师',
    description: '掌握禁忌力量，被黑暗力量驱使',
    motivation: '获得禁忌的力量和知识',
    fear: '力量失控，被黑暗吞噬',
    arc: { positive: '回归光明', negative: '被黑暗完全吞噬' },
    keywords: ['黑暗', '禁忌', '力量', '堕落', '禁术', '代价', '不可触碰'],
    shadowTraits: ['痴迷力量', '疯狂', '失去人性'],
  },
  [CharacterArchetype.CORRUPTOR]: {
    archetype: CharacterArchetype.CORRUPTOR,
    category: ArchetypeCategory.SHADOW,
    label: '腐蚀者',
    description: '以诱惑和腐化他人为乐，使好人堕落',
    motivation: '证明人性本恶，拉人下水',
    fear: '遇到真正不可腐蚀的人',
    arc: { positive: '被真正的善良感化', negative: '腐蚀一切后空虚' },
    keywords: ['诱惑', '堕落', '人性', '本来面目', '真实', '不过如此'],
    shadowTraits: ['愤世嫉俗', '毁掉一切', '享受他人痛苦'],
  },

  // ── Herald (5) ──
  [CharacterArchetype.MESSENGER]: {
    archetype: CharacterArchetype.MESSENGER,
    category: ArchetypeCategory.HERALD,
    label: '信使',
    description: '带来改变的消息或机会，触发主角行动',
    motivation: '传递重要信息',
    fear: '信息被忽视或误解',
    arc: { positive: '成为可靠的情报网', negative: '变成散布谣言者' },
    keywords: ['消息', '通知', '告诉你', '来报', '紧急', '消息来了'],
    shadowTraits: ['八卦', '夸大其词', '泄露秘密'],
  },
  [CharacterArchetype.PIONEER]: {
    archetype: CharacterArchetype.PIONEER,
    category: ArchetypeCategory.HERALD,
    label: '先驱者',
    description: '第一个探索未知领域的人，为后人开辟道路',
    motivation: '探索未知，开拓新路',
    fear: '走在错误的道路上，白费努力',
    arc: { positive: '成功开辟新领域', negative: '迷失在未知中' },
    keywords: ['第一个', '开拓', '探索', '前所未有', '先例', '新路'],
    shadowTraits: ['鲁莽', '不听取警告', '孤独'],
  },
  [CharacterArchetype.HERALD_WITNESS]: {
    archetype: CharacterArchetype.HERALD_WITNESS,
    category: ArchetypeCategory.HERALD,
    label: '见证者',
    description: '以旁观者身份记录和传达真相',
    motivation: '让真相被看见',
    fear: '真相被掩盖，自己的见证无意义',
    arc: { positive: '揭露真相引发改变', negative: '沉默成为共犯' },
    keywords: ['亲眼', '看见', '记录', '真相', '作证', '我看到了'],
    shadowTraits: ['冷漠', '只看不帮', '选择性失明'],
  },
  [CharacterArchetype.CHALLENGER]: {
    archetype: CharacterArchetype.CHALLENGER,
    category: ArchetypeCategory.HERALD,
    label: '挑战者',
    description: '以质疑和挑战触发主角成长',
    motivation: '测试主角是否值得',
    fear: '主角失败证明自己是对的',
    arc: { positive: '成为最强对手和朋友', negative: '嫉妒变成仇恨' },
    keywords: ['你确定吗', '凭什么', '我不信', '证明给我看', '不如', '试试'],
    shadowTraits: ['刻薄', '嫉妒', '永远不满'],
  },
  [CharacterArchetype.AWAKENER]: {
    archetype: CharacterArchetype.AWAKENER,
    category: ArchetypeCategory.HERALD,
    label: '觉醒者',
    description: '触发主角对自身力量或命运的觉醒',
    motivation: '唤醒沉睡的潜力',
    fear: '被唤醒者拒绝觉醒',
    arc: { positive: '成功唤醒改变命运', negative: '唤醒的力量失控' },
    keywords: ['醒醒', '你不知道自己', '潜力', '命运', '真正的力量', '属于你'],
    shadowTraits: ['操控命运', '强加使命', '不负责任地唤醒'],
  },

  // ── Threshold Guardian (5) ──
  [CharacterArchetype.GATEKEEPER]: {
    archetype: CharacterArchetype.GATEKEEPER,
    category: ArchetypeCategory.THRESHOLD_GUARDIAN,
    label: '守门人',
    description: '把守关键关卡，主角必须通过考验才能前进',
    motivation: '确保只有合格者通过',
    fear: '放过了不合格的人',
    arc: { positive: '认可主角主动放行', negative: '死守规则失去意义' },
    keywords: ['不能通过', '不配', '资格', '考验', '门', '通过', '证明'],
    shadowTraits: ['僵化', '权力滥用', '故意刁难'],
  },
  [CharacterArchetype.TESTER]: {
    archetype: CharacterArchetype.TESTER,
    category: ArchetypeCategory.THRESHOLD_GUARDIAN,
    label: '试炼者',
    description: '设计考验测试主角的能力和决心',
    motivation: '找出真正有实力的人',
    fear: '考验被作弊通过',
    arc: { positive: '公正测试后认可', negative: '设计不可能的考验' },
    keywords: ['测试', '考验', '题目', '回答', '证明', '看你能不能'],
    shadowTraits: ['刁难', '不公平', '享受他人的失败'],
  },
  [CharacterArchetype.SENTINEL]: {
    archetype: CharacterArchetype.SENTINEL,
    category: ArchetypeCategory.THRESHOLD_GUARDIAN,
    label: '哨兵',
    description: '忠诚地守护领地或秘密，不轻易让人接近',
    motivation: '履行守护职责',
    fear: '守护的东西被夺取',
    arc: { positive: '认可主角成为盟友', negative: '死板执行导致灾难' },
    keywords: ['站住', '禁止', '不许', '守护', '警戒', '有人来了'],
    shadowTraits: ['盲目服从', '不思考', '过度警惕'],
  },
  [CharacterArchetype.RIVAL_GUARDIAN]: {
    archetype: CharacterArchetype.RIVAL_GUARDIAN,
    category: ArchetypeCategory.THRESHOLD_GUARDIAN,
    label: '竞争对手',
    description: '与主角竞争同一目标，既是障碍也是推动力',
    motivation: '赢过主角证明自己',
    fear: '被主角超越',
    arc: { positive: '互相成长成为朋友', negative: '嫉妒变成毁灭性竞争' },
    keywords: ['我也', '比', '竞争', '谁先', '赢', '不会输给你'],
    shadowTraits: ['嫉妒', '不择手段', '输不起'],
  },
  [CharacterArchetype.DOUBTING_THOMAS]: {
    archetype: CharacterArchetype.DOUBTING_THOMAS,
    category: ArchetypeCategory.THRESHOLD_GUARDIAN,
    label: '怀疑者',
    description: '质疑主角的能力和计划，让主角证明自己',
    motivation: '防止冒进和错误',
    fear: '过度质疑错失机会',
    arc: { positive: '质疑后最终被说服', negative: '永远质疑阻碍一切' },
    keywords: ['真的吗', '我不信', '不可能', '太冒险', '你想好了吗', '万一'],
    shadowTraits: ['消极', '永远否定', '恐惧改变'],
  },

  // ── Shapeshifter (6) ──
  [CharacterArchetype.CHAMELEON]: {
    archetype: CharacterArchetype.CHAMELEON,
    category: ArchetypeCategory.SHAPESHIFTER,
    label: '变色龙',
    description: '根据环境和需要改变自己的面目，立场不固定',
    motivation: '适应环境以求生存',
    fear: '真实面目被看穿',
    arc: { positive: '找到真实自我不再伪装', negative: '忘记真实的自己' },
    keywords: ['伪装', '变脸', '看情况', '不一定', '两面', '看穿'],
    shadowTraits: ['无立场', '机会主义', '不可信任'],
  },
  [CharacterArchetype.DOUBLE_AGENT]: {
    archetype: CharacterArchetype.DOUBLE_AGENT,
    category: ArchetypeCategory.SHAPESHIFTER,
    label: '双面间谍',
    description: '同时为双方工作，真实立场不明',
    motivation: '在夹缝中获取最大利益或保护某人',
    fear: '真实身份暴露',
    arc: { positive: '最终选择正义一方', negative: '被两方抛弃' },
    keywords: ['间谍', '卧底', '秘密', '身份', '谁的人', '暗线'],
    shadowTraits: ['两面三刀', '背叛', '不可预测'],
  },
  [CharacterArchetype.MYSTERIOUS_STRANGER]: {
    archetype: CharacterArchetype.MYSTERIOUS_STRANGER,
    category: ArchetypeCategory.SHAPESHIFTER,
    label: '神秘陌生人',
    description: '突然出现的神秘人物，背景和目的不明',
    motivation: '隐藏的真实目的（善或恶）',
    fear: '过去的身份暴露',
    arc: { positive: '揭开面纱成为盟友', negative: '揭露为敌人' },
    keywords: ['突然出现', '不知来历', '神秘', '奇怪的人', '他到底是谁'],
    shadowTraits: ['隐藏动机', '不可预测', '制造不安'],
  },
  [CharacterArchetype.LOVER_BETRAYER]: {
    archetype: CharacterArchetype.LOVER_BETRAYER,
    category: ArchetypeCategory.SHAPESHIFTER,
    label: '爱恨交织者',
    description: '在爱人和敌人之间摇摆，感情和利益冲突',
    motivation: '在爱与恨之间挣扎',
    fear: '做出最终选择',
    arc: { positive: '选择爱并坚持', negative: '背叛最爱的人' },
    keywords: ['又爱又恨', '舍不得', '但', '一边是', '不知道该', '矛盾'],
    shadowTraits: ['感情操控', '反复无常', '伤害最亲近的人'],
  },
  [CharacterArchetype.ENCHANTER]: {
    archetype: CharacterArchetype.ENCHANTER,
    category: ArchetypeCategory.SHAPESHIFTER,
    label: '幻术师',
    description: '用幻象和误导迷惑他人，真假难辨',
    motivation: '维持幻象达到目的',
    fear: '幻象被揭穿，真实不堪',
    arc: { positive: '放下伪装展现真实', negative: '沉溺于自己创造的幻象' },
    keywords: ['幻象', '假象', '看不清', '真假', '错觉', '表象'],
    shadowTraits: ['欺骗', '逃避真实', '自欺欺人'],
  },
  [CharacterArchetype.FICKLE_ONE]: {
    archetype: CharacterArchetype.FICKLE_ONE,
    category: ArchetypeCategory.SHAPESHIFTER,
    label: '善变者',
    description: '态度和立场反复无常，让主角难以判断',
    motivation: '追求新鲜感和自身利益',
    fear: '被抛弃，失去选择权',
    arc: { positive: '找到值得坚持的事', negative: '永远摇摆失去所有人' },
    keywords: ['变卦', '又', '算了', '不', '再看看', '不一定'],
    shadowTraits: ['不靠谱', '反复无常', '让人疲惫'],
  },

  // ── Trickster (6) ──
  [CharacterArchetype.FOOL]: {
    archetype: CharacterArchetype.FOOL,
    category: ArchetypeCategory.TRICKSTER,
    label: '傻瓜',
    description: '表面愚笨实则智慧，用幽默和反直觉打破僵局',
    motivation: '用不同视角看问题',
    fear: '被当成真的蠢人',
    arc: { positive: '关键时刻展现智慧', negative: '永远不被人当真' },
    keywords: ['傻', '笨', '不懂', '呵呵', '也许吧', '随便'],
    shadowTraits: ['装傻逃避责任', '真的愚蠢', '被动'],
  },
  [CharacterArchetype.JESTER]: {
    archetype: CharacterArchetype.JESTER,
    category: ArchetypeCategory.TRICKSTER,
    label: '小丑',
    description: '用幽默和讽刺揭示真相，让严肃的事情变得可笑',
    motivation: '用笑声对抗荒谬',
    fear: '笑容背后的痛苦被发现',
    arc: { positive: '用笑声治愈自己和他人', negative: '用幽默掩盖一切' },
    keywords: ['哈哈', '开玩笑', '逗', '有意思', '好笑', '不是吧'],
    shadowTraits: ['用幽默伤人', '逃避严肃', '不敢面对'],
  },
  [CharacterArchetype.CON_ARTIST]: {
    archetype: CharacterArchetype.CON_ARTIST,
    category: ArchetypeCategory.TRICKSTER,
    label: '骗子',
    description: '以骗术和谎言谋生，精于人性的弱点',
    motivation: '用最少付出获得最大回报',
    fear: '遇到比自己更聪明的人',
    arc: { positive: '用骗术行侠仗义', negative: '骗术被识破众叛亲离' },
    keywords: ['骗', '假的', '忽悠', '信不信', '成交', '包在我身上'],
    shadowTraits: ['欺诈', '无情', '没有底线'],
  },
  [CharacterArchetype.NEMESIS]: {
    archetype: CharacterArchetype.NEMESIS,
    category: ArchetypeCategory.TRICKSTER,
    label: '复仇女神',
    description: '以惩罚和报复为目的，追踪犯错者直到付出代价',
    motivation: '让犯错者付出代价',
    fear: '复仇失败，正义不得伸张',
    arc: { positive: '放下仇恨获得平静', negative: '复仇吞噬自己' },
    keywords: ['还债', '代价', '逃不掉', '记住', '不会放过', '报应'],
    shadowTraits: ['偏执', '永不宽恕', '以暴制暴'],
  },
  [CharacterArchetype.SABOTEUR]: {
    archetype: CharacterArchetype.SABOTEUR,
    category: ArchetypeCategory.TRICKSTER,
    label: '破坏者',
    description: '在暗中破坏计划和秩序，制造混乱',
    motivation: '通过破坏获得控制感',
    fear: '破坏被发现，失去影响力',
    arc: { positive: '用能力建设而非破坏', negative: '破坏一切后一无所有' },
    keywords: ['破坏', '搞砸', '暗中', '手脚', '不能让他们成功', '计划失败'],
    shadowTraits: ['消极', '毁灭欲', '无法创造只能破坏'],
  },
  [CharacterArchetype.CHAOS_AGENT]: {
    archetype: CharacterArchetype.CHAOS_AGENT,
    category: ArchetypeCategory.TRICKSTER,
    label: '混沌使者',
    description: '制造混乱和不确定性，让所有事情偏离轨道',
    motivation: '享受混乱和不可预测',
    fear: '秩序建立，一切变无聊',
    arc: { positive: '打破僵局带来创新', negative: '失控的混乱毁灭一切' },
    keywords: ['混乱', '不可预测', '随机', '变了', '没想到', '打乱'],
    shadowTraits: ['不负责任', '破坏性', '无法无天'],
  },

  // ── Ally (5) ──
  [CharacterArchetype.LOYAL_COMPANION]: {
    archetype: CharacterArchetype.LOYAL_COMPANION,
    category: ArchetypeCategory.ALLY,
    label: '忠诚伙伴',
    description: '无条件忠诚的伙伴，永远站在主角一边',
    motivation: '守护和陪伴主角',
    fear: '主角不再需要自己',
    arc: { positive: '在忠诚中找到自己的价值', negative: '盲目跟随失去自我' },
    keywords: ['陪你', '一起', '永远', '不会离开', '兄弟', '搭档'],
    shadowTraits: ['盲目忠诚', '没有主见', '被利用'],
  },
  [CharacterArchetype.BEST_FRIEND]: {
    archetype: CharacterArchetype.BEST_FRIEND,
    category: ArchetypeCategory.ALLY,
    label: '挚友',
    description: '最亲密的朋友，了解主角的一切，是情感支柱',
    motivation: '友谊和情感连接',
    fear: '友谊破裂，被取代',
    arc: { positive: '独立成长同时保持友谊', negative: '过度依赖变成负担' },
    keywords: ['朋友', '理解', '支持', '闺蜜', '好兄弟', '懂你'],
    shadowTraits: ['过度依赖', '嫉妒主角的其他关系', '不愿放手'],
  },
  [CharacterArchetype.HEALER]: {
    archetype: CharacterArchetype.HEALER,
    category: ArchetypeCategory.ALLY,
    label: '治疗者',
    description: '以治愈和关怀为使命，在团队中承担疗愈角色',
    motivation: '减轻他人的痛苦',
    fear: '无法治愈，无能为力',
    arc: { positive: '治愈他人的同时治愈自己', negative: '因无法拯救而崩溃' },
    keywords: ['治疗', '治愈', '恢复', '没事', '包扎', '药', '照顾'],
    shadowTraits: ['牺牲自我', '忽略自己的伤痛', '过度付出'],
  },
  [CharacterArchetype.SAGE_ALLY]: {
    archetype: CharacterArchetype.SAGE_ALLY,
    category: ArchetypeCategory.ALLY,
    label: '智者盟友',
    description: '以智慧和经验支持主角，是可靠的建议者',
    motivation: '用经验帮助年轻人少走弯路',
    fear: '智慧过时，无法应对新挑战',
    arc: { positive: '接受新知识与时俱进', negative: '固守旧知被淘汰' },
    keywords: ['经验', '建议', '听我说', '以前', '按我', '智慧'],
    shadowTraits: ['倚老卖老', '固执', '看不起年轻人'],
  },
  [CharacterArchetype.PROTECTOR_ALLY]: {
    archetype: CharacterArchetype.PROTECTOR_ALLY,
    category: ArchetypeCategory.ALLY,
    label: '守护盟友',
    description: '以强大的保护能力守护主角的伙伴',
    motivation: '保护弱者和正义',
    fear: '保护失败，有人受伤',
    arc: { positive: '保护他人的同时接受保护', negative: '过度保护变成限制' },
    keywords: ['保护', '安全', '别担心', '我来', '挡住', '没事的'],
    shadowTraits: ['过度保护', '不允许冒险', '控制欲'],
  },
};

// ============================================================
// Archetype Matching
// ============================================================

export interface ArchetypeMatch {
  archetype: CharacterArchetype;
  label: string;
  category: ArchetypeCategory;
  confidence: number;
  suggestedArc: string;
}

export function matchArchetype(descriptions: string[]): ArchetypeMatch[] {
  const text = descriptions.join(' ');
  const results: ArchetypeMatch[] = [];

  for (const def of Object.values(ARCHETYPE_CATALOG)) {
    const hits = def.keywords.filter((kw) => text.includes(kw));
    if (hits.length === 0) continue;

    const confidence = hits.length / def.keywords.length;
    results.push({
      archetype: def.archetype,
      label: def.label,
      category: def.category,
      confidence: Math.round(confidence * 100) / 100,
      suggestedArc: def.arc.positive,
    });
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}
