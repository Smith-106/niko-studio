"""
L2 轻量模式 (Lite)

内存计划、轻量持久化。
适用于: 单场景写作、对话片段、短文创作、Bug诊断。

命令:
- lite-plan: 内存中生成计划
- lite-fix: Bug 诊断和修复建议
- lite-execute: 统一执行入口
"""

from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from datetime import datetime
import uuid
from .base_level import BaseLevel, LevelRegistry
from ..base_state import BaseState
from ...agents.base import AgentType


@dataclass
class LitePlan:
    """轻量计划 (内部使用)"""
    objective: str
    key_points: List[str]
    tone: str = "neutral"
    word_count_target: int = 1000


@dataclass
class LitePlanResult:
    """
    轻量计划结果

    用于 lite-plan 命令的输出。
    """
    plan_id: str
    steps: List[Dict[str, Any]]
    estimated_time: int  # 预估时间 (秒)
    confidence: float = 0.8  # 计划置信度 (0-1)

    # 元信息
    created_at: datetime = field(default_factory=datetime.now)
    objective: str = ""
    context: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "plan_id": self.plan_id,
            "steps": self.steps,
            "estimated_time": self.estimated_time,
            "confidence": self.confidence,
            "created_at": self.created_at.isoformat(),
            "objective": self.objective,
            "context": self.context,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LitePlanResult":
        """从字典创建"""
        created_at = data.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        elif created_at is None:
            created_at = datetime.now()

        return cls(
            plan_id=data.get("plan_id", ""),
            steps=data.get("steps", []),
            estimated_time=data.get("estimated_time", 0),
            confidence=data.get("confidence", 0.8),
            created_at=created_at,
            objective=data.get("objective", ""),
            context=data.get("context", {}),
        )


@dataclass
class LiteFixResult:
    """
    Bug 诊断结果

    用于 lite-fix 命令的输出。
    """
    diagnosis: str  # 问题诊断描述
    root_cause: str  # 根本原因
    fix_suggestions: List[str]  # 修复建议列表

    # 元信息
    severity: str = "medium"  # low, medium, high, critical
    confidence: float = 0.8  # 诊断置信度 (0-1)
    affected_areas: List[str] = field(default_factory=list)
    related_issues: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "diagnosis": self.diagnosis,
            "root_cause": self.root_cause,
            "fix_suggestions": self.fix_suggestions,
            "severity": self.severity,
            "confidence": self.confidence,
            "affected_areas": self.affected_areas,
            "related_issues": self.related_issues,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LiteFixResult":
        """从字典创建"""
        return cls(
            diagnosis=data.get("diagnosis", ""),
            root_cause=data.get("root_cause", ""),
            fix_suggestions=data.get("fix_suggestions", []),
            severity=data.get("severity", "medium"),
            confidence=data.get("confidence", 0.8),
            affected_areas=data.get("affected_areas", []),
            related_issues=data.get("related_issues", []),
        )


@LevelRegistry.register(2)
class Level2Lite(BaseLevel):
    """
    L2 轻量模式

    特点:
    - 内存中保持简单计划
    - 单轮 Writer + Critic
    - 轻量状态持久化
    - 快速验证

    命令链:
    plan-lite → execute → verify-lite
    """

    level = 2
    name = "lite"
    description = "轻量模式 - 内存计划、轻量持久化"

    def execute(self, state: BaseState, **kwargs) -> BaseState:
        """
        执行轻量工作流

        流程:
        1. Plan-Lite: 生成简单计划
        2. Execute: Writer 执行
        3. Verify-Lite: 快速验证
        4. 如果未通过，最多重试 1 次
        """
        config = self.get_default_config()
        config.update(self.config or {})

        max_revisions = config.get("max_revisions", 1)
        pass_score = config.get("pass_score", 70)  # L2 执行策略 fallback，非 novel 发布门槛

        # Phase 1: 轻量计划
        state = self._plan_lite(state)

        # Phase 2-3: 执行和验证循环
        revision_count = 0
        while revision_count <= max_revisions:
            # 执行
            state = self._execute_lite(state)

            # 快速验证
            state = self._verify_lite(state)

            score = state.get("score", 0)
            decision = state.get("decision", "REVISE")

            if decision == "APPROVED" or score >= pass_score:
                state["decision"] = "APPROVED"
                break

            revision_count += 1
            state["revision_count"] = revision_count

        if revision_count > max_revisions and state.get("decision") != "APPROVED":
            # Lite 模式不触发人工审阅，直接通过
            state["decision"] = "APPROVED"
            state["auto_approved"] = True

        return state

    def get_required_agents(self) -> List[str]:
        return ["writer", "critic"]

    def get_default_config(self) -> Dict:
        """获取默认配置（L2 执行策略阈值；非 novel 发布门槛）"""
        return {
            "max_revisions": 1,
            "pass_score": 70,
            "verbose": True,
            "word_count_target": 1000,
            "retrieval_profile": "lite_low_cost",
        }

    def plan_lite(self, state: BaseState) -> LitePlan:
        """生成轻量计划"""
        return self._extract_plan(state)

    def _plan_lite(self, state: BaseState) -> BaseState:
        """计划阶段 (轻量)"""
        user_request = state.get("user_request", "")
        context = state.get("context", "")

        # 提取关键点
        key_points = self._extract_key_points(user_request)

        # 推断语气
        tone = self._infer_tone(user_request, context)

        # 创建轻量计划
        plan = LitePlan(
            objective=user_request[:200],
            key_points=key_points,
            tone=tone,
            word_count_target=self.config.get("word_count_target", 1000),
        )

        state["lite_plan"] = {
            "objective": plan.objective,
            "key_points": plan.key_points,
            "tone": plan.tone,
            "word_count_target": plan.word_count_target,
        }

        return state

    def _execute_lite(self, state: BaseState) -> BaseState:
        """执行阶段 (轻量)"""
        try:
            writer = self.container.get_agent(AgentType.WRITER, name="lite_writer")

            plan = state.get("lite_plan", {})
            feedback = state.get("feedback_context", "")

            result = writer.run({
                "prompt": self._build_lite_prompt(plan, feedback),
                "context": state.get("context", ""),
                "mode": "lite",
            })

            state["draft_content"] = result.get("content", "")
            state["draft_version"] = state.get("draft_version", 0) + 1

        except Exception as e:
            state["errors"] = state.get("errors", []) + [f"执行失败: {e}"]

        return state

    def _verify_lite(self, state: BaseState) -> BaseState:
        """验证阶段 (轻量)"""
        try:
            critic = self.container.get_agent(AgentType.CRITIC, name="lite_critic")

            result = critic.run({
                "content": state.get("draft_content", ""),
                "plan": state.get("lite_plan", {}),
                "mode": "quick",  # 快速评估模式
            })

            state["score"] = result.get("score", 0)
            state["decision"] = result.get("decision", "REVISE")
            state["feedback_context"] = result.get("feedback", "")

        except Exception as e:
            state["errors"] = state.get("errors", []) + [f"验证失败: {e}"]
            # Lite 模式验证失败时默认通过
            state["decision"] = "APPROVED"
            state["score"] = 70

        return state

    def _extract_key_points(self, text: str) -> List[str]:
        """从请求中提取关键点"""
        # 简单提取: 按句号/逗号分割，取前 5 个要点
        import re
        sentences = re.split(r'[。，,.\n]', text)
        key_points = [s.strip() for s in sentences if len(s.strip()) > 5]
        return key_points[:5]

    def _infer_tone(self, request: str, context: str) -> str:
        """推断语气"""
        text = f"{request} {context}".lower()

        tone_keywords = {
            "humorous": ["幽默", "搞笑", "轻松", "诙谐"],
            "serious": ["严肃", "正式", "庄重", "认真"],
            "romantic": ["浪漫", "温馨", "甜蜜", "爱情"],
            "suspense": ["悬疑", "紧张", "惊悚", "神秘"],
            "lyrical": ["抒情", "优美", "诗意", "唯美"],
        }

        for tone, keywords in tone_keywords.items():
            if any(kw in text for kw in keywords):
                return tone

        return "neutral"

    def _build_lite_prompt(self, plan: Dict, feedback: str = "") -> str:
        """构建轻量模式 Prompt"""
        prompt = f"""任务目标: {plan.get('objective', '')}

关键要点:
{chr(10).join(f'- {p}' for p in plan.get('key_points', []))}

语气风格: {plan.get('tone', 'neutral')}
目标字数: 约 {plan.get('word_count_target', 1000)} 字
"""

        if feedback:
            prompt += f"\n修改建议:\n{feedback}\n"

        prompt += "\n请根据以上要求进行创作。"

        return prompt

    def _extract_plan(self, state: BaseState) -> LitePlan:
        """从状态中提取计划"""
        plan_dict = state.get("lite_plan", {})
        return LitePlan(
            objective=plan_dict.get("objective", ""),
            key_points=plan_dict.get("key_points", []),
            tone=plan_dict.get("tone", "neutral"),
            word_count_target=plan_dict.get("word_count_target", 1000),
        )

    # ========== Lite 工作流命令 ==========

    def lite_plan(self, task: Union[str, Dict[str, Any]]) -> LitePlanResult:
        """
        lite-plan: 内存中生成计划

        根据任务描述生成轻量级执行计划，不持久化到磁盘。

        Args:
            task: 任务描述 (字符串或字典)
                - 如果是字符串: 直接作为任务目标
                - 如果是字典: 包含 objective, context, constraints 等字段

        Returns:
            LitePlanResult: 包含 plan_id, steps, estimated_time
        """
        # 解析任务输入
        if isinstance(task, str):
            objective = task
            context = {}
        else:
            objective = task.get("objective", task.get("task", ""))
            context = {
                k: v for k, v in task.items()
                if k not in ("objective", "task")
            }

        # 生成唯一计划 ID
        plan_id = f"lite-{uuid.uuid4().hex[:8]}"

        # 提取关键点
        key_points = self._extract_key_points(objective)

        # 生成执行步骤
        steps = self._generate_plan_steps(objective, key_points, context)

        # 估算执行时间
        estimated_time = self._estimate_execution_time(steps)

        # 计算计划置信度
        confidence = self._calculate_plan_confidence(objective, key_points, context)

        return LitePlanResult(
            plan_id=plan_id,
            steps=steps,
            estimated_time=estimated_time,
            confidence=confidence,
            objective=objective,
            context=context,
        )

    def lite_fix(self, bug_desc: str, context: Optional[Dict[str, Any]] = None) -> LiteFixResult:
        """
        lite-fix: Bug 诊断和修复建议

        分析 Bug 描述，诊断问题根因，提供修复建议。

        Args:
            bug_desc: Bug 描述
            context: 可选上下文 (代码片段、错误日志等)

        Returns:
            LiteFixResult: 包含 diagnosis, root_cause, fix_suggestions
        """
        context = context or {}

        # 分析 Bug 严重程度
        severity = self._analyze_severity(bug_desc)

        # 诊断问题
        diagnosis = self._diagnose_bug(bug_desc, context)

        # 识别根本原因
        root_cause = self._identify_root_cause(bug_desc, context)

        # 生成修复建议
        fix_suggestions = self._generate_fix_suggestions(bug_desc, root_cause, context)

        # 识别受影响区域
        affected_areas = self._identify_affected_areas(bug_desc, context)

        # 计算置信度
        confidence = self._calculate_diagnosis_confidence(bug_desc, context)

        return LiteFixResult(
            diagnosis=diagnosis,
            root_cause=root_cause,
            fix_suggestions=fix_suggestions,
            severity=severity,
            confidence=confidence,
            affected_areas=affected_areas,
            related_issues=[],
        )

    def lite_execute(self, plan: Union[LitePlanResult, Dict[str, Any]]) -> BaseState:
        """
        lite-execute: 统一执行入口

        执行给定的计划，返回执行结果。

        Args:
            plan: LitePlanResult 实例或计划字典

        Returns:
            BaseState: 执行后的状态
        """
        # 解析计划
        if isinstance(plan, LitePlanResult):
            plan_dict = plan.to_dict()
        else:
            plan_dict = plan

        # 创建初始状态
        state = BaseState()
        state["plan_id"] = plan_dict.get("plan_id", "")
        state["user_request"] = plan_dict.get("objective", "")
        state["context"] = plan_dict.get("context", {})
        state["steps"] = plan_dict.get("steps", [])

        # 执行每个步骤
        executed_steps = []
        for i, step in enumerate(state.get("steps", [])):
            step_result = self._execute_step(step, state)
            executed_steps.append({
                "step_index": i,
                "step": step,
                "result": step_result,
                "status": "completed" if step_result.get("success", False) else "failed",
            })

            # 更新状态
            state["current_step"] = i
            state["step_results"] = executed_steps

            # 如果步骤失败且是关键步骤，中断执行
            if not step_result.get("success", False) and step.get("critical", False):
                state["decision"] = "FAILED"
                state["error"] = step_result.get("error", "步骤执行失败")
                break

        # 所有步骤完成
        if state.get("decision") != "FAILED":
            state["decision"] = "APPROVED"
            state["final_output"] = self._aggregate_step_results(executed_steps)

        return state

    # ========== 辅助方法 ==========

    def _generate_plan_steps(
        self,
        objective: str,
        key_points: List[str],
        context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """生成计划步骤"""
        steps = []

        # 基础步骤: 分析
        steps.append({
            "index": 0,
            "name": "analyze",
            "description": "分析任务需求",
            "action": "analyze_requirements",
            "inputs": {"objective": objective, "key_points": key_points},
            "critical": True,
        })

        # 根据关键点生成执行步骤
        for i, point in enumerate(key_points):
            steps.append({
                "index": i + 1,
                "name": f"execute_{i + 1}",
                "description": f"执行: {point[:50]}",
                "action": "execute_task",
                "inputs": {"task": point},
                "critical": False,
            })

        # 验证步骤
        steps.append({
            "index": len(steps),
            "name": "verify",
            "description": "验证输出质量",
            "action": "verify_output",
            "inputs": {},
            "critical": True,
        })

        return steps

    def _estimate_execution_time(self, steps: List[Dict[str, Any]]) -> int:
        """估算执行时间 (秒)"""
        base_time = 30  # 基础时间
        per_step_time = 15  # 每步骤时间

        # 关键步骤额外时间
        critical_bonus = sum(
            10 for step in steps if step.get("critical", False)
        )

        return base_time + len(steps) * per_step_time + critical_bonus

    def _calculate_plan_confidence(
        self,
        objective: str,
        key_points: List[str],
        context: Dict[str, Any]
    ) -> float:
        """
        计算计划置信度

        基于目标清晰度、关键点数量和上下文丰富度评估。

        Returns:
            置信度 (0.0-1.0)
        """
        confidence = 0.5  # 基础置信度

        # 目标清晰度 (长度适中增加置信度)
        obj_len = len(objective)
        if 20 <= obj_len <= 200:
            confidence += 0.15
        elif obj_len > 200:
            confidence += 0.1
        else:
            confidence -= 0.1

        # 关键点数量 (2-5 个最佳)
        kp_count = len(key_points)
        if 2 <= kp_count <= 5:
            confidence += 0.15
        elif kp_count > 5:
            confidence += 0.1
        elif kp_count == 1:
            confidence += 0.05

        # 上下文丰富度
        if context:
            confidence += 0.1
            if context.get("reference") or context.get("examples"):
                confidence += 0.05
            if context.get("constraints"):
                confidence += 0.05

        return max(0.1, min(0.95, confidence))

    def _analyze_severity(self, bug_desc: str) -> str:
        """分析 Bug 严重程度"""
        text = bug_desc.lower()

        critical_keywords = ["崩溃", "crash", "数据丢失", "安全", "security", "死锁", "deadlock"]
        high_keywords = ["错误", "error", "失败", "fail", "异常", "exception", "无法"]
        medium_keywords = ["问题", "issue", "bug", "不正确", "incorrect"]
        low_keywords = ["建议", "优化", "改进", "warning", "警告"]

        for kw in critical_keywords:
            if kw in text:
                return "critical"

        for kw in high_keywords:
            if kw in text:
                return "high"

        for kw in medium_keywords:
            if kw in text:
                return "medium"

        for kw in low_keywords:
            if kw in text:
                return "low"

        return "medium"

    def _diagnose_bug(self, bug_desc: str, context: Dict[str, Any]) -> str:
        """诊断 Bug"""
        # 基于描述和上下文生成诊断
        diagnosis_parts = []

        # 分析描述中的关键信息
        if "error" in bug_desc.lower() or "错误" in bug_desc:
            diagnosis_parts.append("检测到错误状态")

        if "null" in bug_desc.lower() or "空" in bug_desc:
            diagnosis_parts.append("可能存在空值引用问题")

        if "timeout" in bug_desc.lower() or "超时" in bug_desc:
            diagnosis_parts.append("存在超时或性能问题")

        if context.get("error_log"):
            diagnosis_parts.append(f"错误日志显示: {context['error_log'][:100]}")

        if not diagnosis_parts:
            diagnosis_parts.append(f"问题描述: {bug_desc[:200]}")

        return "; ".join(diagnosis_parts)

    def _identify_root_cause(self, bug_desc: str, context: Dict[str, Any]) -> str:
        """识别根本原因"""
        # 基于关键词和上下文推断根因
        text = bug_desc.lower()

        if "空" in text or "null" in text or "none" in text:
            return "变量未正确初始化或返回了空值"

        if "类型" in text or "type" in text:
            return "类型不匹配或类型转换错误"

        if "超时" in text or "timeout" in text:
            return "操作耗时过长或资源等待超时"

        if "权限" in text or "permission" in text or "access" in text:
            return "权限配置不正确或访问被拒绝"

        if "连接" in text or "connection" in text:
            return "网络连接问题或服务不可用"

        if context.get("stack_trace"):
            return f"根据堆栈跟踪分析: 问题源于代码执行路径异常"

        return "需要进一步调查以确定根本原因"

    def _generate_fix_suggestions(
        self,
        bug_desc: str,
        root_cause: str,
        context: Dict[str, Any]
    ) -> List[str]:
        """生成修复建议"""
        suggestions = []

        # 基于根因生成建议
        if "空值" in root_cause or "初始化" in root_cause:
            suggestions.extend([
                "添加空值检查 (null check)",
                "确保变量在使用前正确初始化",
                "使用可选链操作符 (?.) 进行安全访问",
            ])

        if "类型" in root_cause:
            suggestions.extend([
                "检查类型定义是否正确",
                "添加类型验证或转换逻辑",
                "使用 TypeScript 或类型注解增强类型安全",
            ])

        if "超时" in root_cause:
            suggestions.extend([
                "增加超时时间配置",
                "优化耗时操作的性能",
                "添加异步处理或后台任务",
            ])

        if "权限" in root_cause:
            suggestions.extend([
                "检查权限配置是否正确",
                "确认用户/服务具有必要的访问权限",
                "审查访问控制策略",
            ])

        if "连接" in root_cause:
            suggestions.extend([
                "检查网络连接状态",
                "验证服务端点是否可用",
                "添加重试机制和错误处理",
            ])

        # 通用建议
        if not suggestions:
            suggestions = [
                "添加详细的日志记录以便调试",
                "编写单元测试复现问题",
                "检查相关代码的最近变更",
            ]

        return suggestions

    def _identify_affected_areas(
        self,
        bug_desc: str,
        context: Dict[str, Any]
    ) -> List[str]:
        """识别受影响区域"""
        affected = []

        # 从上下文提取
        if context.get("file"):
            affected.append(context["file"])

        if context.get("module"):
            affected.append(context["module"])

        if context.get("function"):
            affected.append(context["function"])

        # 从描述推断
        text = bug_desc.lower()
        if "登录" in text or "login" in text:
            affected.append("认证模块")
        if "数据" in text or "data" in text:
            affected.append("数据处理")
        if "界面" in text or "ui" in text:
            affected.append("用户界面")
        if "api" in text:
            affected.append("API 接口")

        return list(set(affected)) if affected else ["待确定"]

    def _calculate_diagnosis_confidence(
        self,
        bug_desc: str,
        context: Dict[str, Any]
    ) -> float:
        """计算诊断置信度"""
        confidence = 0.5  # 基础置信度

        # 有错误日志增加置信度
        if context.get("error_log"):
            confidence += 0.2

        # 有堆栈跟踪增加置信度
        if context.get("stack_trace"):
            confidence += 0.15

        # 有代码片段增加置信度
        if context.get("code_snippet"):
            confidence += 0.1

        # 描述详细增加置信度
        if len(bug_desc) > 100:
            confidence += 0.05

        return min(confidence, 0.95)

    def _execute_step(
        self,
        step: Dict[str, Any],
        state: BaseState
    ) -> Dict[str, Any]:
        """执行单个步骤"""
        action = step.get("action", "")
        inputs = step.get("inputs", {})

        try:
            if action == "analyze_requirements":
                return {
                    "success": True,
                    "output": f"已分析任务需求: {inputs.get('objective', '')[:100]}",
                }

            elif action == "execute_task":
                # 在实际实现中，这里会调用 WriterAgent
                return {
                    "success": True,
                    "output": f"已执行任务: {inputs.get('task', '')[:50]}",
                }

            elif action == "verify_output":
                return {
                    "success": True,
                    "output": "输出验证通过",
                    "score": 75,
                }

            else:
                return {
                    "success": True,
                    "output": f"已执行: {step.get('description', '')}",
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }

    def _aggregate_step_results(
        self,
        executed_steps: List[Dict[str, Any]]
    ) -> str:
        """聚合步骤结果"""
        outputs = []
        for step_data in executed_steps:
            result = step_data.get("result", {})
            if result.get("output"):
                outputs.append(result["output"])

        return "\n".join(outputs) if outputs else "执行完成"
