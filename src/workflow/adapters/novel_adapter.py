"""
小说领域适配器 (Novel Domain Adapter)

实现小说创作专用工作流:
Architect -> Writer -> Critic -> Finalize
"""

from typing import Dict, Any, Type, Literal, Optional
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
import os

from .base_adapter import (
    BaseDomainAdapter, 
    AdapterRegistry,
    DomainType,
    BaseEvaluationResult
)
from src.workflow.state import (
    WritingState,
    create_initial_state
)
from src.workflow.base_state import BaseState
from src.config import get_config


@AdapterRegistry.register(DomainType.NOVEL.value)
class NovelAdapter(BaseDomainAdapter):

    def get_domain_type(self) -> str:
        return DomainType.NOVEL.value

    def get_state_class(self) -> Type[BaseState]:
        return WritingState

    def create_initial_state(self, user_request: str, **kwargs) -> BaseState:
        metadata = kwargs.get("metadata") or {}
        resume_decision = kwargs.get("resume_decision")
        if resume_decision:
            metadata = {**metadata, "resume_decision": resume_decision}

        return create_initial_state(
            user_idea=user_request,
            genre=kwargs.get("genre", "悬疑"),
            target_chapters=kwargs.get("target_chapters", 30),
            target_wordcount=kwargs.get("target_wordcount", 600000),
            metadata=metadata
        )

    def evaluate(self, state: BaseState) -> BaseEvaluationResult:
        critique = state.get("critique_result", {})
        lock_analysis = critique.get("lock_analysis", {})

        return BaseEvaluationResult(
            decision=critique.get("decision", "REVISE"),
            decision_reason=critique.get("decision_reason", ""),
            total_score=critique.get("total_score", 0),
            dimension_scores=lock_analysis.get("scores", {}),
            feedback=critique.get("actionable_feedback", ""),
            revision_instructions=critique.get("revision_instructions", [])
        )

    def create_graph(self):
        workflow = StateGraph(WritingState)

        # 添加 Commander 节点
        workflow.add_node("commander", self.commander_node)
        workflow.add_node("architect", self.architect_node)
        workflow.add_node("writer", self.writer_node)
        workflow.add_node("distillation", self.distillation_node)
        workflow.add_node("critic", self.critic_node)
        workflow.add_node("human_reviewer", self.human_review_node)
        workflow.add_node("finalize", self.finalize_node)

        # Commander 作为入口点
        workflow.set_entry_point("commander")

        # Commander 路由到不同工作流
        workflow.add_conditional_edges(
            "commander",
            self.route_after_commander,
            {
                "architect": "architect",
                "writer": "writer",  # L1 快速模式直接到 Writer
            }
        )

        workflow.add_edge("architect", "writer")

        # Writer -> Distillation (条件边)
        workflow.add_conditional_edges(
            "writer",
            self.route_after_writer,
            {
                "distillation": "distillation",
                "critic": "critic",
            }
        )

        # Distillation -> Critic
        workflow.add_edge("distillation", "critic")

        workflow.add_conditional_edges(
            "critic",
            self.route_after_critic,
            {
                "finalize": "finalize",
                "human_reviewer": "human_reviewer",
                "writer": "writer"
            }
        )

        workflow.add_edge("human_reviewer", "finalize")
        workflow.add_edge("finalize", END)

        return workflow

    def _get_llm(self):
        """获取LLM实例"""

        app_config = get_config()
        google_key = app_config.agent.google_api_key or os.getenv("GOOGLE_API_KEY")
        if google_key:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                return ChatGoogleGenerativeAI(
                    model="gemini-pro",
                    temperature=0.7,
                    google_api_key=google_key
                )
            except Exception:
                pass

        openai_key = app_config.agent.openai_api_key or os.getenv("OPENAI_API_KEY")
        if openai_key:
            try:
                from langchain_openai import ChatOpenAI
                return ChatOpenAI(
                    model="gpt-4",
                    temperature=0.7,
                    openai_api_key=openai_key
                )
            except Exception:
                pass

        raise RuntimeError("无法初始化 LLM，请设置 GOOGLE_API_KEY 或 OPENAI_API_KEY")

    # ============================================================
    # 节点函数
    # ============================================================

    async def commander_node(self, state: WritingState) -> Dict[str, Any]:
        """Commander Agent: 任务路由和技能调度"""
        print("\n" + "="*50)
        print("🎯 Commander Agent: 分析任务并路由...")
        print("="*50)

        from src.agents.commander import CommanderAgent, WorkflowLevel

        llm = self._get_llm()
        agent = CommanderAgent(llm)

        try:
            user_idea = state.get("user_idea", "")

            # 路由到工作流级别
            level = agent.route(user_idea)

            # 检测场景类型并调度技能
            scene_type = agent.detect_scene_type(user_idea)
            skills = agent.dispatch_skills(scene_type)

            # 分解任务
            assignments = agent.dispatch_tasks(user_idea, level)

            print(f"✅ 工作流级别: {level.value}")
            print(f"   场景类型: {scene_type.value}")
            print(f"   调度技能: {skills[:3]}...")
            print(f"   任务数量: {len(assignments)}")

            return {
                "workflow_level": level.value,
                "scene_type": scene_type.value,
                "scene_detection_confidence": assignments[0].context.get("scene_detection_confidence", 0.0) if assignments else 0.0,
                "fallback_used": assignments[0].context.get("fallback_used", False) if assignments else False,
                "matched_keywords": assignments[0].context.get("matched_keywords", {"scene": [], "route": []}) if assignments else {"scene": [], "route": []},
                "dispatched_skills": skills,
                "task_assignments": [a.model_dump() for a in assignments],
            }

        except Exception as e:
            print(f"❌ Commander 执行失败: {e}")
            return {
                "workflow_level": "standard",
                "errors": state.get("errors", []) + [f"Commander Error: {str(e)}"]
            }

    def route_after_commander(self, state: WritingState) -> str:
        """根据 Commander 的路由决策选择下一个节点"""
        level = state.get("workflow_level", "standard")

        if level == "rapid":
            # L1 快速模式: 跳过 Architect 直接到 Writer
            print("⚡ L1 快速模式: 直接进入 Writer")
            return "writer"
        else:
            # L3/L5 标准/深度模式: 先经过 Architect
            print("📋 标准模式: 进入 Architect 规划结构")
            return "architect"

    def route_after_writer(self, state: WritingState) -> str:
        """Writer 后的路由决策: 是否执行蒸馏"""
        # 检查是否需要蒸馏
        has_draft = bool(state.get("draft_content"))
        not_distilled = "distillation_result" not in state

        # 配置允许蒸馏
        config = self.config or {}
        distill_enabled = config.get("enable_distillation", True)

        if has_draft and not_distilled and distill_enabled:
            print("🧪 进入知识蒸馏节点...")
            return "distillation"
        else:
            print("⏭️ 跳过蒸馏，直接进入 Critic")
            return "critic"

    async def architect_node(self, state: WritingState) -> Dict[str, Any]:
        print("\n" + "="*50)
        print("🏗️ Architect Agent: 规划故事结构...")
        print("="*50)
        
        from src.agents.architect import ArchitectAgent

        llm = self._get_llm()
        agent = ArchitectAgent(llm)

        try:
            blueprint = await agent.plan(
                user_idea=state.get("user_idea", ""),
                genre=state.get("genre", "悬疑"),
                target_chapters=state.get("target_chapters", 30),
                target_wordcount=state.get("target_wordcount", 600000)
            )

            scene_cards = [sc.model_dump() for sc in blueprint.scene_cards]
            first_scene = scene_cards[0] if scene_cards else {}

            print(f"✅ 生成 {len(scene_cards)} 个场景卡片")
            print(f"   LOCK总分: {blueprint.lock_analysis.total_score}/40")

            return {
                "story_blueprint": blueprint.model_dump(),
                "lock_analysis": blueprint.lock_analysis.model_dump(),
                "scene_cards": scene_cards,
                "current_scene": first_scene,
                "current_scene_index": 0,
                "revision_count": 0,
                "draft_version": 0
            }

        except Exception as e:
            print(f"❌ Architect 执行失败: {e}")
            return {
                "errors": state.get("errors", []) + [f"Architect Error: {str(e)}"],
                "requires_human_intervention": True
            }

    async def writer_node(self, state: WritingState) -> Dict[str, Any]:
        revision_count = state.get("revision_count", 0)
        version = state.get("draft_version", 0) + 1
        
        print("\n" + "="*50)
        print(f"✍️ Writer Agent: 撰写第 {version} 版草稿...")
        print("="*50)
        
        from src.agents.writer import WriterAgent, WriterInput

        llm = self._get_llm()
        agent = WriterAgent(llm)

        scene = state.get("current_scene", {})

        writer_input = WriterInput(
            scene_id=scene.get("scene_id", "CH01-SC01"),
            chapter_num=scene.get("chapter_num", 1),
            pov_character=scene.get("pov_character", ""),
            objective=scene.get("objective", ""),
            conflict=scene.get("conflict", ""),
            outcome=scene.get("outcome", "+"),
            plot_beat=scene.get("plot_beat", ""),
            emotional_arc=scene.get("emotional_arc", "平静→变化"),
            sensory_guidance=scene.get("sensory_guidance", {}),
            character_profiles=state.get("character_profiles", []),
            world_settings=state.get("world_settings", {}),
            foreshadows_to_plant=scene.get("foreshadows_to_plant", []),
            foreshadows_to_harvest=scene.get("foreshadows_to_harvest", []),
            word_target=2000
        )

        feedback = state.get("feedback_context", "")
        if revision_count > 0 and feedback:
            print(f"   📝 基于Critic反馈进行第 {revision_count} 次修改")
            writer_input.previous_content = f"""
## 上一版本存在的问题

{feedback}

## 请根据以上反馈重写内容
"""
        
        try:
            result = await agent.write(writer_input)

            print(f"✅ 生成草稿: {result.wordcount} 字")
            print(f"   感官描写: {', '.join(result.sensory_types_used)}")
            if result.forbidden_words_found:
                print(f"   ⚠️ 禁用词: {result.forbidden_words_found}")

            return {
                "draft_content": result.content,
                "draft_version": version,
                "draft_wordcount": result.wordcount,
                "writer_metadata": result.metadata,
                "writer_self_check": {
                    "sensory_types": result.sensory_types_used,
                    "forbidden_words": result.forbidden_words_found,
                    "needs_review": result.sections_needing_review
                }
            }

        except Exception as e:
            print(f"❌ Writer 执行失败: {e}")
            return {
                "errors": state.get("errors", []) + [f"Writer Error: {str(e)}"]
            }

    async def distillation_node(self, state: WritingState) -> Dict[str, Any]:
        """Distillation Node: 知识蒸馏"""
        print("\n" + "="*50)
        print("🧪 Distillation Node: 执行知识蒸馏...")
        print("="*50)

        from src.workflow.graph import DistillationNode, DistillationTemplate

        # 获取蒸馏模板配置
        config = self.config or {}
        template_name = config.get("distillation_template", "full")
        template = DistillationTemplate.from_string(template_name)

        # 创建蒸馏节点
        node = DistillationNode(template=template)

        try:
            # 执行蒸馏
            updated_state = node.process(state)

            # 获取结果
            result = updated_state.get("distillation_result", {})

            print(f"✅ 蒸馏完成:")
            print(f"   实体数: {result.get('entities_count', 0)}")
            print(f"   关系数: {result.get('relations_count', 0)}")
            print(f"   事件数: {result.get('events_count', 0)}")
            print(f"   模板: {result.get('template', 'full')}")

            return {
                "distillation_result": result,
                "distillation_state": updated_state.get("distillation_state", {}),
            }

        except Exception as e:
            print(f"⚠️ 蒸馏失败 (不阻塞主流程): {e}")
            return {
                "errors": state.get("errors", []) + [f"Distillation warning: {str(e)}"]
            }

    async def critic_node(self, state: WritingState) -> Dict[str, Any]:
        revision_count = state.get("revision_count", 0)

        print("\n" + "="*50)
        print(f"🧐 Critic Agent: 审核稿件 (第 {revision_count + 1} 次审核)...")
        print("="*50)

        from src.agents.critic import CriticAgent

        llm = self._get_llm()
        agent = CriticAgent(llm)

        try:
            result = await agent.review(
                draft_content=state.get("draft_content", ""),
                scene_card=state.get("current_scene", {}),
                character_profiles=state.get("character_profiles", []),
                world_settings=state.get("world_settings", {})
            )

            print(f"📊 评分结果:")
            print(f"   总分: {result.total_score}/100")
            print(f"   LOCK: {result.lock_score}/40")
            print(f"   风格: {result.style_score}/35")
            print(f"   逻辑: {result.logic_score}/25")
            print(f"   决策: {result.decision}")

            history_entry = {
                "version": state.get("draft_version", 1),
                "score": result.total_score,
                "decision": result.decision,
                "feedback": result.actionable_feedback[:200] if result.actionable_feedback else ""
            }
            revision_history = state.get("revision_history", []) + [history_entry]

            return {
                "critique_result": result.model_dump(),
                "revision_count": revision_count + 1,
                "revision_history": revision_history,
                "feedback_context": result.actionable_feedback,
                "revision_instructions": [inst.model_dump() for inst in result.revision_instructions]
            }

        except Exception as e:
            print(f"❌ Critic 执行失败: {e}")
            return {
                "errors": state.get("errors", []) + [f"Critic Error: {str(e)}"]
            }

    def human_review_node(self, state: WritingState) -> Dict[str, Any]:
        print("\n" + "="*50)
        print("⚠️ Human Review: 需要人工审阅")
        print("="*50)

        critique = state.get("critique_result", {})

        print(f"   总分: {critique.get('total_score', 'N/A')}")
        print(f"   决策: {critique.get('decision', 'N/A')}")
        print(f"   原因: {critique.get('decision_reason', 'N/A')}")
        print(f"   修改次数: {state.get('revision_count', 0)}")
        print("\n   [人工审阅] 需要人工确认后继续")

        return {
            "requires_human_intervention": True,
            "human_review_status": "review_required",
            "human_review_notes": critique.get("decision_reason", ""),
            "final_content": state.get("draft_content", ""),
            "final_score": critique.get("total_score", 0)
        }

    def finalize_node(self, state: WritingState) -> Dict[str, Any]:
        print("\n" + "="*50)
        print("✅ 写作完成!")
        print("="*50)

        critique = state.get("critique_result", {})

        return {
            "final_content": state.get("draft_content", ""),
            "final_score": critique.get("total_score", 0)
        }

    def route_after_critic(self, state: WritingState) -> str:
        critique = state.get("critique_result", {})
        revision_count = state.get("revision_count", 0)

        total_score = critique.get("total_score", 0)
        decision = critique.get("decision", "REVISE")
        
        lock_analysis = critique.get("lock_analysis", {})
        c_score = lock_analysis.get("C", {}).get("score", 0) if lock_analysis else 0
        
        pass_score = self.config.get("pass_score", 80)
        min_c_score = self.config.get("min_c_score", 7)
        max_revisions = self.config.get("max_revisions", 3)
        human_review_score = self.config.get("human_review_score", 70)

        if decision == "APPROVED" or (total_score >= pass_score and c_score >= min_c_score):
            print(f"✅ 审核通过! (总分: {total_score}, C分: {c_score})")
            return "finalize"
        
        if revision_count >= max_revisions:
            print(f"⚠️ 达到最大修改次数 ({max_revisions})，需要人工介入")
            return "human_reviewer"
        
        if decision == "REWRITE":
            print(f"❌ 质量过低 ({total_score})，需要人工介入")
            return "human_reviewer"
        
        if decision == "HUMAN_REVIEW" or total_score >= human_review_score:
            print(f"⚠️ 分数 {total_score} 建议人工审阅")
            return "human_reviewer"

        print(f"🔄 分数 {total_score} 未达标，退回 Writer 修改 (第 {revision_count}/{max_revisions} 次)...")
        return "writer"
