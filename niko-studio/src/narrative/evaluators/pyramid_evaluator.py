# -*- coding: utf-8 -*-
"""
金字塔原理评估器 (Pyramid Evaluator)

评估文本的逻辑结构，基于芭芭拉·明托的金字塔原理：
1. 结论先行
2. 纵向结构（问答关系）
3. 横向结构（逻辑排列）
4. MECE原则
"""

from typing import Dict, Any, Optional, List
from .base import BaseEvaluator, EvaluationResult, Issue, Severity, ScoreLevel


class PyramidEvaluator(BaseEvaluator):
    """
    金字塔原理评估器
    
    评估维度：
    - conclusion_first: 结论先行程度
    - vertical_structure: 纵向逻辑（问答关系）
    - horizontal_structure: 横向逻辑（排列顺序）
    - mece_compliance: MECE原则遵循程度
    """
    
    @property
    def name(self) -> str:
        return "pyramid_evaluator"
    
    @property
    def description(self) -> str:
        return "评估文本的逻辑结构，检查金字塔原理的四大法则"
    
    @property
    def related_skill(self) -> str:
        return "pyramid-structure"
    
    # 结论先行的信号词
    CONCLUSION_SIGNALS = [
        "因此", "所以", "综上所述", "总之", "结论是", "我们认为",
        "建议", "应该", "必须", "核心观点是", "关键是", "重点是",
        "本文主张", "我们的结论", "答案是", "解决方案是"
    ]
    
    # 埋没结论的信号词（出现在开头是警告）
    BURIED_CONCLUSION_SIGNALS = [
        "首先让我们看看", "在讨论之前", "要理解这个问题",
        "背景是", "历史上", "众所周知", "一般来说"
    ]
    
    # 逻辑连接词
    LOGICAL_CONNECTORS = {
        "递进": ["此外", "而且", "更重要的是", "进一步", "不仅如此"],
        "因果": ["因为", "由于", "所以", "因此", "导致", "使得"],
        "转折": ["但是", "然而", "不过", "尽管如此", "相反"],
        "并列": ["同时", "另外", "一方面...另一方面", "既...又"],
        "总结": ["总之", "综上", "概括来说", "简言之"]
    }
    
    # 结构标记词
    STRUCTURE_MARKERS = [
        "第一", "第二", "第三", "首先", "其次", "最后",
        "一是", "二是", "三是", "1.", "2.", "3.",
        "一、", "二、", "三、"
    ]
    
    async def evaluate(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> EvaluationResult:
        """执行金字塔原理评估"""
        
        issues = []
        metrics = {}
        
        # 分段分析
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        sentences = self._split_sentences(content)
        
        # 1. 评估结论先行
        conclusion_score, conclusion_issues = self._evaluate_conclusion_first(
            content, paragraphs, sentences
        )
        metrics["conclusion_first"] = conclusion_score
        issues.extend(conclusion_issues)
        
        # 2. 评估纵向结构
        vertical_score, vertical_issues = self._evaluate_vertical_structure(
            content, paragraphs
        )
        metrics["vertical_structure"] = vertical_score
        issues.extend(vertical_issues)
        
        # 3. 评估横向结构
        horizontal_score, horizontal_issues = self._evaluate_horizontal_structure(
            content, paragraphs
        )
        metrics["horizontal_structure"] = horizontal_score
        issues.extend(horizontal_issues)
        
        # 4. 评估MECE原则
        mece_score, mece_issues = self._evaluate_mece(content, paragraphs)
        metrics["mece_compliance"] = mece_score
        issues.extend(mece_issues)
        
        # 计算总分（加权平均）
        weights = {
            "conclusion_first": 0.30,      # 结论先行最重要
            "vertical_structure": 0.25,
            "horizontal_structure": 0.25,
            "mece_compliance": 0.20
        }
        
        total_score = sum(
            metrics[k] * weights[k] for k in weights
        )
        
        # 生成摘要
        summary = self._generate_summary(total_score, metrics, issues)
        
        return EvaluationResult(
            evaluator_name=self.name,
            score=total_score,
            level=self._score_to_level(total_score),
            issues=issues,
            metrics=metrics,
            summary=summary
        )
    
    def _evaluate_conclusion_first(
        self,
        content: str,
        paragraphs: List[str],
        sentences: List[str]
    ) -> tuple:
        """评估结论先行程度"""
        issues = []
        score = 50  # 基础分
        
        if not paragraphs or not sentences:
            return score, issues
        
        first_para = paragraphs[0]
        first_sentences = sentences[:3] if len(sentences) >= 3 else sentences
        first_text = ' '.join(first_sentences)
        
        # 检查开头是否有结论信号
        has_conclusion_signal = any(
            signal in first_text for signal in self.CONCLUSION_SIGNALS
        )
        
        if has_conclusion_signal:
            score += 30
        else:
            issues.append(Issue(
                code="PYRAMID_NO_CONCLUSION_FIRST",
                message="开篇未明确陈述核心结论，读者可能需要阅读全文才能理解重点",
                severity=Severity.MAJOR,
                location="开头段落",
                suggestion="在文章开头明确陈述你的核心观点或结论",
                related_skill=self.related_skill
            ))
        
        # 检查是否埋没结论
        has_buried_signal = any(
            signal in first_para[:100] for signal in self.BURIED_CONCLUSION_SIGNALS
        )
        
        if has_buried_signal:
            score -= 15
            issues.append(Issue(
                code="PYRAMID_BURIED_CONCLUSION",
                message="开篇使用了背景铺垫式写法，结论可能被埋没",
                severity=Severity.MINOR,
                location="开头段落",
                suggestion="考虑将结论前置，背景信息可以作为支撑放在后面",
                related_skill=self.related_skill
            ))
        
        # 检查是否有结构预告
        structure_preview = any(
            marker in first_para for marker in ["三个", "几个方面", "以下", "将从"]
        )
        
        if structure_preview:
            score += 20
        
        return min(100, max(0, score)), issues
    
    def _evaluate_vertical_structure(
        self,
        content: str,
        paragraphs: List[str]
    ) -> tuple:
        """评估纵向结构（问答关系）"""
        issues = []
        score = 60  # 基础分
        
        # 检查因果连接词的使用
        causal_connectors = self.LOGICAL_CONNECTORS["因果"]
        causal_count = sum(
            content.count(conn) for conn in causal_connectors
        )
        
        if causal_count >= 3:
            score += 20
        elif causal_count >= 1:
            score += 10
        else:
            issues.append(Issue(
                code="PYRAMID_WEAK_CAUSAL_CHAIN",
                message="论证缺乏明确的因果链条，论点之间的逻辑关系不够清晰",
                severity=Severity.MINOR,
                location="全文",
                suggestion="使用'因为...所以...'等连接词明确论点间的逻辑关系",
                related_skill=self.related_skill
            ))
        
        # 检查是否有"为什么"的回应
        why_responses = ["原因是", "这是因为", "之所以", "理由是"]
        has_why_response = any(resp in content for resp in why_responses)
        
        if has_why_response:
            score += 15
        
        # 检查递进关系
        progressive_connectors = self.LOGICAL_CONNECTORS["递进"]
        progressive_count = sum(
            content.count(conn) for conn in progressive_connectors
        )
        
        if progressive_count >= 2:
            score += 5
        
        return min(100, max(0, score)), issues
    
    def _evaluate_horizontal_structure(
        self,
        content: str,
        paragraphs: List[str]
    ) -> tuple:
        """评估横向结构（逻辑排列）"""
        issues = []
        score = 60  # 基础分
        
        # 检查结构标记的使用
        marker_count = sum(
            1 for marker in self.STRUCTURE_MARKERS if marker in content
        )
        
        if marker_count >= 3:
            score += 25
        elif marker_count >= 2:
            score += 15
        elif marker_count == 0:
            issues.append(Issue(
                code="PYRAMID_NO_STRUCTURE_MARKERS",
                message="缺乏清晰的结构标记，同级论点的排列顺序不明确",
                severity=Severity.MINOR,
                location="全文",
                suggestion="使用'第一、第二、第三'或'首先、其次、最后'等标记组织论点",
                related_skill=self.related_skill
            ))
        
        # 检查并列结构
        parallel_markers = ["一方面", "另一方面", "同时", "此外"]
        parallel_count = sum(
            content.count(marker) for marker in parallel_markers
        )
        
        if parallel_count >= 2:
            score += 10
        
        # 检查总结句
        summary_markers = self.LOGICAL_CONNECTORS["总结"]
        has_summary = any(marker in content for marker in summary_markers)
        
        if has_summary:
            score += 5
        
        return min(100, max(0, score)), issues
    
    def _evaluate_mece(
        self,
        content: str,
        paragraphs: List[str]
    ) -> tuple:
        """评估MECE原则（相互独立，完全穷尽）"""
        issues = []
        score = 70  # 基础分，MECE难以自动精确评估
        
        # 检查是否有明确的分类框架
        framework_signals = [
            "从...角度", "分为...类", "包括以下几个方面",
            "可以分为", "主要有", "三个维度", "四个层面"
        ]
        
        has_framework = any(signal in content for signal in framework_signals)
        
        if has_framework:
            score += 15
        else:
            issues.append(Issue(
                code="PYRAMID_NO_CLEAR_FRAMEWORK",
                message="未使用明确的分类框架，可能存在论点重叠或遗漏",
                severity=Severity.INFO,
                location="全文",
                suggestion="考虑使用MECE框架（如3C、4P、What/Why/How）组织论点",
                related_skill=self.related_skill
            ))
        
        # 检查是否有重复词汇密集出现（可能暗示内容重叠）
        # 这是一个启发式检查，不完全准确
        words = content.replace('\n', ' ').split()
        if len(words) > 50:
            word_freq = {}
            for word in words:
                if len(word) > 2:  # 忽略短词
                    word_freq[word] = word_freq.get(word, 0) + 1
            
            # 如果某个词出现频率过高，可能暗示重复论述
            high_freq_words = [w for w, f in word_freq.items() if f > len(words) * 0.05]
            if len(high_freq_words) > 3:
                score -= 10
                issues.append(Issue(
                    code="PYRAMID_POSSIBLE_OVERLAP",
                    message="部分概念重复出现频率较高，可能存在论点重叠",
                    severity=Severity.INFO,
                    location="全文",
                    suggestion="检查各论点是否真正独立，避免重复论述相同内容",
                    related_skill=self.related_skill
                ))
        
        return min(100, max(0, score)), issues
    
    def _split_sentences(self, text: str) -> List[str]:
        """分句"""
        import re
        sentences = re.split(r'[。！？.!?]', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _generate_summary(
        self,
        score: float,
        metrics: Dict[str, float],
        issues: List[Issue]
    ) -> str:
        """生成评估摘要"""
        # 找出最弱维度
        weakest = min(metrics, key=metrics.get)
        strongest = max(metrics, key=metrics.get)
        
        dimension_names = {
            "conclusion_first": "结论先行",
            "vertical_structure": "纵向逻辑",
            "horizontal_structure": "横向结构",
            "mece_compliance": "MECE原则"
        }
        
        summary = f"逻辑结构得分：{score:.1f}/100。"
        summary += f"最强：{dimension_names.get(strongest, strongest)}，"
        summary += f"最弱：{dimension_names.get(weakest, weakest)}。"
        
        critical_count = sum(1 for i in issues if i.severity == Severity.CRITICAL)
        major_count = sum(1 for i in issues if i.severity == Severity.MAJOR)
        
        if critical_count > 0:
            summary += f"发现{critical_count}个严重结构问题需要修复。"
        elif major_count > 0:
            summary += f"发现{major_count}个主要结构问题建议优化。"
        
        return summary
    
    def quick_scan(self, content: str) -> EvaluationResult:
        """快速扫描（不使用LLM）"""
        issues = []
        
        # 简单检查：开头是否有结论信号
        first_200 = content[:200] if len(content) > 200 else content
        has_conclusion = any(
            signal in first_200 for signal in self.CONCLUSION_SIGNALS
        )
        
        # 检查结构标记
        has_structure = any(
            marker in content for marker in self.STRUCTURE_MARKERS
        )
        
        score = 50
        if has_conclusion:
            score += 25
        else:
            issues.append(Issue(
                code="PYRAMID_NO_CONCLUSION_FIRST",
                message="开篇可能未明确陈述结论",
                severity=Severity.MAJOR,
                related_skill=self.related_skill
            ))
        
        if has_structure:
            score += 25
        else:
            issues.append(Issue(
                code="PYRAMID_NO_STRUCTURE_MARKERS",
                message="缺乏结构标记",
                severity=Severity.MINOR,
                related_skill=self.related_skill
            ))
        
        return EvaluationResult(
            evaluator_name=self.name,
            score=score,
            level=self._score_to_level(score),
            issues=issues,
            summary=f"快速扫描：逻辑结构得分{score}/100"
        )
