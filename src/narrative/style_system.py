# -*- coding: utf-8 -*-
"""
风格学习与模仿系统 (Style Learning & Imitation System)

实现 30 维风格向量，滑动窗口漂移检测，风格学习与匹配。

维度设计基于:
1. 词汇层 (Lexical): 词汇丰富度、平均词长、专业术语密度等
2. 句法层 (Syntactic): 句子长度、句式复杂度、从句比例等
3. 修辞层 (Rhetorical): 比喻密度、排比使用、反问频率等
4. 节奏层 (Rhythmic): 段落长度、标点节奏、停顿模式等
5. 语气层 (Tone): 正式度、情感倾向、主观性等
6. 叙事层 (Narrative): 视角一致性、时态分布、对话比例等
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
from collections import deque
import re
import math
import json


# ============================================================
# 风格维度定义
# ============================================================

class StyleDimension(Enum):
    """30 维风格特征枚举"""
    # 词汇层 (1-5)
    VOCABULARY_RICHNESS = "vocabulary_richness"      # 词汇丰富度 (TTR)
    AVG_WORD_LENGTH = "avg_word_length"              # 平均词长
    RARE_WORD_RATIO = "rare_word_ratio"              # 低频词比例
    TECHNICAL_DENSITY = "technical_density"          # 专业术语密度
    COLLOQUIAL_RATIO = "colloquial_ratio"            # 口语化程度

    # 句法层 (6-10)
    AVG_SENTENCE_LENGTH = "avg_sentence_length"      # 平均句长
    SENTENCE_COMPLEXITY = "sentence_complexity"      # 句式复杂度
    CLAUSE_RATIO = "clause_ratio"                    # 从句比例
    PASSIVE_RATIO = "passive_ratio"                  # 被动句比例
    INTERROGATIVE_RATIO = "interrogative_ratio"      # 疑问句比例

    # 修辞层 (11-15)
    METAPHOR_DENSITY = "metaphor_density"            # 比喻密度
    PARALLELISM_FREQ = "parallelism_freq"            # 排比频率
    RHETORICAL_QUESTION = "rhetorical_question"      # 反问频率
    HYPERBOLE_LEVEL = "hyperbole_level"              # 夸张程度
    PERSONIFICATION = "personification"              # 拟人频率

    # 节奏层 (16-20)
    AVG_PARAGRAPH_LENGTH = "avg_paragraph_length"    # 平均段落长度
    PUNCTUATION_RHYTHM = "punctuation_rhythm"        # 标点节奏
    PAUSE_PATTERN = "pause_pattern"                  # 停顿模式
    SENTENCE_VARIATION = "sentence_variation"        # 句长变化度
    DIALOGUE_PACING = "dialogue_pacing"              # 对话节奏

    # 语气层 (21-25)
    FORMALITY_LEVEL = "formality_level"              # 正式度
    EMOTIONAL_VALENCE = "emotional_valence"          # 情感倾向
    SUBJECTIVITY = "subjectivity"                    # 主观性
    CERTAINTY_LEVEL = "certainty_level"              # 确定性程度
    INTIMACY_LEVEL = "intimacy_level"                # 亲密度

    # 叙事层 (26-30)
    POV_CONSISTENCY = "pov_consistency"              # 视角一致性
    TENSE_DISTRIBUTION = "tense_distribution"        # 时态分布
    DIALOGUE_RATIO = "dialogue_ratio"                # 对话比例
    DESCRIPTION_DENSITY = "description_density"      # 描写密度
    SHOWING_VS_TELLING = "showing_vs_telling"        # 展示 vs 叙述


# ============================================================
# 数据结构
# ============================================================

@dataclass
class StyleVector:
    """
    30 维风格向量

    每个维度值范围 [0.0, 1.0]，表示该特征的强度
    """
    # 词汇层
    vocabulary_richness: float = 0.5      # 词汇丰富度
    avg_word_length: float = 0.5          # 平均词长 (归一化)
    rare_word_ratio: float = 0.3          # 低频词比例
    technical_density: float = 0.2        # 专业术语密度
    colloquial_ratio: float = 0.3         # 口语化程度

    # 句法层
    avg_sentence_length: float = 0.5      # 平均句长 (归一化)
    sentence_complexity: float = 0.5      # 句式复杂度
    clause_ratio: float = 0.3             # 从句比例
    passive_ratio: float = 0.2            # 被动句比例
    interrogative_ratio: float = 0.1      # 疑问句比例

    # 修辞层
    metaphor_density: float = 0.3         # 比喻密度
    parallelism_freq: float = 0.2         # 排比频率
    rhetorical_question: float = 0.1      # 反问频率
    hyperbole_level: float = 0.2          # 夸张程度
    personification: float = 0.2          # 拟人频率

    # 节奏层
    avg_paragraph_length: float = 0.5     # 平均段落长度 (归一化)
    punctuation_rhythm: float = 0.5       # 标点节奏
    pause_pattern: float = 0.5            # 停顿模式
    sentence_variation: float = 0.5       # 句长变化度
    dialogue_pacing: float = 0.5          # 对话节奏

    # 语气层
    formality_level: float = 0.5          # 正式度
    emotional_valence: float = 0.5        # 情感倾向 (0=负面, 0.5=中性, 1=正面)
    subjectivity: float = 0.5             # 主观性
    certainty_level: float = 0.5          # 确定性程度
    intimacy_level: float = 0.5           # 亲密度

    # 叙事层
    pov_consistency: float = 0.8          # 视角一致性
    tense_distribution: float = 0.5       # 时态分布
    dialogue_ratio: float = 0.3           # 对话比例
    description_density: float = 0.5      # 描写密度
    showing_vs_telling: float = 0.5       # 展示 vs 叙述

    def to_array(self) -> List[float]:
        """转换为数组"""
        return [
            self.vocabulary_richness, self.avg_word_length, self.rare_word_ratio,
            self.technical_density, self.colloquial_ratio,
            self.avg_sentence_length, self.sentence_complexity, self.clause_ratio,
            self.passive_ratio, self.interrogative_ratio,
            self.metaphor_density, self.parallelism_freq, self.rhetorical_question,
            self.hyperbole_level, self.personification,
            self.avg_paragraph_length, self.punctuation_rhythm, self.pause_pattern,
            self.sentence_variation, self.dialogue_pacing,
            self.formality_level, self.emotional_valence, self.subjectivity,
            self.certainty_level, self.intimacy_level,
            self.pov_consistency, self.tense_distribution, self.dialogue_ratio,
            self.description_density, self.showing_vs_telling
        ]

    @classmethod
    def from_array(cls, arr: List[float]) -> "StyleVector":
        """从数组创建"""
        if len(arr) != 30:
            raise ValueError(f"Expected 30 dimensions, got {len(arr)}")
        return cls(
            vocabulary_richness=arr[0], avg_word_length=arr[1], rare_word_ratio=arr[2],
            technical_density=arr[3], colloquial_ratio=arr[4],
            avg_sentence_length=arr[5], sentence_complexity=arr[6], clause_ratio=arr[7],
            passive_ratio=arr[8], interrogative_ratio=arr[9],
            metaphor_density=arr[10], parallelism_freq=arr[11], rhetorical_question=arr[12],
            hyperbole_level=arr[13], personification=arr[14],
            avg_paragraph_length=arr[15], punctuation_rhythm=arr[16], pause_pattern=arr[17],
            sentence_variation=arr[18], dialogue_pacing=arr[19],
            formality_level=arr[20], emotional_valence=arr[21], subjectivity=arr[22],
            certainty_level=arr[23], intimacy_level=arr[24],
            pov_consistency=arr[25], tense_distribution=arr[26], dialogue_ratio=arr[27],
            description_density=arr[28], showing_vs_telling=arr[29]
        )

    def to_dict(self) -> Dict[str, float]:
        """转换为字典"""
        return {
            "vocabulary_richness": self.vocabulary_richness,
            "avg_word_length": self.avg_word_length,
            "rare_word_ratio": self.rare_word_ratio,
            "technical_density": self.technical_density,
            "colloquial_ratio": self.colloquial_ratio,
            "avg_sentence_length": self.avg_sentence_length,
            "sentence_complexity": self.sentence_complexity,
            "clause_ratio": self.clause_ratio,
            "passive_ratio": self.passive_ratio,
            "interrogative_ratio": self.interrogative_ratio,
            "metaphor_density": self.metaphor_density,
            "parallelism_freq": self.parallelism_freq,
            "rhetorical_question": self.rhetorical_question,
            "hyperbole_level": self.hyperbole_level,
            "personification": self.personification,
            "avg_paragraph_length": self.avg_paragraph_length,
            "punctuation_rhythm": self.punctuation_rhythm,
            "pause_pattern": self.pause_pattern,
            "sentence_variation": self.sentence_variation,
            "dialogue_pacing": self.dialogue_pacing,
            "formality_level": self.formality_level,
            "emotional_valence": self.emotional_valence,
            "subjectivity": self.subjectivity,
            "certainty_level": self.certainty_level,
            "intimacy_level": self.intimacy_level,
            "pov_consistency": self.pov_consistency,
            "tense_distribution": self.tense_distribution,
            "dialogue_ratio": self.dialogue_ratio,
            "description_density": self.description_density,
            "showing_vs_telling": self.showing_vs_telling,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, float]) -> "StyleVector":
        """从字典创建"""
        return cls(**{k: d.get(k, 0.5) for k in cls.__dataclass_fields__})

    def distance(self, other: "StyleVector") -> float:
        """计算两个风格向量的欧氏距离"""
        arr1 = self.to_array()
        arr2 = other.to_array()
        return math.sqrt(sum((a - b) ** 2 for a, b in zip(arr1, arr2)))

    def cosine_similarity(self, other: "StyleVector") -> float:
        """计算余弦相似度"""
        arr1 = self.to_array()
        arr2 = other.to_array()
        dot = sum(a * b for a, b in zip(arr1, arr2))
        norm1 = math.sqrt(sum(a ** 2 for a in arr1))
        norm2 = math.sqrt(sum(b ** 2 for b in arr2))
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return dot / (norm1 * norm2)


@dataclass
class StyleProfile:
    """风格档案 - 包含风格向量和元数据"""
    name: str                              # 风格名称 (如作者名或风格标签)
    vector: StyleVector                    # 风格向量
    sample_count: int = 1                  # 样本数量
    description: str = ""                  # 风格描述
    tags: List[str] = field(default_factory=list)  # 风格标签
    source_texts: List[str] = field(default_factory=list)  # 来源文本片段

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "name": self.name,
            "vector": self.vector.to_dict(),
            "sample_count": self.sample_count,
            "description": self.description,
            "tags": self.tags,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "StyleProfile":
        """从字典创建"""
        return cls(
            name=d["name"],
            vector=StyleVector.from_dict(d["vector"]),
            sample_count=d.get("sample_count", 1),
            description=d.get("description", ""),
            tags=d.get("tags", []),
        )


@dataclass
class DriftEvent:
    """风格漂移事件"""
    position: int                          # 发生位置 (字符偏移)
    segment_index: int                     # 片段索引
    drift_magnitude: float                 # 漂移幅度
    drifted_dimensions: List[str]          # 漂移维度
    before_vector: StyleVector             # 漂移前向量
    after_vector: StyleVector              # 漂移后向量
    severity: str = "minor"                # 严重程度: minor/moderate/severe

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "position": self.position,
            "segment_index": self.segment_index,
            "drift_magnitude": self.drift_magnitude,
            "drifted_dimensions": self.drifted_dimensions,
            "severity": self.severity,
        }


@dataclass
class StyleMatchResult:
    """风格匹配结果"""
    target_profile: str                    # 目标风格名称
    similarity: float                      # 相似度 [0, 1]
    distance: float                        # 距离
    dimension_scores: Dict[str, float]     # 各维度得分
    suggestions: List[str] = field(default_factory=list)  # 改进建议

    @property
    def match_level(self) -> str:
        """匹配等级"""
        if self.similarity >= 0.9:
            return "excellent"
        elif self.similarity >= 0.75:
            return "good"
        elif self.similarity >= 0.6:
            return "fair"
        elif self.similarity >= 0.4:
            return "weak"
        else:
            return "poor"


# ============================================================
# 风格分析器
# ============================================================

class StyleAnalyzer:
    """
    风格分析器

    分析文本并提取 30 维风格向量
    """

    # 中文标点符号
    CN_PUNCTUATION = set("，。！？、；：""''（）【】《》—…·")

    # 中文句末标点
    CN_SENTENCE_END = set("。！？")

    # 口语化词汇模式
    COLLOQUIAL_PATTERNS = [
        r"啊[，。！？]", r"呢[，。！？]", r"吧[，。！？]", r"嘛[，。！？]",
        r"哦[，。！？]", r"呀[，。！？]", r"哎[，。！？]", r"嗯[，。！？]",
    ]

    # 比喻标志词
    METAPHOR_MARKERS = ["像", "如同", "仿佛", "好像", "犹如", "宛如", "恰似", "般"]

    # 被动句标志
    PASSIVE_MARKERS = ["被", "受到", "遭到", "得到", "获得"]

    # 疑问词
    QUESTION_MARKERS = ["吗", "呢", "？", "怎么", "为什么", "什么", "哪", "谁", "几"]

    # 拟人动词
    PERSONIFICATION_VERBS = ["说", "唱", "笑", "哭", "跳", "舞", "叹息", "低语", "呢喃"]

    def __init__(self, llm=None):
        """
        初始化分析器

        Args:
            llm: LLM 客户端，用于高级分析（可选）
        """
        self.llm = llm

    def analyze(self, text: str) -> StyleVector:
        """
        分析文本，提取 30 维风格向量

        Args:
            text: 待分析文本

        Returns:
            StyleVector: 30 维风格向量
        """
        if not text or not text.strip():
            return StyleVector()

        # 预处理
        paragraphs = self._split_paragraphs(text)
        sentences = self._split_sentences(text)
        words = self._tokenize(text)

        # 提取各层特征
        lexical = self._analyze_lexical(text, words)
        syntactic = self._analyze_syntactic(text, sentences)
        rhetorical = self._analyze_rhetorical(text, sentences)
        rhythmic = self._analyze_rhythmic(text, paragraphs, sentences)
        tone = self._analyze_tone(text, sentences)
        narrative = self._analyze_narrative(text, sentences)

        return StyleVector(
            # 词汇层
            vocabulary_richness=lexical["vocabulary_richness"],
            avg_word_length=lexical["avg_word_length"],
            rare_word_ratio=lexical["rare_word_ratio"],
            technical_density=lexical["technical_density"],
            colloquial_ratio=lexical["colloquial_ratio"],
            # 句法层
            avg_sentence_length=syntactic["avg_sentence_length"],
            sentence_complexity=syntactic["sentence_complexity"],
            clause_ratio=syntactic["clause_ratio"],
            passive_ratio=syntactic["passive_ratio"],
            interrogative_ratio=syntactic["interrogative_ratio"],
            # 修辞层
            metaphor_density=rhetorical["metaphor_density"],
            parallelism_freq=rhetorical["parallelism_freq"],
            rhetorical_question=rhetorical["rhetorical_question"],
            hyperbole_level=rhetorical["hyperbole_level"],
            personification=rhetorical["personification"],
            # 节奏层
            avg_paragraph_length=rhythmic["avg_paragraph_length"],
            punctuation_rhythm=rhythmic["punctuation_rhythm"],
            pause_pattern=rhythmic["pause_pattern"],
            sentence_variation=rhythmic["sentence_variation"],
            dialogue_pacing=rhythmic["dialogue_pacing"],
            # 语气层
            formality_level=tone["formality_level"],
            emotional_valence=tone["emotional_valence"],
            subjectivity=tone["subjectivity"],
            certainty_level=tone["certainty_level"],
            intimacy_level=tone["intimacy_level"],
            # 叙事层
            pov_consistency=narrative["pov_consistency"],
            tense_distribution=narrative["tense_distribution"],
            dialogue_ratio=narrative["dialogue_ratio"],
            description_density=narrative["description_density"],
            showing_vs_telling=narrative["showing_vs_telling"],
        )

    async def analyze_with_llm(
        self,
        text: str,
        context: Optional[Dict[str, Any]] = None
    ) -> StyleVector:
        """
        使用 LLM 辅助分析风格

        Args:
            text: 待分析文本
            context: 上下文信息

        Returns:
            StyleVector: 30 维风格向量
        """
        # 先进行基础分析
        base_vector = self.analyze(text)

        if self.llm is None:
            return base_vector

        # LLM 辅助分析修辞和叙事层
        prompt = STYLE_ANALYSIS_PROMPT.format(
            text=text[:2000],  # 限制长度
            base_analysis=json.dumps(base_vector.to_dict(), ensure_ascii=False, indent=2)
        )

        try:
            response = await self.llm.ainvoke(prompt)
            result = json.loads(response.content)

            # 更新修辞和叙事层
            if "rhetorical" in result:
                base_vector.metaphor_density = result["rhetorical"].get("metaphor_density", base_vector.metaphor_density)
                base_vector.hyperbole_level = result["rhetorical"].get("hyperbole_level", base_vector.hyperbole_level)
                base_vector.personification = result["rhetorical"].get("personification", base_vector.personification)

            if "narrative" in result:
                base_vector.showing_vs_telling = result["narrative"].get("showing_vs_telling", base_vector.showing_vs_telling)
                base_vector.description_density = result["narrative"].get("description_density", base_vector.description_density)

        except Exception:
            pass  # LLM 分析失败时使用基础分析结果

        return base_vector

    # ============================================================
    # 私有方法 - 文本预处理
    # ============================================================

    def _split_paragraphs(self, text: str) -> List[str]:
        """分割段落"""
        paragraphs = re.split(r'\n\s*\n|\n', text)
        return [p.strip() for p in paragraphs if p.strip()]

    def _split_sentences(self, text: str) -> List[str]:
        """分割句子"""
        # 中文句子分割
        sentences = re.split(r'[。！？]', text)
        return [s.strip() for s in sentences if s.strip()]

    def _tokenize(self, text: str) -> List[str]:
        """简单分词 (按字符/空格)"""
        # 移除标点
        clean_text = re.sub(r'[^\w\s\u4e00-\u9fff]', '', text)
        # 中文按字符，英文按空格
        tokens = []
        current_word = ""
        for char in clean_text:
            if '\u4e00' <= char <= '\u9fff':
                if current_word:
                    tokens.append(current_word)
                    current_word = ""
                tokens.append(char)
            elif char.isspace():
                if current_word:
                    tokens.append(current_word)
                    current_word = ""
            else:
                current_word += char
        if current_word:
            tokens.append(current_word)
        return tokens

    # ============================================================
    # 私有方法 - 特征提取
    # ============================================================

    def _analyze_lexical(self, text: str, words: List[str]) -> Dict[str, float]:
        """词汇层分析"""
        if not words:
            return {
                "vocabulary_richness": 0.5,
                "avg_word_length": 0.5,
                "rare_word_ratio": 0.3,
                "technical_density": 0.2,
                "colloquial_ratio": 0.3,
            }

        # 词汇丰富度 (Type-Token Ratio)
        unique_words = set(words)
        ttr = len(unique_words) / len(words) if words else 0
        vocabulary_richness = min(ttr * 2, 1.0)  # 归一化

        # 平均词长 (中文按字符数)
        avg_len = sum(len(w) for w in words) / len(words)
        avg_word_length = min(avg_len / 4, 1.0)  # 归一化 (4字为基准)

        # 低频词比例 (简化: 长度 >= 3 视为低频)
        rare_count = sum(1 for w in words if len(w) >= 3)
        rare_word_ratio = rare_count / len(words) if words else 0

        # 专业术语密度 (简化: 检测特定模式)
        technical_patterns = [r'\d+', r'[a-zA-Z]+', r'[％%°]']
        technical_count = sum(
            1 for pattern in technical_patterns
            for _ in re.findall(pattern, text)
        )
        technical_density = min(technical_count / len(text) * 10, 1.0) if text else 0

        # 口语化程度
        colloquial_count = sum(
            len(re.findall(pattern, text))
            for pattern in self.COLLOQUIAL_PATTERNS
        )
        colloquial_ratio = min(colloquial_count / len(words) * 5, 1.0) if words else 0

        return {
            "vocabulary_richness": vocabulary_richness,
            "avg_word_length": avg_word_length,
            "rare_word_ratio": rare_word_ratio,
            "technical_density": technical_density,
            "colloquial_ratio": colloquial_ratio,
        }

    def _analyze_syntactic(self, text: str, sentences: List[str]) -> Dict[str, float]:
        """句法层分析"""
        if not sentences:
            return {
                "avg_sentence_length": 0.5,
                "sentence_complexity": 0.5,
                "clause_ratio": 0.3,
                "passive_ratio": 0.2,
                "interrogative_ratio": 0.1,
            }

        # 平均句长
        avg_len = sum(len(s) for s in sentences) / len(sentences)
        avg_sentence_length = min(avg_len / 50, 1.0)  # 50字为基准

        # 句式复杂度 (通过逗号数量估计)
        comma_counts = [s.count("，") + s.count(",") for s in sentences]
        avg_commas = sum(comma_counts) / len(sentences) if sentences else 0
        sentence_complexity = min(avg_commas / 5, 1.0)  # 5个逗号为高复杂度

        # 从句比例 (通过关联词检测)
        clause_markers = ["因为", "所以", "虽然", "但是", "如果", "那么", "当", "而"]
        clause_count = sum(
            1 for s in sentences
            if any(m in s for m in clause_markers)
        )
        clause_ratio = clause_count / len(sentences) if sentences else 0

        # 被动句比例
        passive_count = sum(
            1 for s in sentences
            if any(m in s for m in self.PASSIVE_MARKERS)
        )
        passive_ratio = passive_count / len(sentences) if sentences else 0

        # 疑问句比例
        interrogative_count = sum(
            1 for s in sentences
            if any(m in s for m in self.QUESTION_MARKERS)
        )
        interrogative_ratio = interrogative_count / len(sentences) if sentences else 0

        return {
            "avg_sentence_length": avg_sentence_length,
            "sentence_complexity": sentence_complexity,
            "clause_ratio": clause_ratio,
            "passive_ratio": passive_ratio,
            "interrogative_ratio": interrogative_ratio,
        }

    def _analyze_rhetorical(self, text: str, sentences: List[str]) -> Dict[str, float]:
        """修辞层分析"""
        if not sentences:
            return {
                "metaphor_density": 0.3,
                "parallelism_freq": 0.2,
                "rhetorical_question": 0.1,
                "hyperbole_level": 0.2,
                "personification": 0.2,
            }

        # 比喻密度
        metaphor_count = sum(
            1 for marker in self.METAPHOR_MARKERS
            if marker in text
        )
        metaphor_density = min(metaphor_count / len(sentences), 1.0)

        # 排比频率 (检测连续相似结构)
        parallelism_count = 0
        for i in range(len(sentences) - 2):
            if self._is_parallel(sentences[i:i+3]):
                parallelism_count += 1
        parallelism_freq = min(parallelism_count / max(len(sentences) - 2, 1) * 3, 1.0)

        # 反问频率 (包含疑问标记但非真正提问)
        rhetorical_patterns = ["难道", "何必", "岂", "怎能"]
        rhetorical_count = sum(
            1 for pattern in rhetorical_patterns
            if pattern in text
        )
        rhetorical_question = min(rhetorical_count / len(sentences) * 2, 1.0)

        # 夸张程度
        hyperbole_patterns = ["最", "极", "非常", "无比", "绝对", "永远", "千万", "万分"]
        hyperbole_count = sum(
            len(re.findall(pattern, text))
            for pattern in hyperbole_patterns
        )
        hyperbole_level = min(hyperbole_count / len(sentences), 1.0)

        # 拟人频率 (非人类主语 + 人类动词)
        personification_count = sum(
            1 for verb in self.PERSONIFICATION_VERBS
            if verb in text
        )
        personification = min(personification_count / len(sentences) * 0.5, 1.0)

        return {
            "metaphor_density": metaphor_density,
            "parallelism_freq": parallelism_freq,
            "rhetorical_question": rhetorical_question,
            "hyperbole_level": hyperbole_level,
            "personification": personification,
        }

    def _analyze_rhythmic(
        self,
        text: str,
        paragraphs: List[str],
        sentences: List[str]
    ) -> Dict[str, float]:
        """节奏层分析"""
        if not paragraphs or not sentences:
            return {
                "avg_paragraph_length": 0.5,
                "punctuation_rhythm": 0.5,
                "pause_pattern": 0.5,
                "sentence_variation": 0.5,
                "dialogue_pacing": 0.5,
            }

        # 平均段落长度
        avg_para_len = sum(len(p) for p in paragraphs) / len(paragraphs)
        avg_paragraph_length = min(avg_para_len / 200, 1.0)  # 200字为基准

        # 标点节奏 (标点密度)
        punct_count = sum(1 for c in text if c in self.CN_PUNCTUATION)
        punctuation_rhythm = min(punct_count / len(text) * 10, 1.0) if text else 0.5

        # 停顿模式 (通过省略号和破折号)
        pause_markers = text.count("……") + text.count("——") + text.count("...")
        pause_pattern = min(pause_markers / len(paragraphs), 1.0)

        # 句长变化度 (标准差)
        if len(sentences) > 1:
            lengths = [len(s) for s in sentences]
            mean_len = sum(lengths) / len(lengths)
            variance = sum((l - mean_len) ** 2 for l in lengths) / len(lengths)
            std_dev = math.sqrt(variance)
            sentence_variation = min(std_dev / 20, 1.0)  # 归一化
        else:
            sentence_variation = 0.5

        # 对话节奏 (对话标记密度)
        dialogue_markers = text.count('"') + text.count("「") + text.count("」")
        dialogue_pacing = min(dialogue_markers / len(paragraphs) * 0.5, 1.0)

        return {
            "avg_paragraph_length": avg_paragraph_length,
            "punctuation_rhythm": punctuation_rhythm,
            "pause_pattern": pause_pattern,
            "sentence_variation": sentence_variation,
            "dialogue_pacing": dialogue_pacing,
        }

    def _analyze_tone(self, text: str, sentences: List[str]) -> Dict[str, float]:
        """语气层分析"""
        if not sentences:
            return {
                "formality_level": 0.5,
                "emotional_valence": 0.5,
                "subjectivity": 0.5,
                "certainty_level": 0.5,
                "intimacy_level": 0.5,
            }

        # 正式度 (通过敬语和书面语检测)
        formal_markers = ["请", "您", "贵", "敬", "恳请", "诚"]
        informal_markers = ["你", "我", "咱", "俺", "啥", "咋"]
        formal_count = sum(1 for m in formal_markers if m in text)
        informal_count = sum(1 for m in informal_markers if m in text)
        if formal_count + informal_count > 0:
            formality_level = formal_count / (formal_count + informal_count)
        else:
            formality_level = 0.5

        # 情感倾向
        positive_markers = ["喜欢", "爱", "美", "好", "快乐", "幸福", "温暖", "希望"]
        negative_markers = ["恨", "讨厌", "坏", "痛", "悲伤", "绝望", "冷", "害怕"]
        pos_count = sum(1 for m in positive_markers if m in text)
        neg_count = sum(1 for m in negative_markers if m in text)
        if pos_count + neg_count > 0:
            emotional_valence = (pos_count + 1) / (pos_count + neg_count + 2)
        else:
            emotional_valence = 0.5

        # 主观性 (通过第一人称和观点词)
        subjective_markers = ["我觉得", "我认为", "我想", "也许", "可能", "大概"]
        subjective_count = sum(1 for m in subjective_markers if m in text)
        first_person = text.count("我")
        subjectivity = min((subjective_count + first_person * 0.1) / len(sentences), 1.0)

        # 确定性程度
        uncertain_markers = ["也许", "可能", "大概", "或许", "似乎", "好像"]
        certain_markers = ["一定", "必须", "绝对", "肯定", "确实", "当然"]
        uncertain_count = sum(1 for m in uncertain_markers if m in text)
        certain_count = sum(1 for m in certain_markers if m in text)
        if uncertain_count + certain_count > 0:
            certainty_level = certain_count / (uncertain_count + certain_count)
        else:
            certainty_level = 0.5

        # 亲密度 (通过称呼和语气词)
        intimate_markers = ["亲爱的", "宝贝", "亲", "呢", "啦", "哦"]
        intimate_count = sum(1 for m in intimate_markers if m in text)
        intimacy_level = min(intimate_count / len(sentences), 1.0)

        return {
            "formality_level": formality_level,
            "emotional_valence": emotional_valence,
            "subjectivity": subjectivity,
            "certainty_level": certainty_level,
            "intimacy_level": intimacy_level,
        }

    def _analyze_narrative(self, text: str, sentences: List[str]) -> Dict[str, float]:
        """叙事层分析"""
        if not sentences:
            return {
                "pov_consistency": 0.8,
                "tense_distribution": 0.5,
                "dialogue_ratio": 0.3,
                "description_density": 0.5,
                "showing_vs_telling": 0.5,
            }

        # 视角一致性 (检测人称混用)
        first_person = "我" in text or "我们" in text
        second_person = "你" in text or "你们" in text
        third_person = "他" in text or "她" in text or "它" in text
        pov_count = sum([first_person, second_person, third_person])
        pov_consistency = 1.0 if pov_count <= 1 else (1.0 - (pov_count - 1) * 0.3)

        # 时态分布 (中文较难检测，简化处理)
        past_markers = ["了", "过", "曾经", "当时"]
        present_markers = ["正在", "正", "着"]
        past_count = sum(text.count(m) for m in past_markers)
        present_count = sum(text.count(m) for m in present_markers)
        if past_count + present_count > 0:
            tense_distribution = past_count / (past_count + present_count)
        else:
            tense_distribution = 0.5

        # 对话比例
        dialogue_chars = 0
        in_dialogue = False
        for char in text:
            if char in ['"', "「"]:
                in_dialogue = True
            elif char in ['"', "」"]:
                in_dialogue = False
            elif in_dialogue:
                dialogue_chars += 1
        dialogue_ratio = dialogue_chars / len(text) if text else 0

        # 描写密度 (形容词和副词密度估计)
        description_markers = ["的", "地", "得"]
        description_count = sum(text.count(m) for m in description_markers)
        description_density = min(description_count / len(text) * 5, 1.0) if text else 0.5

        # 展示 vs 叙述 (动作词 vs 状态词)
        action_markers = ["走", "跑", "说", "看", "听", "拿", "放", "打", "踢"]
        telling_markers = ["是", "有", "感到", "觉得", "认为"]
        action_count = sum(text.count(m) for m in action_markers)
        telling_count = sum(text.count(m) for m in telling_markers)
        if action_count + telling_count > 0:
            showing_vs_telling = action_count / (action_count + telling_count)
        else:
            showing_vs_telling = 0.5

        return {
            "pov_consistency": max(0, pov_consistency),
            "tense_distribution": tense_distribution,
            "dialogue_ratio": dialogue_ratio,
            "description_density": description_density,
            "showing_vs_telling": showing_vs_telling,
        }

    def _is_parallel(self, sentences: List[str]) -> bool:
        """检测是否为排比结构"""
        if len(sentences) < 3:
            return False

        # 简化: 检查长度是否相近
        lengths = [len(s) for s in sentences]
        avg_len = sum(lengths) / len(lengths)
        variance = sum((l - avg_len) ** 2 for l in lengths) / len(lengths)

        # 长度差异小于平均长度的 30%
        return variance < (avg_len * 0.3) ** 2


# ============================================================
# 风格漂移检测器
# ============================================================

class StyleDriftDetector:
    """
    风格漂移检测器

    使用滑动窗口检测文本中的风格漂移
    """

    def __init__(
        self,
        window_size: int = 500,       # 窗口大小 (字符数)
        stride: int = 100,            # 步进大小
        threshold: float = 0.15,      # 漂移阈值
        analyzer: Optional[StyleAnalyzer] = None
    ):
        """
        初始化检测器

        Args:
            window_size: 滑动窗口大小
            stride: 窗口步进
            threshold: 漂移检测阈值 (欧氏距离)
            analyzer: 风格分析器实例
        """
        self.window_size = window_size
        self.stride = stride
        self.threshold = threshold
        self.analyzer = analyzer or StyleAnalyzer()

        # 历史窗口
        self._window_history: deque = deque(maxlen=10)

    def detect(self, text: str) -> List[DriftEvent]:
        """
        检测文本中的风格漂移

        Args:
            text: 待检测文本

        Returns:
            List[DriftEvent]: 漂移事件列表
        """
        if len(text) < self.window_size * 2:
            return []  # 文本太短

        events = []
        vectors = []
        positions = []

        # 滑动窗口分析
        for i in range(0, len(text) - self.window_size, self.stride):
            window_text = text[i:i + self.window_size]
            vector = self.analyzer.analyze(window_text)
            vectors.append(vector)
            positions.append(i)

        if len(vectors) < 2:
            return []

        # 检测相邻窗口的漂移
        for i in range(1, len(vectors)):
            distance = vectors[i].distance(vectors[i-1])

            if distance > self.threshold:
                # 找出漂移维度
                drifted_dims = self._find_drifted_dimensions(
                    vectors[i-1], vectors[i]
                )

                # 确定严重程度
                if distance > self.threshold * 3:
                    severity = "severe"
                elif distance > self.threshold * 2:
                    severity = "moderate"
                else:
                    severity = "minor"

                events.append(DriftEvent(
                    position=positions[i],
                    segment_index=i,
                    drift_magnitude=distance,
                    drifted_dimensions=drifted_dims,
                    before_vector=vectors[i-1],
                    after_vector=vectors[i],
                    severity=severity
                ))

        return events

    def detect_against_reference(
        self,
        text: str,
        reference: StyleVector
    ) -> List[DriftEvent]:
        """
        检测相对于参考风格的漂移

        Args:
            text: 待检测文本
            reference: 参考风格向量

        Returns:
            List[DriftEvent]: 漂移事件列表
        """
        events = []

        for i in range(0, len(text) - self.window_size, self.stride):
            window_text = text[i:i + self.window_size]
            vector = self.analyzer.analyze(window_text)
            distance = vector.distance(reference)

            if distance > self.threshold:
                drifted_dims = self._find_drifted_dimensions(reference, vector)

                if distance > self.threshold * 3:
                    severity = "severe"
                elif distance > self.threshold * 2:
                    severity = "moderate"
                else:
                    severity = "minor"

                events.append(DriftEvent(
                    position=i,
                    segment_index=i // self.stride,
                    drift_magnitude=distance,
                    drifted_dimensions=drifted_dims,
                    before_vector=reference,
                    after_vector=vector,
                    severity=severity
                ))

        return events

    def get_stability_score(self, text: str) -> float:
        """
        计算风格稳定性分数

        Args:
            text: 待检测文本

        Returns:
            float: 稳定性分数 [0, 1]，1 表示完全稳定
        """
        events = self.detect(text)
        if not events:
            return 1.0

        # 基于漂移事件数量和严重程度计算
        severity_weights = {"minor": 0.1, "moderate": 0.3, "severe": 0.5}
        total_penalty = sum(
            severity_weights.get(e.severity, 0.1)
            for e in events
        )

        # 归一化
        max_events = len(text) // self.stride
        normalized_penalty = total_penalty / max(max_events, 1)

        return max(0, 1.0 - normalized_penalty)

    def _find_drifted_dimensions(
        self,
        before: StyleVector,
        after: StyleVector,
        threshold: float = 0.1
    ) -> List[str]:
        """找出变化显著的维度"""
        drifted = []
        before_dict = before.to_dict()
        after_dict = after.to_dict()

        for dim in before_dict:
            diff = abs(after_dict[dim] - before_dict[dim])
            if diff > threshold:
                drifted.append(dim)

        return drifted


# ============================================================
# 风格匹配器
# ============================================================

class StyleMatcher:
    """
    风格学习与匹配系统

    学习目标风格，评估文本匹配度，生成改进建议
    """

    def __init__(
        self,
        analyzer: Optional[StyleAnalyzer] = None,
        llm=None
    ):
        """
        初始化匹配器

        Args:
            analyzer: 风格分析器
            llm: LLM 客户端，用于生成建议
        """
        self.analyzer = analyzer or StyleAnalyzer()
        self.llm = llm

        # 已学习的风格档案
        self._profiles: Dict[str, StyleProfile] = {}

    def learn(
        self,
        name: str,
        texts: List[str],
        description: str = "",
        tags: Optional[List[str]] = None
    ) -> StyleProfile:
        """
        学习一种风格

        Args:
            name: 风格名称
            texts: 样本文本列表
            description: 风格描述
            tags: 风格标签

        Returns:
            StyleProfile: 学习到的风格档案
        """
        if not texts:
            raise ValueError("At least one sample text is required")

        # 分析每个样本
        vectors = [self.analyzer.analyze(text) for text in texts]

        # 计算平均向量
        avg_vector = self._average_vectors(vectors)

        profile = StyleProfile(
            name=name,
            vector=avg_vector,
            sample_count=len(texts),
            description=description,
            tags=tags or [],
            source_texts=[t[:200] for t in texts]  # 保存片段
        )

        self._profiles[name] = profile
        return profile

    def match(
        self,
        text: str,
        target_name: str
    ) -> StyleMatchResult:
        """
        评估文本与目标风格的匹配度

        Args:
            text: 待评估文本
            target_name: 目标风格名称

        Returns:
            StyleMatchResult: 匹配结果
        """
        if target_name not in self._profiles:
            raise ValueError(f"Unknown style profile: {target_name}")

        target = self._profiles[target_name]
        text_vector = self.analyzer.analyze(text)

        # 计算相似度和距离
        similarity = text_vector.cosine_similarity(target.vector)
        distance = text_vector.distance(target.vector)

        # 计算各维度得分
        dimension_scores = self._compute_dimension_scores(
            text_vector, target.vector
        )

        # 生成建议
        suggestions = self._generate_suggestions(
            text_vector, target.vector, dimension_scores
        )

        return StyleMatchResult(
            target_profile=target_name,
            similarity=similarity,
            distance=distance,
            dimension_scores=dimension_scores,
            suggestions=suggestions
        )

    def find_closest_style(self, text: str) -> Tuple[str, float]:
        """
        找出最接近的已学习风格

        Args:
            text: 待匹配文本

        Returns:
            Tuple[str, float]: (风格名称, 相似度)
        """
        if not self._profiles:
            return ("", 0.0)

        text_vector = self.analyzer.analyze(text)

        best_name = ""
        best_similarity = -1.0

        for name, profile in self._profiles.items():
            similarity = text_vector.cosine_similarity(profile.vector)
            if similarity > best_similarity:
                best_similarity = similarity
                best_name = name

        return (best_name, best_similarity)

    def get_profile(self, name: str) -> Optional[StyleProfile]:
        """获取风格档案"""
        return self._profiles.get(name)

    def list_profiles(self) -> List[str]:
        """列出所有已学习的风格"""
        return list(self._profiles.keys())

    def export_profiles(self) -> Dict[str, Any]:
        """导出所有风格档案"""
        return {
            name: profile.to_dict()
            for name, profile in self._profiles.items()
        }

    def import_profiles(self, data: Dict[str, Any]) -> int:
        """
        导入风格档案

        Args:
            data: 导出的档案数据

        Returns:
            int: 导入的档案数量
        """
        count = 0
        for name, profile_data in data.items():
            try:
                profile = StyleProfile.from_dict(profile_data)
                self._profiles[name] = profile
                count += 1
            except Exception:
                continue
        return count

    async def generate_style_guide(self, name: str) -> str:
        """
        生成风格指南

        Args:
            name: 风格名称

        Returns:
            str: 风格指南文本
        """
        if name not in self._profiles:
            raise ValueError(f"Unknown style profile: {name}")

        profile = self._profiles[name]
        vector = profile.vector

        if self.llm is None:
            return self._generate_basic_guide(profile)

        prompt = STYLE_GUIDE_PROMPT.format(
            name=name,
            description=profile.description,
            vector=json.dumps(vector.to_dict(), ensure_ascii=False, indent=2),
            samples="\n---\n".join(profile.source_texts[:3])
        )

        try:
            response = await self.llm.ainvoke(prompt)
            return response.content
        except Exception:
            return self._generate_basic_guide(profile)

    def _average_vectors(self, vectors: List[StyleVector]) -> StyleVector:
        """计算向量平均值"""
        if not vectors:
            return StyleVector()

        arrays = [v.to_array() for v in vectors]
        avg_array = [
            sum(arr[i] for arr in arrays) / len(arrays)
            for i in range(30)
        ]
        return StyleVector.from_array(avg_array)

    def _compute_dimension_scores(
        self,
        text_vector: StyleVector,
        target_vector: StyleVector
    ) -> Dict[str, float]:
        """计算各维度匹配得分"""
        text_dict = text_vector.to_dict()
        target_dict = target_vector.to_dict()

        scores = {}
        for dim in text_dict:
            diff = abs(text_dict[dim] - target_dict[dim])
            scores[dim] = max(0, 1.0 - diff)

        return scores

    def _generate_suggestions(
        self,
        text_vector: StyleVector,
        target_vector: StyleVector,
        scores: Dict[str, float]
    ) -> List[str]:
        """生成改进建议"""
        suggestions = []

        # 找出得分最低的维度
        sorted_dims = sorted(scores.items(), key=lambda x: x[1])

        text_dict = text_vector.to_dict()
        target_dict = target_vector.to_dict()

        for dim, score in sorted_dims[:5]:  # 最多 5 条建议
            if score < 0.7:
                diff = target_dict[dim] - text_dict[dim]
                suggestion = self._get_dimension_suggestion(dim, diff)
                if suggestion:
                    suggestions.append(suggestion)

        return suggestions

    def _get_dimension_suggestion(self, dimension: str, diff: float) -> str:
        """获取单个维度的建议"""
        direction = "增加" if diff > 0 else "减少"

        suggestions_map = {
            "vocabulary_richness": f"{direction}词汇多样性，使用更多同义词",
            "avg_word_length": f"{direction}词语长度，{'使用更多书面语' if diff > 0 else '使用更简洁的表达'}",
            "colloquial_ratio": f"{direction}口语化程度",
            "avg_sentence_length": f"{direction}句子长度",
            "sentence_complexity": f"{direction}句式复杂度",
            "metaphor_density": f"{direction}比喻的使用",
            "formality_level": f"{direction}正式程度",
            "emotional_valence": f"调整情感基调，使其更{'积极' if diff > 0 else '克制'}",
            "dialogue_ratio": f"{direction}对话比例",
            "showing_vs_telling": f"{'多用展示少用叙述' if diff > 0 else '适当增加叙述'}",
        }

        return suggestions_map.get(dimension, "")

    def _generate_basic_guide(self, profile: StyleProfile) -> str:
        """生成基础风格指南"""
        v = profile.vector

        guide = f"""# {profile.name} 风格指南

## 概述
{profile.description or '(无描述)'}

## 风格特征

### 词汇层
- 词汇丰富度: {'高' if v.vocabulary_richness > 0.6 else '中' if v.vocabulary_richness > 0.3 else '低'}
- 口语化程度: {'高' if v.colloquial_ratio > 0.5 else '中' if v.colloquial_ratio > 0.2 else '低'}

### 句法层
- 句子长度: {'长' if v.avg_sentence_length > 0.6 else '中' if v.avg_sentence_length > 0.3 else '短'}
- 句式复杂度: {'高' if v.sentence_complexity > 0.6 else '中' if v.sentence_complexity > 0.3 else '低'}

### 修辞层
- 比喻使用: {'频繁' if v.metaphor_density > 0.5 else '适中' if v.metaphor_density > 0.2 else '较少'}

### 语气层
- 正式度: {'正式' if v.formality_level > 0.6 else '中性' if v.formality_level > 0.3 else '随意'}
- 情感倾向: {'积极' if v.emotional_valence > 0.6 else '中性' if v.emotional_valence > 0.4 else '消极'}

### 叙事层
- 对话比例: {'高' if v.dialogue_ratio > 0.4 else '中' if v.dialogue_ratio > 0.2 else '低'}
- 展示 vs 叙述: {'偏展示' if v.showing_vs_telling > 0.6 else '平衡' if v.showing_vs_telling > 0.4 else '偏叙述'}
"""
        return guide


# ============================================================
# LLM Prompts
# ============================================================

STYLE_ANALYSIS_PROMPT = """
## 风格深度分析

请分析以下文本的风格特征，特别关注修辞和叙事技巧。

**文本**:
{text}

**基础分析结果**:
{base_analysis}

请补充以下方面的分析，输出 JSON 格式:

```json
{{
    "rhetorical": {{
        "metaphor_density": 0.0-1.0,
        "metaphor_examples": ["比喻示例..."],
        "hyperbole_level": 0.0-1.0,
        "personification": 0.0-1.0
    }},
    "narrative": {{
        "showing_vs_telling": 0.0-1.0,
        "description_density": 0.0-1.0,
        "narrative_techniques": ["使用的叙事技巧..."]
    }},
    "overall_impression": "整体风格印象描述"
}}
```
"""

STYLE_GUIDE_PROMPT = """
## 生成风格指南

请根据以下风格档案生成一份详细的写作风格指南。

**风格名称**: {name}
**描述**: {description}

**风格向量**:
{vector}

**样本片段**:
{samples}

请生成一份包含以下内容的风格指南:
1. 风格概述 (100字以内)
2. 词汇选择建议
3. 句式结构建议
4. 修辞手法建议
5. 语气和情感基调
6. 叙事技巧建议
7. 需要避免的写法

请使用 Markdown 格式输出。
"""
