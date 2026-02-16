"""
L4 头脑风暴模式 (Brainstorm)

多角色并行分析、guidance-specification 生成、synthesis 整合。
适用于: 剧情策划、冲突设计、创意发散、多角度分析。
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, as_completed

from .base_level import BaseLevel, LevelRegistry
from ..base_state import BaseState

logger = logging.getLogger(__name__)


# ============================================================
# 角色定义
# ============================================================

class BrainstormRole(Enum):
    """
    头脑风暴角色枚举

    每个角色代表不同的分析视角和专业领域。
    """
    # 核心角色
    PRODUCT_MANAGER = "product_manager"
    SYSTEM_ARCHITECT = "system_architect"
    UX_EXPERT = "ux_expert"
    DATA_ARCHITECT = "data_architect"

    # 创意角色
    CREATIVE_DIRECTOR = "creative_director"
    STORYTELLER = "storyteller"
    WORLD_BUILDER = "world_builder"

    # 批判角色
    DEVIL_ADVOCATE = "devil_advocate"
    RISK_ANALYST = "risk_analyst"

    # 平衡角色
    OPTIMIST = "optimist"
    REALIST = "realist"
    PRAGMATIST = "pragmatist"

    # 专业角色
    DOMAIN_EXPERT = "domain_expert"
    TECHNICAL_WRITER = "technical_writer"

    @property
    def display_name(self) -> str:
        """显示名称"""
        names = {
            "product_manager": "产品经理",
            "system_architect": "系统架构师",
            "ux_expert": "用户体验专家",
            "data_architect": "数据架构师",
            "creative_director": "创意总监",
            "storyteller": "故事讲述者",
            "world_builder": "世界构建者",
            "devil_advocate": "魔鬼代言人",
            "risk_analyst": "风险分析师",
            "optimist": "乐观主义者",
            "realist": "现实主义者",
            "pragmatist": "实用主义者",
            "domain_expert": "领域专家",
            "technical_writer": "技术写作者",
        }
        return names.get(self.value, self.value)

    @property
    def perspective(self) -> str:
        """角色视角描述"""
        perspectives = {
            "product_manager": "从产品价值、用户需求、市场定位角度分析",
            "system_architect": "从系统设计、技术架构、可扩展性角度分析",
            "ux_expert": "从用户体验、交互设计、可用性角度分析",
            "data_architect": "从数据结构、信息流、存储策略角度分析",
            "creative_director": "从创意表达、艺术风格、情感共鸣角度分析",
            "storyteller": "从叙事结构、角色发展、情节张力角度分析",
            "world_builder": "从世界观、设定一致性、背景深度角度分析",
            "devil_advocate": "从反面论证、潜在问题、挑战假设角度分析",
            "risk_analyst": "从风险识别、影响评估、缓解策略角度分析",
            "optimist": "从积极可能性、机会发掘、正面影响角度分析",
            "realist": "从实际约束、可行性、资源限制角度分析",
            "pragmatist": "从实用性、效率、投入产出比角度分析",
            "domain_expert": "从专业领域知识、行业最佳实践角度分析",
            "technical_writer": "从文档清晰度、表达准确性、可读性角度分析",
        }
        return perspectives.get(self.value, "从专业角度分析")

    @classmethod
    def get_default_roles(cls) -> List["BrainstormRole"]:
        """获取默认角色组合"""
        return [
            cls.PRODUCT_MANAGER,
            cls.SYSTEM_ARCHITECT,
            cls.CREATIVE_DIRECTOR,
            cls.DEVIL_ADVOCATE,
            cls.REALIST,
        ]

    @classmethod
    def get_creative_roles(cls) -> List["BrainstormRole"]:
        """获取创意导向角色组合"""
        return [
            cls.CREATIVE_DIRECTOR,
            cls.STORYTELLER,
            cls.WORLD_BUILDER,
            cls.OPTIMIST,
            cls.DEVIL_ADVOCATE,
        ]

    @classmethod
    def get_technical_roles(cls) -> List["BrainstormRole"]:
        """获取技术导向角色组合"""
        return [
            cls.SYSTEM_ARCHITECT,
            cls.DATA_ARCHITECT,
            cls.RISK_ANALYST,
            cls.REALIST,
            cls.PRAGMATIST,
        ]


# ============================================================
# 数据类定义
# ============================================================

@dataclass
class RoleAnalysis:
    """
    角色分析结果

    存储单个角色的分析内容和关键洞察。
    """
    role: BrainstormRole
    analysis_content: str
    key_points: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    concerns: List[str] = field(default_factory=list)
    score: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "role": self.role.value,
            "role_name": self.role.display_name,
            "analysis_content": self.analysis_content,
            "key_points": self.key_points,
            "recommendations": self.recommendations,
            "concerns": self.concerns,
            "score": self.score,
            "metadata": self.metadata,
        }


@dataclass
class BrainstormSynthesis:
    """
    头脑风暴综合结果

    整合多角色分析的综合输出。
    """
    summary: str
    consensus_points: List[str] = field(default_factory=list)
    divergent_points: List[str] = field(default_factory=list)
    prioritized_recommendations: List[str] = field(default_factory=list)
    risk_assessment: str = ""
    next_steps: List[str] = field(default_factory=list)
    confidence_score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "summary": self.summary,
            "consensus_points": self.consensus_points,
            "divergent_points": self.divergent_points,
            "prioritized_recommendations": self.prioritized_recommendations,
            "risk_assessment": self.risk_assessment,
            "next_steps": self.next_steps,
            "confidence_score": self.confidence_score,
        }


@dataclass
class GuidanceSpecification:
    """
    指导规范

    基于头脑风暴结果生成的执行指导。
    """
    title: str
    objective: str
    scope: str
    guidelines: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)
    success_criteria: List[str] = field(default_factory=list)
    quality_standards: List[str] = field(default_factory=list)
    deliverables: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "title": self.title,
            "objective": self.objective,
            "scope": self.scope,
            "guidelines": self.guidelines,
            "constraints": self.constraints,
            "success_criteria": self.success_criteria,
            "quality_standards": self.quality_standards,
            "deliverables": self.deliverables,
        }

    def to_markdown(self) -> str:
        """生成 Markdown 格式规范"""
        md = f"# {self.title}\n\n"
        md += f"## 目标\n{self.objective}\n\n"
        md += f"## 范围\n{self.scope}\n\n"

        if self.guidelines:
            md += "## 指导原则\n"
            for g in self.guidelines:
                md += f"- {g}\n"
            md += "\n"

        if self.constraints:
            md += "## 约束条件\n"
            for c in self.constraints:
                md += f"- {c}\n"
            md += "\n"

        if self.success_criteria:
            md += "## 成功标准\n"
            for s in self.success_criteria:
                md += f"- {s}\n"
            md += "\n"

        if self.quality_standards:
            md += "## 质量标准\n"
            for q in self.quality_standards:
                md += f"- {q}\n"
            md += "\n"

        if self.deliverables:
            md += "## 交付物\n"
            for d in self.deliverables:
                md += f"- {d}\n"
            md += "\n"

        return md


# ============================================================
# L4 头脑风暴工作流
# ============================================================

@LevelRegistry.register(4)
class Level4Brainstorm(BaseLevel):
    """
    L4 头脑风暴模式

    特点:
    - 多角色并行分析
    - 观点综合与冲突解决
    - guidance-specification 生成
    - 支持异步并行执行

    命令链:
    brainstorm → synthesize → specification → verify
    """

    level = 4
    name = "brainstorm"
    description = "头脑风暴模式 - 多角色并行分析"

    # 默认配置
    DEFAULT_MAX_PARALLEL = 4
    DEFAULT_ROLES = BrainstormRole.get_default_roles()

    def __init__(self, config: Optional[Dict] = None):
        super().__init__(config)
        self.max_parallel = self.config.get("max_parallel", self.DEFAULT_MAX_PARALLEL)
        self.executor = None

    def execute(self, state: BaseState, **kwargs) -> BaseState:
        """
        执行头脑风暴工作流

        流程:
        1. 准备阶段: 解析主题和角色
        2. 并行分析: 多角色同时分析
        3. 综合阶段: 整合各角色观点
        4. 规范生成: 生成 guidance-specification
        5. 验证阶段: 验证规范完整性
        """
        config = self.get_default_config()
        config.update(self.config or {})

        # 获取角色列表
        roles = kwargs.get("roles") or self.config.get("roles") or self.DEFAULT_ROLES
        if isinstance(roles, list) and roles and isinstance(roles[0], str):
            roles = [BrainstormRole(r) for r in roles]

        topic = state.get("user_request", "")
        context = state.get("context", "")

        try:
            # Phase 1: 并行角色分析
            state["current_step"] = "brainstorm"
            analyses = self.generate_artifacts(topic, roles, context)
            state["role_analyses"] = [a.to_dict() for a in analyses]

            # Phase 2: 综合分析
            state["current_step"] = "synthesize"
            synthesis = self.synthesize(analyses)
            state["synthesis"] = synthesis.to_dict()

            # Phase 3: 生成规范
            state["current_step"] = "specification"
            specification = self.generate_specification(synthesis, topic)
            state["specification"] = specification.to_dict()
            state["specification_markdown"] = specification.to_markdown()

            # Phase 4: 验证
            state["current_step"] = "verify"
            verification = self._verify_specification(specification)
            state["verification"] = verification

            # 设置最终输出
            state["final_output"] = specification.to_markdown()
            state["decision"] = "APPROVED" if verification["valid"] else "HUMAN_REVIEW"
            state["score"] = verification.get("score", 85)

        except Exception as e:
            logger.error(f"Brainstorm execution failed: {e}")
            state["errors"] = state.get("errors", []) + [f"头脑风暴执行失败: {e}"]
            state["decision"] = "FAILED"

        return state

    def get_required_agents(self) -> List[str]:
        return ["architect", "writer", "critic"]

    def get_default_config(self) -> Dict:
        """获取默认配置"""
        return {
            "max_revisions": 5,
            "pass_score": 85,
            "verbose": True,
            "max_parallel": self.DEFAULT_MAX_PARALLEL,
            "timeout_per_role": 60,
        }

    # ========================================
    # 核心方法
    # ========================================

    def generate_artifacts(
        self,
        topic: str,
        roles: List[BrainstormRole],
        context: str = ""
    ) -> List[RoleAnalysis]:
        """
        生成角色分析工件

        并行调用多个角色进行分析。

        Args:
            topic: 分析主题
            roles: 参与角色列表
            context: 上下文信息

        Returns:
            List[RoleAnalysis]: 各角色分析结果
        """
        analyses = []

        # 使用线程池并行执行
        with ThreadPoolExecutor(max_workers=self.max_parallel) as executor:
            futures = {
                executor.submit(self._analyze_as_role, role, topic, context): role
                for role in roles
            }

            for future in as_completed(futures):
                role = futures[future]
                try:
                    analysis = future.result(timeout=self.config.get("timeout_per_role", 60))
                    analyses.append(analysis)
                    logger.info(f"Role {role.display_name} analysis completed")
                except Exception as e:
                    logger.warning(f"Role {role.display_name} analysis failed: {e}")
                    # 创建失败占位分析
                    analyses.append(RoleAnalysis(
                        role=role,
                        analysis_content=f"分析失败: {e}",
                        key_points=[],
                        recommendations=[],
                        score=0.0,
                    ))

        return analyses

    async def generate_artifacts_async(
        self,
        topic: str,
        roles: List[BrainstormRole],
        context: str = ""
    ) -> List[RoleAnalysis]:
        """
        异步生成角色分析工件

        Args:
            topic: 分析主题
            roles: 参与角色列表
            context: 上下文信息

        Returns:
            List[RoleAnalysis]: 各角色分析结果
        """
        tasks = [
            self._analyze_as_role_async(role, topic, context)
            for role in roles
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        analyses = []
        for role, result in zip(roles, results):
            if isinstance(result, Exception):
                logger.warning(f"Role {role.display_name} analysis failed: {result}")
                analyses.append(RoleAnalysis(
                    role=role,
                    analysis_content=f"分析失败: {result}",
                    key_points=[],
                    recommendations=[],
                    score=0.0,
                ))
            else:
                analyses.append(result)

        return analyses

    def synthesize(self, analyses: List[RoleAnalysis]) -> BrainstormSynthesis:
        """
        综合多角色分析结果

        识别共识点、分歧点，并生成优先级建议。

        Args:
            analyses: 角色分析结果列表

        Returns:
            BrainstormSynthesis: 综合结果
        """
        if not analyses:
            return BrainstormSynthesis(
                summary="无可用分析结果",
                confidence_score=0.0,
            )

        # 收集所有关键点和建议
        all_key_points = []
        all_recommendations = []
        all_concerns = []

        for analysis in analyses:
            all_key_points.extend(analysis.key_points)
            all_recommendations.extend(analysis.recommendations)
            all_concerns.extend(analysis.concerns)

        # 识别共识点 (出现多次的观点)
        consensus_points = self._find_consensus(all_key_points)

        # 识别分歧点 (相互矛盾的观点)
        divergent_points = self._find_divergence(analyses)

        # 优先级排序建议
        prioritized_recommendations = self._prioritize_recommendations(
            all_recommendations, analyses
        )

        # 风险评估
        risk_assessment = self._assess_risks(all_concerns)

        # 生成下一步行动
        next_steps = self._generate_next_steps(
            consensus_points, prioritized_recommendations
        )

        # 计算置信度
        valid_analyses = [a for a in analyses if a.score > 0]
        confidence_score = (
            sum(a.score for a in valid_analyses) / len(valid_analyses)
            if valid_analyses else 0.0
        )

        # 生成综合摘要
        summary = self._generate_summary(
            analyses, consensus_points, divergent_points
        )

        return BrainstormSynthesis(
            summary=summary,
            consensus_points=consensus_points,
            divergent_points=divergent_points,
            prioritized_recommendations=prioritized_recommendations,
            risk_assessment=risk_assessment,
            next_steps=next_steps,
            confidence_score=confidence_score,
        )

    def generate_specification(
        self,
        synthesis: BrainstormSynthesis,
        topic: str = ""
    ) -> GuidanceSpecification:
        """
        基于综合结果生成 guidance-specification

        Args:
            synthesis: 综合分析结果
            topic: 原始主题

        Returns:
            GuidanceSpecification: 指导规范
        """
        # 从综合结果提取指导原则
        guidelines = []
        for point in synthesis.consensus_points[:5]:
            guidelines.append(f"遵循共识: {point}")

        # 从建议中提取约束
        constraints = []
        for concern in synthesis.divergent_points[:3]:
            constraints.append(f"注意分歧: {concern}")

        # 成功标准基于优先建议
        success_criteria = synthesis.prioritized_recommendations[:5]

        # 质量标准
        quality_standards = [
            "确保内容一致性和连贯性",
            "符合所有共识指导原则",
            "妥善处理已识别的分歧点",
            "满足风险缓解要求",
        ]

        # 交付物
        deliverables = synthesis.next_steps[:5] if synthesis.next_steps else [
            "完成初始草案",
            "完成审查和修订",
            "生成最终输出",
        ]

        return GuidanceSpecification(
            title=f"头脑风暴规范: {topic[:50]}..." if len(topic) > 50 else f"头脑风暴规范: {topic}",
            objective=synthesis.summary[:200] if synthesis.summary else "基于多角色分析制定执行规范",
            scope=f"基于 {len(synthesis.consensus_points)} 个共识点和 {len(synthesis.prioritized_recommendations)} 条建议",
            guidelines=guidelines,
            constraints=constraints,
            success_criteria=success_criteria,
            quality_standards=quality_standards,
            deliverables=deliverables,
        )

    # ========================================
    # 私有辅助方法
    # ========================================

    def _analyze_as_role(
        self,
        role: BrainstormRole,
        topic: str,
        context: str
    ) -> RoleAnalysis:
        """
        以特定角色身份进行分析

        Args:
            role: 角色
            topic: 主题
            context: 上下文

        Returns:
            RoleAnalysis: 分析结果
        """
        # 构建角色提示
        prompt = self._build_role_prompt(role, topic, context)

        try:
            # 尝试调用 LLM
            from ...agents.writer import WriterAgent

            writer = WriterAgent(name=f"brainstorm_{role.value}")
            result = writer.run({
                "prompt": prompt,
                "mode": "analysis",
                "role": role.value,
            })

            content = result.get("content", "")

            # 解析结果
            return self._parse_analysis_result(role, content)

        except ImportError:
            # 如果 Agent 不可用，生成占位结果
            logger.warning(f"WriterAgent not available, generating placeholder for {role.display_name}")
            return self._generate_placeholder_analysis(role, topic)
        except Exception as e:
            logger.error(f"Analysis failed for role {role.display_name}: {e}")
            return RoleAnalysis(
                role=role,
                analysis_content=f"分析过程中出错: {e}",
                key_points=[],
                recommendations=[],
                score=0.0,
            )

    async def _analyze_as_role_async(
        self,
        role: BrainstormRole,
        topic: str,
        context: str
    ) -> RoleAnalysis:
        """异步角色分析"""
        # 在线程池中执行同步方法
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._analyze_as_role, role, topic, context
        )

    def _build_role_prompt(
        self,
        role: BrainstormRole,
        topic: str,
        context: str
    ) -> str:
        """构建角色分析提示"""
        prompt = f"""你是一位 {role.display_name}，请从你的专业角度分析以下主题。

## 你的视角
{role.perspective}

## 分析主题
{topic}

"""
        if context:
            prompt += f"""## 背景上下文
{context}

"""

        prompt += """## 输出要求
请提供以下内容:

1. **分析内容**: 从你的角度对主题进行深入分析 (200-500字)

2. **关键要点**: 列出 3-5 个最重要的观点
   - 要点 1
   - 要点 2
   - ...

3. **建议**: 列出 2-4 条可行建议
   - 建议 1
   - 建议 2
   - ...

4. **关注点/风险**: 列出需要注意的问题 (如有)
   - 关注点 1
   - ...

请保持专业客观，并明确标注各部分。
"""
        return prompt

    def _parse_analysis_result(
        self,
        role: BrainstormRole,
        content: str
    ) -> RoleAnalysis:
        """解析分析结果"""
        # 简单解析逻辑
        key_points = []
        recommendations = []
        concerns = []

        lines = content.split("\n")
        current_section = None

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # 检测章节标题
            if "关键要点" in line or "关键点" in line or "要点" in line:
                current_section = "key_points"
            elif "建议" in line:
                current_section = "recommendations"
            elif "关注" in line or "风险" in line or "问题" in line:
                current_section = "concerns"
            elif line.endswith(":") or line.endswith("："):
                # 避免未知章节沿用上一章节，导致列表项误归类
                current_section = "unknown"
            elif line.startswith("-") or line.startswith("*") or line.startswith("1"):
                # 提取列表项
                item = line.lstrip("-*0123456789. ")
                if item and current_section:
                    if current_section == "key_points":
                        key_points.append(item)
                    elif current_section == "recommendations":
                        recommendations.append(item)
                    elif current_section == "concerns":
                        concerns.append(item)

        return RoleAnalysis(
            role=role,
            analysis_content=content,
            key_points=key_points[:5],
            recommendations=recommendations[:4],
            concerns=concerns[:3],
            score=80.0 if content else 0.0,
        )

    def _generate_placeholder_analysis(
        self,
        role: BrainstormRole,
        topic: str
    ) -> RoleAnalysis:
        """生成占位分析结果"""
        return RoleAnalysis(
            role=role,
            analysis_content=f"作为{role.display_name}，{role.perspective}。针对主题 '{topic[:50]}...' 的分析待生成。",
            key_points=[
                f"{role.display_name}视角的关键观点 1",
                f"{role.display_name}视角的关键观点 2",
            ],
            recommendations=[
                f"来自{role.display_name}的建议 1",
            ],
            concerns=[],
            score=50.0,
        )

    def _find_consensus(self, points: List[str]) -> List[str]:
        """识别共识点"""
        if not points:
            return []

        # 简单的词频统计方法
        # 实际应用中可以使用更复杂的语义相似度计算
        word_count: Dict[str, int] = {}
        for point in points:
            words = set(point.lower().split())
            for word in words:
                if len(word) > 2:  # 忽略短词
                    word_count[word] = word_count.get(word, 0) + 1

        # 找出高频词相关的观点
        consensus = []
        threshold = max(2, len(points) // 3)

        high_freq_words = {w for w, c in word_count.items() if c >= threshold}

        for point in points:
            words = set(point.lower().split())
            if words & high_freq_words:
                if point not in consensus:
                    consensus.append(point)

        return consensus[:5]

    def _find_divergence(self, analyses: List[RoleAnalysis]) -> List[str]:
        """识别分歧点"""
        divergent = []

        # 比较不同角色的关注点
        for i, a1 in enumerate(analyses):
            for a2 in analyses[i+1:]:
                # 检查是否有相反的观点
                for c1 in a1.concerns:
                    for r2 in a2.recommendations:
                        if self._are_conflicting(c1, r2):
                            divergent.append(
                                f"{a1.role.display_name} 关注 '{c1[:30]}...' vs "
                                f"{a2.role.display_name} 建议 '{r2[:30]}...'"
                            )

        return divergent[:5]

    def _are_conflicting(self, text1: str, text2: str) -> bool:
        """判断两个观点是否冲突"""
        # 简单的冲突检测
        negative_words = {"不", "避免", "禁止", "风险", "问题", "担心"}
        positive_words = {"应该", "建议", "推荐", "可以", "需要"}

        t1_has_neg = any(w in text1 for w in negative_words)
        t2_has_pos = any(w in text2 for w in positive_words)

        # 如果一个是负面一个是正面，且有共同关键词
        if t1_has_neg and t2_has_pos:
            words1 = set(text1.split())
            words2 = set(text2.split())
            common = words1 & words2
            if len(common) >= 2:
                return True

        return False

    def _prioritize_recommendations(
        self,
        recommendations: List[str],
        analyses: List[RoleAnalysis]
    ) -> List[str]:
        """优先级排序建议"""
        if not recommendations:
            return []

        # 按出现频率和角色权重排序
        rec_scores: Dict[str, float] = {}

        for rec in recommendations:
            score = 1.0
            # 检查是否被多个角色提及
            for analysis in analyses:
                if rec in analysis.recommendations:
                    score += analysis.score / 100
            rec_scores[rec] = score

        # 排序并返回
        sorted_recs = sorted(rec_scores.keys(), key=lambda r: rec_scores[r], reverse=True)
        return sorted_recs[:10]

    def _assess_risks(self, concerns: List[str]) -> str:
        """评估风险"""
        if not concerns:
            return "未识别到显著风险。"

        risk_count = len(concerns)

        if risk_count <= 2:
            level = "低"
            desc = "已识别少量潜在关注点，建议在执行过程中注意。"
        elif risk_count <= 5:
            level = "中"
            desc = "存在多个需要关注的风险点，建议制定缓解策略。"
        else:
            level = "高"
            desc = "识别到大量风险因素，建议在继续之前进行详细风险分析。"

        return f"风险等级: {level}。{desc} 主要关注点: {'; '.join(concerns[:3])}"

    def _generate_next_steps(
        self,
        consensus: List[str],
        recommendations: List[str]
    ) -> List[str]:
        """生成下一步行动"""
        steps = []

        if consensus:
            steps.append(f"确认并落实 {len(consensus)} 个共识点")

        if recommendations:
            steps.append(f"实施优先建议: {recommendations[0][:50]}...")

        steps.extend([
            "制定详细执行计划",
            "分配责任和时间节点",
            "建立进度跟踪机制",
        ])

        return steps[:5]

    def _generate_summary(
        self,
        analyses: List[RoleAnalysis],
        consensus: List[str],
        divergent: List[str]
    ) -> str:
        """生成综合摘要"""
        role_names = [a.role.display_name for a in analyses if a.score > 0]

        summary = f"基于 {len(role_names)} 位专家角色的分析 ({', '.join(role_names[:3])}{'等' if len(role_names) > 3 else ''})，"
        summary += f"共识别 {len(consensus)} 个共识点"

        if divergent:
            summary += f"和 {len(divergent)} 个分歧点。"
        else:
            summary += "，各方观点高度一致。"

        return summary

    def _verify_specification(self, spec: GuidanceSpecification) -> Dict[str, Any]:
        """验证规范完整性"""
        issues = []

        if not spec.objective:
            issues.append("缺少目标描述")

        if not spec.guidelines:
            issues.append("缺少指导原则")

        if not spec.success_criteria:
            issues.append("缺少成功标准")

        if len(spec.guidelines) < 2:
            issues.append("指导原则不足 (建议至少 2 条)")

        valid = len(issues) == 0
        score = 100 - (len(issues) * 15)

        return {
            "valid": valid,
            "score": max(0, score),
            "issues": issues,
            "suggestions": [
                "补充缺失的规范内容" if issues else "规范内容完整"
            ],
        }
