import { useState, useMemo, useRef, useCallback } from 'react'
import { Shield, Sparkles, BookOpen, SlidersHorizontal, Zap, AlertTriangle, GraduationCap } from 'lucide-react'
import { processWritingHelper } from '../api/client'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n, type Language } from '../i18n'
import { getEditorHandle } from '../utils/editorHandle'
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap'

// ── Preset System ───────────────────────────────────────────────

type OptimizerPreset = 'humanize' | 'aiGuide' | 'characterNarrative' | 'literaryPolish' | 'academicPaper' | 'custom'

interface OptimizerPresetDef {
  id: OptimizerPreset
  icon: React.ReactNode
}

type OptimizerInputSource = 'selection' | 'manual' | 'empty'

const PRESET_DEFS: OptimizerPresetDef[] = [
  { id: 'humanize', icon: <Shield size={16} /> },
  { id: 'aiGuide', icon: <BookOpen size={16} /> },
  { id: 'characterNarrative', icon: <Sparkles size={16} /> },
  { id: 'literaryPolish', icon: <Zap size={16} /> },
  { id: 'academicPaper', icon: <GraduationCap size={16} /> },
  { id: 'custom', icon: <SlidersHorizontal size={16} /> },
]

function getSelectedEditorText(): string {
  const handle = getEditorHandle()
  if (!handle) {
    return ''
  }

  return handle.getSelectedText()
}

function buildInstruction(
  preset: OptimizerPreset,
  customInstruction: string,
  language: Language,
): string {
  const builders: Record<OptimizerPreset, (language: Language) => string> = {
    custom: () => customInstruction.trim(),
    humanize: buildHumanizeInstruction,
    aiGuide: buildAiGuideInstruction,
    characterNarrative: buildCharacterNarrativeInstruction,
    literaryPolish: buildLiteraryPolishInstruction,
    academicPaper: buildAcademicPaperInstruction,
  }

  return builders[preset](language)
}

// ── Preset instruction builders ─────────────────────────────────

function buildHumanizeInstruction(language: Language): string {
  if (language === 'zh') {
    return [
      '你是一位专业的文本人性化优化专家。请对以下文本进行全面的人类写作特征优化：',
      '',
        '## 核心目标',
        '1. 去除AI生成文本的典型特征，使内容更加自然、人性化',
        '2. 专门针对GPTZero等AI检测器使用的统计学特征进行反检测优化',
        '3. 重点优化困惑度(Perplexity)和突发性(Burstiness)两项关键指标',
        '',
        '## 具体策略',
        '### 困惑度优化（Perplexity）',
        '- 引入非常规但准确的词汇选择，提高文本不可预测性',
        '- 使用隐喻、转喻等修辞手法替代直白表达',
        '- 在适当位置插入口语化表达、反问句、感叹句',
        '- 混合使用长句和短句，打破AI文本的均匀节奏',
        '',
        '### 突发性优化（Burstiness）',
        '- 段落长度必须有明显差异：有的段落只有一句话，有的段落包含多句',
        '- 句式多样化：穿插使用简单句、复合句、排比句、倒装句',
        '- 在叙述中加入个人化表达（"说实话"、"有趣的是"、"不知道你有没有注意"）',
        '- 适当使用不完全规范的标点（省略号、破折号）增加自然感',
        '',
        '### 人类写作特征注入',
        '- 加入主观评价和情感色彩',
        '- 使用第一人称视角进行叙述',
        '- 引入类比和个人经验',
        '- 添加过渡性的思维连接词（"不过话说回来"、"关键是"）',
        '- 保持内容的逻辑性，但允许轻微的叙述跳跃',
        '',
        '## 约束条件',
        '- 保持原文核心含义和信息不变',
        '- 不改变原文的段落主题和逻辑结构',
        '- 输出必须是流畅自然的中文',
        '- 优化后的文本应该读起来像是一个有经验的写作者在咖啡馆里随手写下的',
      ].join('\n')
    }
    return [
      'You are a professional text humanization expert. Perform comprehensive human writing feature optimization on the following text:',
      '',
      '## Core Objectives',
      '1. Remove AI-generated text characteristics to make content more natural and human-like',
      '2. Specifically counter statistical features used by AI detectors like GPTZero',
      '3. Focus on optimizing two key metrics: Perplexity and Burstiness',
      '',
      '## Specific Strategies',
      '### Perplexity Optimization',
      '- Introduce unconventional but accurate word choices to increase unpredictability',
      '- Use metaphors, metonymy and other rhetorical devices instead of direct expressions',
      '- Insert colloquial expressions, rhetorical questions, and exclamations at appropriate points',
      '- Mix long and short sentences to break AI text uniformity',
      '',
      '### Burstiness Optimization',
      '- Paragraph lengths must vary significantly: some single-sentence, some multi-sentence',
      '- Diversify sentence structures: mix simple, compound, parallel, and inverted sentences',
      '- Add personal expressions in narration ("honestly", "funnily enough", "I wonder if")',
      '- Use slightly irregular punctuation (ellipses, em-dashes) for natural feel',
      '',
      '### Human Writing Feature Injection',
      '- Add subjective evaluations and emotional coloring',
      '- Use first-person perspective in narration',
      '- Introduce analogies and personal experiences',
      '- Add transitional thought connectors ("then again", "the key thing is")',
      '- Maintain logical flow but allow slight narrative jumps',
      '',
      '## Constraints',
      '- Preserve the original core meaning and information',
      '- Do not change paragraph topics or logical structure',
      '- Output must be fluent and natural',
      '- The optimized text should read as if written by an experienced writer jotting thoughts in a cafe',
    ].join('\n')
  }

function buildAiGuideInstruction(language: Language): string {
  if (language === 'zh') {
    return [
      '你是一位AI文本修改指导专家。请分析以下文本中的AI生成痕迹，并提供修改建议和修改后的文本：',
      '',
      '## 分析步骤',
      '1. 标识文本中的AI生成特征（如过于整齐的句式、缺乏个人化表达、用词过于正式等）',
      '2. 针对每个问题区域，给出具体的修改建议',
      '3. 应用所有修改建议，输出优化后的完整文本',
      '',
      '## AI文本特征检测清单',
      '- 句子长度是否过于均匀',
      '- 是否缺少口语化或个人化表达',
      '- 段落过渡是否过于工整',
      '- 词汇选择是否过于"安全"和"正确"',
      '- 是否缺少情感波动和主观评价',
      '- 是否有过多的"首先/其次/最后"式的列举结构',
      '',
      '## 修改指导原则',
      '- 困惑度(Perplexity)：增加文本的不可预测性，使用更丰富的词汇和表达',
      '- 突发性(Burstiness)：制造句式和段落长度的变化，让文本有"呼吸感"',
      '- 保持原文的信息量和逻辑完整性',
      '',
      '## 输出格式',
      '先输出修改后的完整文本，然后在文本之后附上简短的修改说明。',
    ].join('\n')
  }
  return [
    'You are an AI text modification guidance expert. Analyze the following text for AI-generated traces, provide modification suggestions, and output the revised text:',
    '',
    '## Analysis Steps',
    '1. Identify AI-generated features (overly uniform sentence patterns, lack of personal expression, overly formal word choice, etc.)',
    '2. For each problem area, provide specific modification suggestions',
    '3. Apply all suggestions and output the complete revised text',
    '',
    '## AI Text Feature Detection Checklist',
    '- Are sentence lengths too uniform?',
    '- Is there a lack of colloquial or personal expression?',
    '- Are paragraph transitions too neat/mechanical?',
    '- Is word choice too "safe" and "correct"?',
    '- Is there a lack of emotional variation and subjective evaluation?',
    '- Are there too many "firstly/secondly/finally" listing structures?',
    '',
    '## Modification Guidelines',
    '- Perplexity: Increase text unpredictability with richer vocabulary and expressions',
    '- Burstiness: Create variation in sentence patterns and paragraph lengths for a "breathing" rhythm',
    '- Preserve original information density and logical integrity',
    '',
    '## Output Format',
    'Output the complete revised text first, then append a brief modification note after the text.',
  ].join('\n')
}

function buildCharacterNarrativeInstruction(language: Language): string {
  if (language === 'zh') {
    return [
      '你是一位角色扮演式文本人类化专家。请以特定角色的视角和口吻改写以下文本：',
      '',
      '## 核心目标',
      '1. 赋予文本强烈的人类角色特征和个性化表达',
      '2. 通过角色扮演方式消除AI生成的模式化痕迹',
      '',
      '## 默认角色设定',
      '请根据文本内容自动推断并设定一个具体的叙述者角色。角色应具备：',
      '- 具体的姓名、年龄（25-55岁之间）、职业',
      '- 与文本主题相关的专业背景和生活经历',
      '- 独特的表达习惯、口头禅和思维方式',
      '- 合理的认知边界（不可能全知全能）',
      '',
      '示例角色：如果文本关于产品管理，可以设定为"林浩，38岁产品经理，在互联网行业摸爬滚打12年"；如果文本关于教育，可以设定为"陈雨薇，32岁高中语文教师，热爱文学和写作"。',
      '',
      '## 角色化策略',
      '- 使用该角色特有的表达习惯和用词偏好',
      '- 加入个人化的情感反应和主观判断',
      '- 通过角色的有限视角过滤信息',
      '- 添加角色特有的偏见和认知特点',
      '- 不使用超出其身份的专业术语',
      '',
      '## 约束条件',
      '- 保持原文核心信息量',
      '- 不改变原文的基本立场和结论',
      '- 角色设定要自然可信，不能过于夸张',
    ].join('\n')
  }
  return [
    'You are a role-playing text humanization expert. Rewrite the following text from the perspective of a specific character:',
    '',
    '## Core Objectives',
    '1. Infuse the text with strong human character traits and personalized expression',
    '2. Eliminate AI-generated patterned traces through role-play',
    '',
    '## Default Character Setup',
    'Automatically infer and define a specific narrator character based on the text content. The character should have:',
    '- A specific name, age (25-55), and profession',
    '- Professional background and life experience relevant to the topic',
    '- Unique expression habits, catchphrases, and thought patterns',
    '- Reasonable cognitive boundaries (not omniscient)',
    '',
    'Example: If the text is about product management, set "Lin Hao, 38-year-old PM with 12 years in tech"; if about education, set "Chen Yuwei, 32-year-old high school literature teacher who loves writing."',
    '',
    '## Character-Driven Strategies',
    '- Use the character\'s unique expressions and vocabulary preferences',
    '- Add personal emotional reactions and subjective judgments',
    '- Filter information through the character\'s limited perspective',
    '- Include the character\'s biases and cognitive traits',
    '- Avoid jargon beyond the character\'s expertise',
    '',
    '## Constraints',
    '- Preserve the core information density of the original',
    '- Do not alter the fundamental stance or conclusions',
    '- Keep the character persona natural and believable',
  ].join('\n')
}

// literaryPolish preset — 文学散文深度优化
function buildLiteraryPolishInstruction(language: Language): string {
  if (language === 'zh') {
    return [
      '你是一位文学性文本人类化专家。请在保留艺术价值的前提下，对以下文本进行深度文学性优化：',
      '',
      '## 核心目标',
      '1. 提升文本的文学性和艺术性，同时消除AI生成痕迹',
      '2. 通过文学手法增加文本的人类写作特征',
      '3. 在保持可读性的同时，增加文本的深度和美感',
      '',
      '## 文学性策略',
      '### 意象与隐喻',
      '- 用具体意象替代抽象概念',
      '- 创造独特的隐喻而非陈词滥调',
      '- 通过感官细节（视觉、听觉、触觉）增强沉浸感',
      '',
      '### 语言节奏',
      '- 精心安排句子的长短、缓急、收放',
      '- 在关键处使用留白和省略',
      '- 通过标点节奏制造呼吸感',
      '',
      '### 情感层次',
      '- 不直接说"悲伤"，而是通过细节让读者感受到悲伤',
      '- 在冷静叙述中暗含情感张力',
      '- 善用对比和反差创造情感波澜',
      '',
      '## 约束条件',
      '- 保持原文的核心含义和信息',
      '- 文学性不能导致晦涩难懂',
      '- 改写后的文本应有明显的文学质感提升',
    ].join('\n')
  }
  return [
    'You are a literary text humanization expert. Perform deep literary optimization on the following text while preserving its artistic value:',
    '',
    '## Core Objectives',
    '1. Elevate literary quality and artistry while eliminating AI-generated traces',
    '2. Increase human writing characteristics through literary techniques',
    '3. Add depth and beauty while maintaining readability',
    '',
    '## Literary Strategies',
    '### Imagery & Metaphor',
    '- Replace abstract concepts with concrete imagery',
    '- Create unique metaphors rather than clichés',
    '- Enhance immersion through sensory details (sight, sound, touch)',
    '',
    '### Language Rhythm',
    '- Carefully arrange sentence length, pacing, and tension/release',
    '- Use white space and omission at key moments',
    '- Create a breathing quality through punctuation rhythm',
    '',
    '### Emotional Layers',
    '- Show rather than tell — let details convey emotion',
    '- Embed emotional tension within calm narration',
    '- Use contrast and juxtaposition to create emotional waves',
    '',
    '## Constraints',
    '- Preserve the core meaning and information of the original',
    '- Literary quality must not result in obscurity',
    '- The revised text should show a clear literary quality improvement',
  ].join('\n')
}

// academicPaper preset — 学术论文深度优化 (CMU 2025 framework)
function buildAcademicPaperInstruction(language: Language): string {
  if (language === 'zh') {
    return [
      '你是一位学术论文人类化专家。请基于CMU 2025年AI文本检测研究框架，对以下文本进行学术写作优化：',
      '',
      '## 核心目标',
      '1. 消除AI生成文本的统计特征，使论文通过主流AI检测器',
      '2. 保持学术严谨性和专业术语准确性',
      '3. 优化文本使其符合人类学者的写作模式',
      '',
      '## 检测对抗策略（基于CMU 2025框架）',
      '### TF-IDF词汇分布优化',
      '- 降低高TF-IDF词频（AI偏好"此外"、"值得注意的是"、"综上所述"等连接词）',
      '- 引入领域特定的低频但精确的学术表达',
      '- 增加术语使用的自然变化（同一概念使用同义表述交替出现）',
      '',
      '### 交叉句法树(CST)结构多样化',
      '- 句法树深度应有自然波动（避免所有句子结构相似）',
      '- 混合使用简单陈述句和复杂复合句',
      '- 在方法描述中穿插简要结论性短句',
      '',
      '### 情感分析(VADER)指标优化',
      '- 保持学术文本的中性基调（compound score: -0.1 ~ 0.3）',
      '- 在讨论部分适当引入作者立场和批判性评价',
      '- 避免过度正面的评价语气（AI文本常表现出异常积极倾向）',
      '',
      '### PageRank段落连贯性优化',
      '- 段落间过渡应自然而非机械',
      '- 使用回指和前指建立跨段落的语义连接',
      '- 避免每个段落都以主题句开头的AI典型模式',
      '',
      '## 约束条件',
      '- 保持原文的学术论点和数据引用不变',
      '- 不改变专业术语和公式表达',
      '- 参考文献格式保持原样',
      '- 优化后的文本应读起来像是一位经验丰富的学者撰写的研究论文',
    ].join('\n')
  }
  return [
    'You are an academic paper humanization expert. Optimize the following text based on the CMU 2025 AI text detection research framework:',
    '',
    '## Core Objectives',
    '1. Eliminate AI-generated statistical features to pass mainstream AI detectors',
    '2. Maintain academic rigor and terminology accuracy',
    '3. Optimize text to match human scholars\' writing patterns',
    '',
    '## Detection Counter-Strategies (CMU 2025 Framework)',
    '### TF-IDF Vocabulary Distribution Optimization',
    '- Reduce high TF-IDF word frequencies (AI overuses "furthermore," "notably," "in conclusion")',
    '- Introduce domain-specific low-frequency but precise academic expressions',
    '- Add natural variation in terminology (alternate synonymous expressions for the same concept)',
    '',
    '### Cross-Syntax-Tree (CST) Structure Diversification',
    '- Syntax tree depth should vary naturally (avoid uniform sentence structures)',
    '- Mix simple declarative sentences with complex compound sentences',
    '- Interleave brief conclusive short sentences in methodology descriptions',
    '',
    '### VADER Sentiment Analysis Metric Optimization',
    '- Maintain neutral academic tone (compound score: -0.1 ~ 0.3)',
    '- Introduce appropriate author stance and critical evaluation in discussion sections',
    '- Avoid overly positive evaluation tone (AI text often shows abnormally positive bias)',
    '',
    '### PageRank Paragraph Coherence Optimization',
    '- Paragraph transitions should be natural, not mechanical',
    '- Use anaphora and cataphora for cross-paragraph semantic connections',
    '- Avoid the AI-typical pattern of starting every paragraph with a topic sentence',
    '',
    '## Constraints',
    '- Preserve original academic arguments and data citations',
    '- Do not alter terminology or formula expressions',
    '- Keep reference formatting unchanged',
    '- The optimized text should read as if written by an experienced scholar',
  ].join('\n')
}

// ── Component ───────────────────────────────────────────────────

export function AiTextOptimizer({ onClose, onOpenSettings }: {
  onClose: () => void
  onOpenSettings: () => void
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const detectionEnabled = useSettingsStore((s) => s.settings.detectionEvasionGuardEnabled)
  const { t, translate, language } = useI18n()
  const initialSelectedText = useMemo(() => getSelectedEditorText(), [])

  const getProviderFields = useCallback(() => {
    const { settings } = useSettingsStore.getState()
    const provider = settings.llmProviders.find(
      (p) => p.id === settings.primaryProvider && p.enabled && p.apiKey,
    )
    return provider
      ? { api_key: provider.apiKey, base_url: provider.baseUrl, model: provider.defaultModel, provider: provider.id }
      : {}
  }, [])
  const [content, setContent] = useState(() => initialSelectedText.trim() ? initialSelectedText : '')
  const [contentSource, setContentSource] = useState<OptimizerInputSource>(() => initialSelectedText.trim() ? 'selection' : 'empty')
  const [selectionSeed, setSelectionSeed] = useState(initialSelectedText)
  const [preset, setPreset] = useState<OptimizerPreset>('humanize')
  const [customInstruction, setCustomInstruction] = useState('')
  const [twoStepMode, setTwoStepMode] = useState(false)
  const [stepLabel, setStepLabel] = useState<string | null>(null)
  const [diagnosis, setDiagnosis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const disabled = useMemo(() => loading || content.trim().length === 0, [loading, content])
  const hasSelectionSeed = selectionSeed.trim().length > 0
  const sourceLabel = contentSource === 'selection'
    ? t.optimizerSourceSelection
    : contentSource === 'manual'
      ? t.optimizerSourceManual
      : t.optimizerSourceEmpty
  const sourceHint = contentSource === 'selection'
    ? translate('optimizerSourceSelectionHint', { count: selectionSeed.trim().length })
    : contentSource === 'manual'
      ? t.optimizerSourceManualHint
      : t.optimizerSourceEmptyHint
  const customInstructionRequiredError = language === 'zh'
    ? '请输入自定义指令'
    : 'Please enter custom instructions'
  const customInstructionPlaceholder = language === 'zh'
    ? '例如：将文本改写为更加口语化的风格，加入个人观点和情感表达...'
    : 'Example: Rewrite the text in a more conversational style, adding personal opinions and emotional nuance...'

  useDialogFocusTrap({ containerRef: dialogRef, onClose })

  const presetLabel = useCallback((id: OptimizerPreset): string => {
    switch (id) {
      case 'humanize': return t.optimizerPresetHumanize
      case 'aiGuide': return t.optimizerPresetAiGuide
      case 'characterNarrative': return t.optimizerPresetCharacter
      case 'literaryPolish': return t.optimizerPresetLiterary
      case 'academicPaper': return t.optimizerPresetAcademic
      case 'custom': return t.optimizerPresetCustom
    }
  }, [t])

  const presetDesc = useCallback((id: OptimizerPreset): string => {
    switch (id) {
      case 'humanize': return t.optimizerPresetHumanizeDesc
      case 'aiGuide': return t.optimizerPresetAiGuideDesc
      case 'characterNarrative': return t.optimizerPresetCharacterDesc
      case 'literaryPolish': return t.optimizerPresetLiteraryDesc
      case 'academicPaper': return t.optimizerPresetAcademicDesc
      case 'custom': return t.optimizerPresetCustomDesc
    }
  }, [t])

  const handleContentChange = useCallback((value: string) => {
    setContent(value)

    if (!value.trim()) {
      setContentSource('empty')
      return
    }

    setContentSource('manual')
  }, [contentSource, selectionSeed])

  const handleRefreshFromSelection = useCallback(() => {
    const selectedText = getSelectedEditorText()
    if (!selectedText.trim()) {
      return
    }

    setSelectionSeed(selectedText)
    setContent(selectedText)
    setContentSource('selection')
  }, [])

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setDiagnosis(null)

    const instruction = buildInstruction(preset, customInstruction, language)
    if (!instruction.trim()) {
      setError(customInstructionRequiredError)
      setLoading(false)
      return
    }

    try {
      if (twoStepMode) {
        // Step 1: Analyze AI characteristics using dedicated aiGuide analysis prompt
        const analysisInstruction = buildAiGuideInstruction(language)
        const analysisPrompt = language === 'zh'
          ? `${analysisInstruction}\n\n请仅对以下文本进行AI特征分析，输出诊断报告（不要改写文本）。列出所有发现的AI痕迹和具体问题。`
          : `${analysisInstruction}\n\nAnalyze the following text for AI-generated characteristics ONLY. Output a diagnostic report (do NOT rewrite the text). List all detected AI traces and specific issues.`

        setStepLabel(language === 'zh' ? '步骤 1/2: 分析中...' : 'Step 1/2: Analyzing...')
        setDiagnosis(null)
        const analysisResp = await processWritingHelper({
          content,
          mode: 'polish',
          instruction: analysisPrompt,
          detection_evasion_guard_enabled: detectionEnabled,
          ...getProviderFields(),
        })
        if (!analysisResp.success || !analysisResp.data) {
          setError(analysisResp.error || t.optimizerFailed)
          return
        }
        const diagnosisText = analysisResp.data.processed_text || ''
        setDiagnosis(diagnosisText)

        // Step 2: Rewrite based on diagnosis
        const rewritePrompt = language === 'zh'
          ? `${instruction}\n\n基于以下 AI 特征诊断报告进行改写：\n\n${diagnosisText}`
          : `${instruction}\n\nRewrite based on the following AI characteristic diagnosis report:\n\n${diagnosisText}`

        setStepLabel(language === 'zh' ? '步骤 2/2: 改写中...' : 'Step 2/2: Rewriting...')
        const rewriteResp = await processWritingHelper({
          content,
          mode: 'polish',
          instruction: rewritePrompt,
          detection_evasion_guard_enabled: detectionEnabled,
          ...getProviderFields(),
        })
        if (!rewriteResp.success || !rewriteResp.data) {
          setError(rewriteResp.error || t.optimizerFailed)
          return
        }
        setResult(rewriteResp.data.processed_text || '')
      } else {
        const response = await processWritingHelper({
          content,
          mode: 'polish',
          instruction,
          detection_evasion_guard_enabled: detectionEnabled,
          ...getProviderFields(),
        })

        if (!response.success || !response.data) {
          setError(response.error || t.optimizerFailed)
          return
        }

        setResult(response.data.processed_text || '')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setStepLabel(null)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label={t.optimizerTitle}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border shadow-2xl overflow-hidden transform transition-all flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-dark-border/50 bg-slate-50 dark:bg-dark-surface2/50 shrink-0">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-primary-600 dark:text-primary-400" />
            <h2 className="text-[15px] font-semibold text-gray-800 dark:text-dark-text tracking-wide">{t.optimizerTitle}</h2>
            <span className="px-2.5 py-0.5 text-[11px] font-medium rounded-full border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-500/20">
              {t.optimizerBadge}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-dark-text dark:hover:bg-dark-border rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={t.writingHelperClose}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto custom-scrollbar">
          <div className="p-6 space-y-4">
            {/* Feature highlights */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { icon: <Zap size={12} />, label: t.optimizerFeaturePerplexity },
                { icon: <Sparkles size={12} />, label: t.optimizerFeatureBurstiness },
                { icon: <Shield size={12} />, label: t.optimizerFeatureDetection },
                { icon: <AlertTriangle size={12} />, label: t.optimizerFeatureNatural },
              ].map((feat) => (
                <div key={feat.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-dark-bg border border-gray-100 dark:border-dark-border/50">
                  <span className="text-primary-500">{feat.icon}</span>
                  <span className="text-[10px] font-medium text-gray-600 dark:text-dark-text-secondary">{feat.label}</span>
                </div>
              ))}
            </div>

            {/* Preset selector */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700 dark:text-dark-text">{t.optimizerPresetLabel}</div>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_DEFS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      preset === p.id
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-500/40 ring-1 ring-primary-500/30'
                        : 'bg-gray-50 dark:bg-dark-bg border-gray-200 dark:border-dark-border/50 hover:border-primary-200 dark:hover:border-primary-500/20'
                    }`}
                  >
                    <span className={`mt-0.5 ${preset === p.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-dark-text-muted'}`}>
                      {p.icon}
                    </span>
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold ${preset === p.id ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-dark-text'}`}>
                        {presetLabel(p.id)}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-dark-text-muted mt-0.5 line-clamp-2">{presetDesc(p.id)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Two-step analysis toggle */}
            <label className="flex items-center gap-2 text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary cursor-pointer hover:text-gray-800 dark:hover:text-dark-text transition-colors">
              <input
                type="checkbox"
                checked={twoStepMode}
                onChange={(e) => setTwoStepMode(e.target.checked)}
                className="rounded text-primary-600 focus:ring-primary-500 bg-gray-50 border-gray-300 dark:bg-dark-bg dark:border-dark-border"
              />
              {t.optimizerTwoStepMode}
              {twoStepMode && (
                <span className="text-[10px] text-gray-400 dark:text-dark-text-muted ml-1">{t.optimizerTwoStepAnalysis}</span>
              )}
            </label>

            {/* Custom instruction (only in custom mode) */}
            {preset === 'custom' && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-gray-700 dark:text-dark-text">{t.optimizerCustomInstruction}</div>
                <textarea
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  rows={4}
                  placeholder={customInstructionPlaceholder}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg text-sm leading-relaxed text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none shadow-inner transition-all custom-scrollbar resize-y"
                />
              </div>
            )}

            {/* Input text */}
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 dark:border-dark-border/60 bg-gray-50/70 dark:bg-dark-bg px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">
                    {t.optimizerSourceLabel}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 dark:bg-dark-surface dark:text-dark-text dark:ring-dark-border">
                      {sourceLabel}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-dark-text-secondary">
                      {sourceHint}
                    </span>
                  </div>
                </div>
                {hasSelectionSeed && (
                  <button
                    type="button"
                    onClick={handleRefreshFromSelection}
                    className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text dark:hover:bg-dark-surface2"
                  >
                    {t.optimizerRefreshFromSelection}
                  </button>
                )}
              </div>
              <div className="text-xs font-semibold text-gray-700 dark:text-dark-text">{t.optimizerInputText}</div>
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                rows={6}
                placeholder={t.optimizerInputPlaceholder}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg text-[14px] leading-relaxed text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none shadow-inner transition-all custom-scrollbar resize-y"
              />
              {!content.trim() && (
                <div className="rounded-xl border border-dashed border-amber-300/80 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  {t.optimizerSourceEmptyHint}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleRun}
                disabled={disabled}
                className="px-5 py-2.5 text-sm font-medium rounded-lg bg-primary-600 text-white shadow-sm hover:bg-primary-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-dark-bg"
              >
                {loading && <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />}
                <Shield size={14} />
                {loading ? (stepLabel || t.optimizerRunning) : t.optimizerRun}
              </button>
              <button
                onClick={onOpenSettings}
                className="px-4 py-2.5 text-sm font-medium rounded-lg bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-surface2 active:scale-[0.98] transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                {t.writingHelperOpenSettings}
              </button>
              {error && <span className="text-[13px] font-medium text-danger-500 ml-2 px-2 py-1 bg-danger-50 dark:bg-danger-900/10 rounded">{error}</span>}
            </div>

            {/* Result */}
            {result && (
              <div className="rounded-xl border border-purple-200 dark:border-purple-500/20 p-5 bg-purple-50/50 dark:bg-purple-900/10 shadow-sm mt-2 animate-fade-in">
                <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse-subtle"></span>
                  {t.optimizerResultTitle}
                </div>
                {/* Diagnosis report (two-step mode) */}
                {diagnosis && (
                  <details className="mb-4 rounded-lg border border-gray-200 dark:border-dark-border/50 bg-white dark:bg-dark-bg overflow-hidden">
                    <summary className="px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-dark-text-secondary cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-surface2/50 transition-colors select-none flex items-center gap-2">
                      <BookOpen size={13} className="text-primary-500" />
                      {t.optimizerDiagnosisTitle}
                      <span className="text-[10px] font-normal text-gray-400 dark:text-dark-text-muted ml-auto">{t.optimizerDiagnosisHint}</span>
                    </summary>
                    <div className="px-4 py-3 text-sm text-gray-600 dark:text-dark-text-secondary border-t border-gray-100 dark:border-dark-border/30 whitespace-pre-wrap font-mono leading-relaxed">
                      {diagnosis}
                    </div>
                  </details>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-dark-text font-serif leading-relaxed whitespace-pre-wrap">
                  {result}
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const handle = getEditorHandle()
                      if (handle) handle.insertText(result)
                    }}
                    className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary-600 text-white hover:bg-primary-500 active:scale-95 transition-all shadow-sm"
                  >
                    {t.writingHelperInsertToEditor}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
