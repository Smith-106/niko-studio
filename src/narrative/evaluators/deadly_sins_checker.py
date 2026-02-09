# -*- coding: utf-8 -*-
"""
七个致命错误检查器 (Deadly Sins Checker)

基于《AI写作代理终极指南》的七个致命错误进行最终质量检查：
1. 结构漂移 (Structural Drift)
2. 情感真空 (Emotional Vacuum)
3. 叙事停滞 (Narrative Stagnation)
4. 麻木懦夫 (Apathetic Coward)
5. 无的放矢 (Aimless Plotting)
6. 声音缺失 (Faceless Narration)
7. 呈现混乱 (Chaotic Presentation)
"""

from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum
from .base import BaseEvaluator, EvaluationResult, Issue, Severity, ScoreLevel


class DeadlySin(Enum):
    """七个致命错误枚举"""
    STRUCTURAL_DRIFT = "structural_drift"           # 结构漂移
    EMOTIONAL_VACUUM = "emotional_vacuum"           # 情感真空
    NARRATIVE_STAGNATION = "narrative_stagnation"   # 叙事停滞
    APATHETIC_COWARD = "apathetic_coward"          # 麻木懦夫
    AIMLESS_PLOTTING = "aimless_plotting"          # 无的放矢
    FACELESS_NARRATION = "faceless_narration"      # 声音缺失
    CHAOTIC_PRESENTATION = "chaotic_presentation"   # 呈现混乱


@dataclass
class SinCheckResult:
    """单个致命错误检查结果"""
    sin: DeadlySin
    name_cn: str
    detected: bool
    severity: Severity
    score: float  # 0-100，越高越好（无此问题）
    diagnosis: str
    prescription: str
    related_skill: str


class DeadlySinsChecker(BaseEvaluator):
    """
    七个致命错误检查器
    
    作为写作的最终质量门禁，检查七大致命错误。
    """
    
    @property
    def name(self) -> str:
        return "deadly_sins_checker"
    
    @property
    def description(self) -> str:
        return "七个致命错误检查器 - 写作质量的最终防线"
    
    # 各致命错误的中文名和关联技能包
    SIN_INFO = {
        DeadlySin.STRUCTURAL_DRIFT: {
            "name_cn": "结构漂移",
            "skill": "pyramid-structure",
            "question": "核心结论是否在开篇明确？论证是否在金字塔上层层递进？"
        },
        DeadlySin.EMOTIONAL_VACUUM: {
            "name_cn": "情感真空",
            "skill": "fictional-dream",
            "question": "是否在'展示'而非'叙述'？是否引导读者经历情感阶梯？"
        },
        DeadlySin.NARRATIVE_STAGNATION: {
            "name_cn": "叙事停滞",
            "skill": "suspense-craft",
            "question": "开篇是否有故事问题？角色是否处于威胁之下？是否有紧迫感？"
        },
        DeadlySin.APATHETIC_COWARD: {
            "name_cn": "麻木懦夫",
            "skill": "character-forge",
            "question": "主角是否主动解决冲突？是否有驱动力、欲望和超越平庸的特质？"
        },
        DeadlySin.AIMLESS_PLOTTING: {
            "name_cn": "无的放矢",
            "skill": "premise-magic",
            "question": "故事是否有清晰的预设？每个场景是否服务于核心预设？"
        },
        DeadlySin.FACELESS_NARRATION: {
            "name_cn": "声音缺失",
            "skill": "voice-workshop",
            "question": "叙述语气是否统一有力？'谁'在讲故事？是否有明确的伪装？"
        },
        DeadlySin.CHAOTIC_PRESENTATION: {
            "name_cn": "呈现混乱",
            "skill": "presentation",
            "question": "格式是否清晰？过渡是否流畅？视觉元素是否强化结构？"
        }
    }
    
    async def evaluate(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> EvaluationResult:
        """执行七个致命错误检查"""
        
        context = context or {}
        sin_results: List[SinCheckResult] = []
        
        # 检查每个致命错误
        sin_results.append(self._check_structural_drift(content, context))
        sin_results.append(self._check_emotional_vacuum(content, context))
        sin_results.append(self._check_narrative_stagnation(content, context))
        sin_results.append(self._check_apathetic_coward(content, context))
        sin_results.append(self._check_aimless_plotting(content, context))
        sin_results.append(self._check_faceless_narration(content, context))
        sin_results.append(self._check_chaotic_presentation(content, context))
        
        # 转换为Issue列表
        issues = []
        metrics = {}
        
        for result in sin_results:
            metrics[result.sin.value] = result.score
            
            if result.detected:
                issues.append(Issue(
                    code=f"DEADLY_SIN_{result.sin.value.upper()}",
                    message=f"【{result.name_cn}】{result.diagnosis}",
                    severity=result.severity,
                    suggestion=result.prescription,
                    related_skill=result.related_skill
                ))
        
        # 计算总分
        total_score = sum(r.score for r in sin_results) / len(sin_results)
        
        # 统计致命错误数量
        critical_sins = [r for r in sin_results if r.detected and r.severity == Severity.CRITICAL]
        major_sins = [r for r in sin_results if r.detected and r.severity == Severity.MAJOR]
        
        # 生成摘要
        summary = self._generate_summary(total_score, sin_results, critical_sins, major_sins)
        
        return EvaluationResult(
            evaluator_name=self.name,
            score=total_score,
            level=self._score_to_level(total_score),
            issues=issues,
            metrics=metrics,
            summary=summary,
            raw_analysis={"sin_results": [self._sin_result_to_dict(r) for r in sin_results]}
        )
    
    def _check_structural_drift(self, content: str, context: Dict) -> SinCheckResult:
        """检查致命错误1：结构漂移"""
        sin = DeadlySin.STRUCTURAL_DRIFT
        info = self.SIN_INFO[sin]
        
        score = 70
        detected = False
        diagnosis = ""
        
        # 检查开头是否有结论信号
        conclusion_signals = ["因此", "所以", "我们认为", "结论是", "核心观点", "建议", "应该"]
        first_para = content[:500] if len(content) > 500 else content
        
        has_conclusion = any(sig in first_para for sig in conclusion_signals)
        
        # 检查结构标记
        structure_markers = ["第一", "第二", "首先", "其次", "1.", "2.", "一、", "二、"]
        has_structure = any(marker in content for marker in structure_markers)
        
        if not has_conclusion:
            score -= 30
            detected = True
            diagnosis = "开篇未明确陈述核心结论，读者在信息迷雾中摸索"
        
        if not has_structure:
            score -= 20
            if detected:
                diagnosis += "；论证缺乏层次结构"
            else:
                detected = True
                diagnosis = "论证缺乏清晰的层次结构"
        
        if not detected:
            diagnosis = "结构清晰，结论明确"
        
        return SinCheckResult(
            sin=sin,
            name_cn=info["name_cn"],
            detected=detected,
            severity=Severity.MAJOR if detected and score < 50 else Severity.MINOR if detected else Severity.INFO,
            score=max(0, score),
            diagnosis=diagnosis,
            prescription="将核心结论移至开篇，使用金字塔结构组织论证",
            related_skill=info["skill"]
        )
    
    def _check_emotional_vacuum(self, content: str, context: Dict) -> SinCheckResult:
        """检查致命错误2：情感真空"""
        sin = DeadlySin.EMOTIONAL_VACUUM
        info = self.SIN_INFO[sin]
        
        score = 70
        detected = False
        diagnosis = ""
        
        # 检查感官细节
        sensory_words = [
            "看到", "听到", "闻到", "触摸", "感觉", "温度", "颜色", "声音",
            "光线", "气味", "味道", "冰冷", "温暖", "刺痛", "颤抖"
        ]
        sensory_count = sum(1 for w in sensory_words if w in content)
        
        # 检查抽象情感词（过多是警告）
        abstract_emotions = [
            "高兴", "难过", "害怕", "愤怒", "紧张", "激动", "悲伤", "恐惧"
        ]
        abstract_count = sum(1 for w in abstract_emotions if w in content)
        
        # 理想比例：感官词 > 抽象情感词
        if sensory_count < 3:
            score -= 25
            detected = True
            diagnosis = "缺乏感官细节，读者难以'感受'场景"
        
        if abstract_count > sensory_count and abstract_count > 3:
            score -= 15
            if detected:
                diagnosis += "；过多直接陈述情感而非展示"
            else:
                detected = True
                diagnosis = "过多直接陈述情感，而非用细节展示"
        
        if not detected:
            diagnosis = "情感表达丰富，感官细节充足"
        
        return SinCheckResult(
            sin=sin,
            name_cn=info["name_cn"],
            detected=detected,
            severity=Severity.MAJOR if detected and score < 50 else Severity.MINOR if detected else Severity.INFO,
            score=max(0, score),
            diagnosis=diagnosis,
            prescription="用感官细节替代抽象情感词，'展示'而非'叙述'",
            related_skill=info["skill"]
        )
    
    def _check_narrative_stagnation(self, content: str, context: Dict) -> SinCheckResult:
        """检查致命错误3：叙事停滞"""
        sin = DeadlySin.NARRATIVE_STAGNATION
        info = self.SIN_INFO[sin]
        
        score = 70
        detected = False
        diagnosis = ""
        
        # 检查悬念元素
        question_signals = ["为什么", "如何", "是否", "究竟", "到底", "？"]
        question_count = sum(1 for sig in question_signals if sig in content)
        
        # 检查威胁/紧迫信号
        threat_signals = ["危险", "必须", "来不及", "只有", "最后", "如果不", "否则"]
        threat_count = sum(1 for sig in threat_signals if sig in content)
        
        # 检查时间紧迫
        urgency_signals = ["立刻", "马上", "紧急", "倒计时", "截止", "还剩"]
        urgency_count = sum(1 for sig in urgency_signals if sig in content)
        
        if question_count < 2:
            score -= 20
            detected = True
            diagnosis = "缺乏引发好奇的故事问题"
        
        if threat_count < 2:
            score -= 15
            if detected:
                diagnosis += "；角色未处于有意义的威胁之下"
            else:
                detected = True
                diagnosis = "角色未处于有意义的威胁之下"
        
        if not detected:
            diagnosis = "叙事有张力，悬念元素充足"
        
        return SinCheckResult(
            sin=sin,
            name_cn=info["name_cn"],
            detected=detected,
            severity=Severity.MAJOR if detected and score < 50 else Severity.MINOR if detected else Severity.INFO,
            score=max(0, score),
            diagnosis=diagnosis,
            prescription="提出故事问题、设置威胁情境、点燃时间导火索",
            related_skill=info["skill"]
        )
    
    def _check_apathetic_coward(self, content: str, context: Dict) -> SinCheckResult:
        """检查致命错误4：麻木懦夫"""
        sin = DeadlySin.APATHETIC_COWARD
        info = self.SIN_INFO[sin]
        
        score = 70
        detected = False
        diagnosis = ""
        
        # 检查主动行为词
        active_signals = ["决定", "选择", "行动", "出发", "面对", "反抗", "坚持", "拒绝"]
        active_count = sum(1 for sig in active_signals if sig in content)
        
        # 检查被动/忍受词
        passive_signals = ["忍受", "承受", "无奈", "只能", "被迫", "不得不"]
        passive_count = sum(1 for sig in passive_signals if sig in content)
        
        # 检查内心冲突
        conflict_signals = ["一方面", "另一方面", "既想", "又怕", "矛盾", "挣扎", "犹豫"]
        conflict_count = sum(1 for sig in conflict_signals if sig in content)
        
        if active_count < 2:
            score -= 20
            detected = True
            diagnosis = "角色缺乏主动性，未积极解决问题"
        
        if passive_count > active_count:
            score -= 15
            if detected:
                diagnosis += "；角色过于被动消极"
            else:
                detected = True
                diagnosis = "角色过于被动，只是忍受而非行动"
        
        if conflict_count < 1 and len(content) > 500:
            score -= 10
            if detected:
                diagnosis += "；缺乏内心冲突的展现"
        
        if not detected:
            diagnosis = "角色主动积极，有驱动力和内心冲突"
        
        return SinCheckResult(
            sin=sin,
            name_cn=info["name_cn"],
            detected=detected,
            severity=Severity.MAJOR if detected and score < 50 else Severity.MINOR if detected else Severity.INFO,
            score=max(0, score),
            diagnosis=diagnosis,
            prescription="赋予角色主动性、明确目标和内心冲突",
            related_skill=info["skill"]
        )
    
    def _check_aimless_plotting(self, content: str, context: Dict) -> SinCheckResult:
        """检查致命错误5：无的放矢"""
        sin = DeadlySin.AIMLESS_PLOTTING
        info = self.SIN_INFO[sin]
        
        score = 70
        detected = False
        diagnosis = ""
        
        # 从context获取预设
        premise = context.get("premise", "")
        
        if not premise:
            score -= 20
            detected = True
            diagnosis = "未提供故事预设，无法判断情节是否服务于核心主题"
        else:
            # 检查预设关键词是否在内容中出现
            premise_words = [w for w in premise.replace("，", " ").replace("。", " ").split() if len(w) > 1]
            premise_in_content = sum(1 for w in premise_words if w in content)
            
            if premise_in_content < len(premise_words) * 0.3:
                score -= 25
                detected = True
                diagnosis = f"内容与预设'{premise}'的关联不够紧密"
        
        # 检查因果链
        causal_signals = ["因为", "所以", "导致", "于是", "结果"]
        causal_count = sum(1 for sig in causal_signals if sig in content)
        
        if causal_count < 2:
            score -= 15
            if detected:
                diagnosis += "；情节之间缺乏因果关联"
            else:
                detected = True
                diagnosis = "情节之间缺乏明确的因果关联"
        
        if not detected:
            diagnosis = "情节紧扣预设，因果链条清晰"
        
        return SinCheckResult(
            sin=sin,
            name_cn=info["name_cn"],
            detected=detected,
            severity=Severity.MAJOR if detected and score < 50 else Severity.MINOR if detected else Severity.INFO,
            score=max(0, score),
            diagnosis=diagnosis,
            prescription="明确预设，确保每个场景都服务于核心预设",
            related_skill=info["skill"]
        )
    
    def _check_faceless_narration(self, content: str, context: Dict) -> SinCheckResult:
        """检查致命错误6：声音缺失"""
        sin = DeadlySin.FACELESS_NARRATION
        info = self.SIN_INFO[sin]
        
        score = 75
        detected = False
        diagnosis = ""
        
        # 检查语气一致性（简化检查）
        formal_markers = ["然而", "因此", "综上所述", "鉴于"]
        informal_markers = ["其实吧", "你懂的", "说白了", "反正"]
        
        formal_count = sum(1 for m in formal_markers if m in content)
        informal_count = sum(1 for m in informal_markers if m in content)
        
        # 如果两种风格都出现，可能存在声音不一致
        if formal_count > 0 and informal_count > 0:
            score -= 20
            detected = True
            diagnosis = "叙述语气不一致，正式与口语风格混杂"
        
        # 检查是否有明确的叙述视角
        first_person = content.count("我") + content.count("我们")
        second_person = content.count("你") + content.count("你们")
        
        # 如果视角混乱
        if first_person > 5 and second_person > 5:
            score -= 15
            if detected:
                diagnosis += "；叙述视角不统一"
            else:
                detected = True
                diagnosis = "叙述视角混乱，第一人称与第二人称频繁切换"
        
        if not detected:
            diagnosis = "叙事声音统一，语气一致"
        
        return SinCheckResult(
            sin=sin,
            name_cn=info["name_cn"],
            detected=detected,
            severity=Severity.MINOR if detected else Severity.INFO,
            score=max(0, score),
            diagnosis=diagnosis,
            prescription="确定叙述者身份，保持语气和视角的一致性",
            related_skill=info["skill"]
        )
    
    def _check_chaotic_presentation(self, content: str, context: Dict) -> SinCheckResult:
        """检查致命错误7：呈现混乱"""
        sin = DeadlySin.CHAOTIC_PRESENTATION
        info = self.SIN_INFO[sin]
        
        score = 75
        detected = False
        diagnosis = ""
        
        # 检查段落长度
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        
        if paragraphs:
            avg_para_len = sum(len(p) for p in paragraphs) / len(paragraphs)
            
            # 段落过长
            long_paras = [p for p in paragraphs if len(p) > 500]
            if len(long_paras) > len(paragraphs) * 0.3:
                score -= 15
                detected = True
                diagnosis = "存在过长段落，影响阅读体验"
        
        # 检查过渡词
        transition_words = ["接下来", "此外", "然而", "因此", "综上", "首先", "其次"]
        transition_count = sum(1 for w in transition_words if w in content)
        
        if len(paragraphs) > 3 and transition_count < 2:
            score -= 15
            if detected:
                diagnosis += "；段落之间缺乏过渡"
            else:
                detected = True
                diagnosis = "段落之间缺乏过渡词，跳跃感强"
        
        # 检查格式元素
        has_headers = '#' in content or '##' in content
        has_lists = '- ' in content or '1.' in content or '•' in content
        
        if len(content) > 1000 and not has_headers and not has_lists:
            score -= 10
            if detected:
                diagnosis += "；缺乏格式化元素"
            else:
                detected = True
                diagnosis = "长文缺乏格式化元素（标题、列表等）"
        
        if not detected:
            diagnosis = "呈现清晰，格式规范，过渡流畅"
        
        return SinCheckResult(
            sin=sin,
            name_cn=info["name_cn"],
            detected=detected,
            severity=Severity.MINOR if detected else Severity.INFO,
            score=max(0, score),
            diagnosis=diagnosis,
            prescription="优化段落长度，添加过渡句，使用格式化元素突出结构",
            related_skill=info["skill"]
        )
    
    def _sin_result_to_dict(self, result: SinCheckResult) -> Dict:
        """转换为字典"""
        return {
            "sin": result.sin.value,
            "name_cn": result.name_cn,
            "detected": result.detected,
            "severity": result.severity.value,
            "score": result.score,
            "diagnosis": result.diagnosis,
            "prescription": result.prescription,
            "related_skill": result.related_skill
        }
    
    def _generate_summary(
        self,
        score: float,
        sin_results: List[SinCheckResult],
        critical_sins: List[SinCheckResult],
        major_sins: List[SinCheckResult]
    ) -> str:
        """生成摘要"""
        detected_count = sum(1 for r in sin_results if r.detected)
        
        summary = f"七个致命错误检查：{score:.1f}/100，发现{detected_count}个问题。"
        
        if critical_sins:
            sin_names = [s.name_cn for s in critical_sins]
            summary += f"严重问题：{', '.join(sin_names)}。"
        elif major_sins:
            sin_names = [s.name_cn for s in major_sins]
            summary += f"主要问题：{', '.join(sin_names)}。"
        else:
            summary += "整体质量良好。"
        
        return summary
    
    def quick_scan(self, content: str) -> EvaluationResult:
        """快速扫描"""
        # 简化检查
        issues = []
        score = 70
        
        # 快速检查结构
        if "第一" not in content and "首先" not in content:
            issues.append(Issue(
                code="DEADLY_SIN_STRUCTURAL_DRIFT",
                message="可能存在结构漂移",
                severity=Severity.MINOR,
                related_skill="pyramid-structure"
            ))
            score -= 10
        
        # 快速检查情感
        sensory_words = ["看到", "听到", "感觉", "触摸"]
        if not any(w in content for w in sensory_words):
            issues.append(Issue(
                code="DEADLY_SIN_EMOTIONAL_VACUUM",
                message="可能存在情感真空",
                severity=Severity.MINOR,
                related_skill="fictional-dream"
            ))
            score -= 10
        
        return EvaluationResult(
            evaluator_name=self.name,
            score=score,
            level=self._score_to_level(score),
            issues=issues,
            summary=f"快速扫描：{score}/100"
        )
