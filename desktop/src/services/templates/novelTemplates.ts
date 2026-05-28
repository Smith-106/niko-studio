// Project-level novel templates for one-click project creation
// Each template pre-populates characters, plot skeleton, chapter outlines, and worldview

export interface TemplateCharacter {
  name: string
  role: string
  description: string
  traits: string[]
}

export interface TemplatePlotThread {
  name: string
  description: string
  type: 'main' | 'sub'
}

export interface TemplateChapterOutline {
  title: string
  summary: string
}

export interface TemplateWorldviewElement {
  category: string
  name: string
  description: string
}

export interface NovelTemplate {
  id: string
  name: string
  nameZh: string
  description: string
  descriptionZh: string
  icon: string
  characters: TemplateCharacter[]
  plotSkeleton: TemplatePlotThread[]
  chapterOutlines: TemplateChapterOutline[]
  worldviewElements: TemplateWorldviewElement[]
}

// ── Mystery Detective ──────────────────────────────────────────────

const mysteryDetective: NovelTemplate = {
  id: 'novel-template-mystery',
  name: 'Mystery Detective',
  nameZh: '悬疑推理',
  description: 'A locked-room murder mystery with clues, red herrings, and a dramatic reveal.',
  descriptionZh: '密室杀人谜案，层层线索剥茧抽丝，红鲱鱼与惊天逆转交织的经典推理故事。',
  icon: '🔍',
  characters: [
    {
      name: '沈墨',
      role: '主角',
      description: '资深刑侦探长，逻辑缜密，善于从细节中发现矛盾。表面冷静，内心却对真相有着近乎偏执的追求。',
      traits: ['逻辑缜密', '观察敏锐', '偏执求真', '不善交际'],
    },
    {
      name: '林晓薇',
      role: '助手',
      description: '法医研究员，擅长痕迹分析与毒理鉴定。性格爽朗，常在沈墨陷入僵局时提供关键突破口。',
      traits: ['专业严谨', '性格爽朗', '毒理专家', '善于沟通'],
    },
    {
      name: '周远山',
      role: '嫌疑人',
      description: '被害人的商业合伙人，表面温文尔雅，实则城府极深。拥有看似完美的不在场证明。',
      traits: ['城府极深', '温文尔雅', '善于伪装', '利益驱动'],
    },
  ],
  plotSkeleton: [
    {
      name: '密室杀人',
      description: '被害人在反锁的书房中被发现，门窗完好，无外人进入痕迹。核心谜题：凶手如何进出密室？',
      type: 'main',
    },
    {
      name: '消失的证物',
      description: '案发现场一份关键合同不翼而飞，暗示凶手动机与商业纠纷有关。合同的去向成为破案关键。',
      type: 'main',
    },
    {
      name: '不在场证明的破绽',
      description: '周远山的不在场证明看似天衣无缝，但时间线上存在一个微小的缝隙——一段被刻意抹去的监控空白。',
      type: 'sub',
    },
  ],
  chapterOutlines: [
    {
      title: '第一章：密室',
      summary: '深夜，沈墨接到报案赶赴现场。书房内被害人已死，门窗反锁，一切指向不可能犯罪。初步勘查未发现强制进入痕迹。',
    },
    {
      title: '第二章：疑云',
      summary: '调查被害人生前关系网，锁定三名嫌疑人。周远山的不在场证明最为完整，却反而引起沈墨的警觉。',
    },
    {
      title: '第三章：消失的合同',
      summary: '林晓薇发现案发现场少了一份关键商业合同。合同涉及一笔巨额交易，暗示杀人动机可能与商业利益有关。',
    },
    {
      title: '第四章：时间缝隙',
      summary: '沈墨重新审视监控记录，发现一段被删除的空白时段。追踪数据恢复线索，不在场证明开始动摇。',
    },
    {
      title: '第五章：真相',
      summary: '所有线索汇聚，沈墨揭示密室手法与消失合同的关联。在最终对峙中，周远山的伪装被层层剥开，真相大白。',
    },
  ],
  worldviewElements: [
    {
      category: '地理环境',
      name: '城市背景',
      description: '故事发生在现代化都市，商业区高楼林立，老城区保留着窄巷与旧式建筑。案发地点位于市中心高端写字楼。',
    },
    {
      category: '社会体系',
      name: '警方体系',
      description: '刑侦支队隶属市公安局，拥有法医实验室与电子取证中心。沈墨所在重案组专攻疑难案件。',
    },
  ],
}

// ── Urban Romance ──────────────────────────────────────────────────

const urbanRomance: NovelTemplate = {
  id: 'novel-template-romance',
  name: 'Urban Romance',
  nameZh: '都市言情',
  description: 'A modern love story set in the corporate world—chance encounters, misunderstandings, separation, and reunion.',
  descriptionZh: '职场中的现代爱情故事，从偶遇到误会、从分离到重逢，情感在现实与理想之间反复拉扯。',
  icon: '💕',
  characters: [
    {
      name: '苏念',
      role: '女主',
      description: '新锐设计师，独立坚韧，对设计有执着追求。曾经历一段失败的感情，对爱情心存戒备。',
      traits: ['独立坚韧', '审美敏锐', '心存戒备', '外柔内刚'],
    },
    {
      name: '陆景深',
      role: '男主',
      description: '集团继承人，表面冷漠实则内心孤独。在商业与自我之间挣扎，渴望被真正理解。',
      traits: ['表面冷漠', '内心孤独', '责任感强', '渴望理解'],
    },
    {
      name: '方晴',
      role: '闺蜜',
      description: '苏念的大学室友兼挚友，性格开朗直率，是苏念的情感避风港和吐槽对象。',
      traits: ['开朗直率', '仗义直言', '情感丰富', '八卦体质'],
    },
    {
      name: '韩逸',
      role: '前男友',
      description: '苏念的前任，曾因事业选择而分手。如今功成名就归来，试图挽回旧情，成为苏念与陆景深之间的变数。',
      traits: ['野心勃勃', '能言善辩', '不甘放手', '表面温润'],
    },
  ],
  plotSkeleton: [
    {
      name: '偶遇',
      description: '苏念在项目提案会上与陆景深不期而遇，一场设计理念的碰撞成为两人关系的起点。',
      type: 'main',
    },
    {
      name: '误会',
      description: '韩逸的突然出现引发陆景深的猜忌，加之商业竞争的流言，两人之间产生裂痕。',
      type: 'main',
    },
    {
      name: '分离',
      description: '误会未解，陆景深因家族压力远赴海外处理危机。苏念独自面对事业挑战，两人在沉默中渐行渐远。',
      type: 'main',
    },
    {
      name: '重逢',
      description: '一年后，陆景深带着对苏念的思念归来。在方晴的助攻下，两人终于坦诚面对彼此的感情。',
      type: 'main',
    },
  ],
  chapterOutlines: [
    {
      title: '第一章：提案会',
      summary: '苏念带着设计方案走进集团总部，与陆景深在会议室狭路相逢。两人的设计理念截然不同，却都留下了深刻印象。',
    },
    {
      title: '第二章：碰撞',
      summary: '项目合作让苏念与陆景深频繁接触。从争论到理解，从对立到欣赏，两人之间的坚冰开始融化。',
    },
    {
      title: '第三章：旧人',
      summary: '韩逸以合作方身份出现在苏念面前，旧情与野心交织。苏念表面平静，内心却泛起涟漪。',
    },
    {
      title: '第四章：猜忌',
      summary: '陆景深目睹苏念与韩逸的会面，加之商业流言四起，冷漠成为他的防御。苏念感受到陆景深的疏远，却不知原因。',
    },
    {
      title: '第五章：裂痕',
      summary: '误会加深，一次争吵中两人都说了违心的话。方晴试图调解，但裂痕已经形成。',
    },
    {
      title: '第六章：远行',
      summary: '家族危机迫使陆景深远赴海外。离别匆忙，来不及解释。苏念在空荡的办公室里，读着他留下的便签。',
    },
    {
      title: '第七章：沉淀',
      summary: '一年间，苏念在设计领域崭露头角，陆景深在海外处理完家族事务。两人都在成长，却始终无法忘记对方。',
    },
    {
      title: '第八章：重逢',
      summary: '陆景深归来，在苏念的设计展上重逢。这一次，没有猜忌，没有逃避。方晴推了最后一把，两人终于坦诚相待。',
    },
  ],
  worldviewElements: [
    {
      category: '社会环境',
      name: '职场环境',
      description: '故事核心发生在设计行业与商业集团之间。设计公司追求创意与美学，集团看重商业价值与市场策略，两种价值观的碰撞贯穿始终。',
    },
    {
      category: '社会环境',
      name: '社交圈',
      description: '都市精英的社交圈，行业酒会、设计沙龙、私人晚宴。表面觥筹交错，实则暗流涌动。',
    },
  ],
}

// ── Fantasy Adventure ──────────────────────────────────────────────

const fantasyAdventure: NovelTemplate = {
  id: 'novel-template-fantasy',
  name: 'Fantasy Adventure',
  nameZh: '奇幻冒险',
  description: 'An epic fantasy adventure—a hero called, trials endured, alliances forged, and a final battle against darkness.',
  descriptionZh: '史诗奇幻冒险，勇者应召而出，历经试炼，缔结联盟，在黑暗与光明的决战中书写命运。',
  icon: '⚔️',
  characters: [
    {
      name: '叶尘',
      role: '勇者',
      description: '边陲小镇的少年猎人，身世成谜。体内沉睡着未知的力量，被命运推上冒险之路。',
      traits: ['身世成谜', '意志坚韧', '重情重义', '力量觉醒中'],
    },
    {
      name: '苍梧',
      role: '导师',
      description: '隐居山林的老者，曾是上一代守护者。知晓古老预言，以严苛训练引导叶尘觉醒。',
      traits: ['深藏不露', '严厉慈爱', '知晓预言', '过往沉重'],
    },
    {
      name: '苏瑶',
      role: '伙伴',
      description: '精灵族游侠，箭术精湛，性格洒脱。因族群使命与叶尘同行，从同伴变为挚友。',
      traits: ['箭术精湛', '性格洒脱', '族群使命', '外冷内热'],
    },
    {
      name: '冥渊',
      role: '反派',
      description: '暗影之王，千年前被封印的古老邪神。如今封印松动，他重返世间，意图吞噬一切光明。',
      traits: ['古老邪恶', '力量恐怖', '冷酷无情', '深谋远虑'],
    },
    {
      name: '雾隐',
      role: '神秘人',
      description: '游走于光明与黑暗之间的神秘人物，身份成谜。时而相助时而阻碍，真实立场扑朔迷离。',
      traits: ['身份成谜', '立场不明', '实力深不可测', '亦正亦邪'],
    },
  ],
  plotSkeleton: [
    {
      name: '召唤',
      description: '黑暗势力入侵边陲，叶尘的家乡被毁。苍梧现身揭示预言，叶尘踏上命运之路。',
      type: 'main',
    },
    {
      name: '试炼',
      description: '在苍梧的引导下，叶尘经历三重试炼——力量、意志与牺牲。每一关都逼近生死边缘。',
      type: 'main',
    },
    {
      name: '联盟',
      description: '叶尘集结各族力量，与苏瑶等伙伴共同组建反抗联盟。但联盟内部暗藏分歧与背叛。',
      type: 'main',
    },
    {
      name: '决战',
      description: '最终之战在暗影王座前爆发。雾隐的真实身份揭晓，叶尘以觉醒之力与冥渊展开宿命对决。',
      type: 'main',
    },
  ],
  chapterOutlines: [
    {
      title: '第一章：暗夜降临',
      summary: '边陲小镇叶家堡，叶尘过着平静的猎人生活。一夜之间，暗影生物入侵，家园化为废墟。苍梧在废墟中找到幸存的叶尘。',
    },
    {
      title: '第二章：预言',
      summary: '苍梧道出千年预言：当暗影再临，星辰之子将举起光明之剑。叶尘体内沉睡的力量与预言吻合，命运之门已然开启。',
    },
    {
      title: '第三章：启程',
      summary: '叶尘告别故土，随苍梧踏上旅途。第一站是精灵之森，寻找古老盟约的线索。路上遭遇暗影追兵，初试战斗。',
    },
    {
      title: '第四章：精灵之森',
      summary: '在精灵之森，叶尘遇见苏瑶。精灵族长对人类心存戒备，但苏瑶看出叶尘的不同，决定同行。',
    },
    {
      title: '第五章：试炼·力量',
      summary: '苍梧带叶尘进入试炼之地。第一关考验力量觉醒，叶尘在生死边缘激发体内潜能，但力量失控险些反噬。',
    },
    {
      title: '第六章：试炼·意志',
      summary: '第二关考验意志。幻境中叶尘面对内心最深的恐惧与诱惑——家乡的幻象、安逸的生活。他选择继续前行。',
    },
    {
      title: '第七章：试炼·牺牲',
      summary: '第三关考验牺牲。叶尘必须放弃最珍贵的东西才能通过。苍梧在这一关中暴露了自己的伤势，师徒之间的羁绊加深。',
    },
    {
      title: '第八章：联盟',
      summary: '试炼通过后，叶尘开始游说各族。精灵、矮人、人族代表齐聚，但各方利益分歧让联盟岌岌可危。雾隐首次现身，留下耐人寻味的建议。',
    },
    {
      title: '第九章：背叛',
      summary: '联盟内部出现叛徒，暗影势力渗透。一场突袭让联盟损失惨重，叶尘在绝望中重新凝聚人心。雾隐在关键时刻出手相助，又悄然离去。',
    },
    {
      title: '第十章：决战',
      summary: '最终之战在暗影王座前爆发。雾隐的真实身份揭晓——他是千年前的封印者之一。叶尘以完全觉醒之力与冥渊对决，光明终将驱散黑暗。',
    },
  ],
  worldviewElements: [
    {
      category: '魔法体系',
      name: '灵力体系',
      description: '万物皆有灵力，修炼者通过觉醒体内灵脉获得超凡力量。灵力分为光明、暗影、自然三系，觉醒者通常只具一系天赋。叶尘是千年一遇的三系觉醒者。',
    },
    {
      category: '种族设定',
      name: '五族格局',
      description: '大陆上生活着五大种族：人族（数量最多，适应力强）、精灵族（长寿，自然亲和）、矮人族（工匠大师，山地之民）、兽人族（勇武善战，草原游牧）、龙裔（稀少，远古血脉）。',
    },
    {
      category: '地理环境',
      name: '苍穹大陆',
      description: '故事发生在苍穹大陆，东临无尽之海，西接万丈深渊，北有冰封群山，南为广袤荒原。大陆中央是人族王国，精灵之森在东北，矮人山脉在西北。',
    },
  ],
}

// ── Exports ────────────────────────────────────────────────────────

export const NOVEL_TEMPLATES: NovelTemplate[] = [
  mysteryDetective,
  urbanRomance,
  fantasyAdventure,
]

export { mysteryDetective, urbanRomance, fantasyAdventure }
