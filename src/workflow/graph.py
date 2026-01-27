"""
写作工作流图 (State Graph)

基于 LangGraph 构建的 Agentic Loop:
Architect → Writer → Critic → (Loop/End)

实现模式:
- Reflection Pattern: Critic反馈驱动Writer修改
- Routing Pattern: 基于评分的条件路由
- Exception Handling: 修改次数限制防止死循环
"""

from typing import Literal, Dict, Any
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from src.workflow.state import (
    WritingState, 
    WorkflowConfig, 
    DEFAULT_CONFIG,
    create_initial_state
)


# ============================================================
# 节点函数 (Node Functions)
# ============================================================

async def architect_node(state: WritingState) -> Dict[str, Any]:
    """
    策划节点: 生成LOCK大纲与场景卡片
    
    输入: user_idea, genre
    输出: story_blueprint, scene_cards, current_scene
    """
    print("\n" + "="*50)
    print("🏗️ Architect Agent: 规划故事结构...")
    print("="*50)
    
    from src.agents.architect import ArchitectAgent
    
    # 获取LLM (从配置或环境变量)
    llm = _get_llm()
    
    agent = ArchitectAgent(llm)
    
    try:
        blueprint = await agent.plan(
            user_idea=state.get("user_idea", ""),
            genre=state.get("genre", "悬疑"),
            target_chapters=state.get("target_chapters", 30),
            target_wordcount=state.get("target_wordcount", 600000)
        )
        
        # 提取场景卡片
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


async def writer_node(state: WritingState) -> Dict[str, Any]:
    """
    写作节点: 生成或修改草稿
    
    输入: current_scene, feedback_context (可选)
    输出: draft_content, draft_version, writer_self_check
    """
    revision_count = state.get("revision_count", 0)
    version = state.get("draft_version", 0) + 1
    
    print("\n" + "="*50)
    print(f"✍️ Writer Agent: 撰写第 {version} 版草稿...")
    print("="*50)
    
    from src.agents.writer import WriterAgent, WriterInput
    
    llm = _get_llm()
    agent = WriterAgent(llm)
    
    # 准备输入
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
    
    # 如果是修改模式，注入反馈上下文
    feedback = state.get("feedback_context", "")
    if revision_count > 0 and feedback:
        print(f"   📝 基于Critic反馈进行第 {revision_count} 次修改")
        # 将反馈注入到 previous_content
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


async def critic_node(state: WritingState) -> Dict[str, Any]:
    """
    批评节点: LOCK检查与质量评分
    
    输入: draft_content, current_scene
    输出: critique_result, revision_count
    """
    revision_count = state.get("revision_count", 0)
    
    print("\n" + "="*50)
    print(f"🧐 Critic Agent: 审核稿件 (第 {revision_count + 1} 次审核)...")
    print("="*50)
    
    from src.agents.critic import CriticAgent
    
    llm = _get_llm()
    agent = CriticAgent(llm)
    
    try:
        result = await agent.review(
            draft_content=state.get("draft_content", ""),
            scene_card=state.get("current_scene", {}),
            character_profiles=state.get("character_profiles", []),
            world_settings=state.get("world_settings", {})
        )
        
        # 记录评分
        print(f"📊 评分结果:")
        print(f"   总分: {result.total_score}/100")
        print(f"   LOCK: {result.lock_score}/40")
        print(f"   风格: {result.style_score}/35")
        print(f"   逻辑: {result.logic_score}/25")
        print(f"   决策: {result.decision}")
        
        # 更新修改历史
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


def human_review_node(state: WritingState) -> Dict[str, Any]:
    """
    人工审阅节点 (Human-in-the-Loop)
    
    触发条件:
    - 分数在70-80之间
    - 达到最大修改次数
    - C分数不足但总分尚可
    """
    print("\n" + "="*50)
    print("⚠️ Human Review: 需要人工审阅")
    print("="*50)
    
    critique = state.get("critique_result", {})
    
    print(f"   总分: {critique.get('total_score', 'N/A')}")
    print(f"   决策: {critique.get('decision', 'N/A')}")
    print(f"   原因: {critique.get('decision_reason', 'N/A')}")
    print(f"   修改次数: {state.get('revision_count', 0)}")
    
    # 在实际应用中，这里会暂停等待人工输入
    # 目前模拟人工批准
    print("\n   [模拟] 人工审阅通过")
    
    return {
        "requires_human_intervention": False,
        "final_content": state.get("draft_content", ""),
        "final_score": critique.get("total_score", 0)
    }


def finalize_node(state: WritingState) -> Dict[str, Any]:
    """
    终结节点: 保存最终内容
    """
    print("\n" + "="*50)
    print("✅ 写作完成!")
    print("="*50)
    
    critique = state.get("critique_result", {})
    
    return {
        "final_content": state.get("draft_content", ""),
        "final_score": critique.get("total_score", 0)
    }


# ============================================================
# 路由函数 (Routing Functions)
# ============================================================

def should_continue(state: WritingState, config: WorkflowConfig = DEFAULT_CONFIG) -> Literal["continue", "end", "human"]:
    """
    决策路由: 通过/修改/人工介入
    
    基于:
    1. 总分阈值
    2. C(冲突)维度分数
    3. 修改次数限制
    """
    critique = state.get("critique_result", {})
    revision_count = state.get("revision_count", 0)
    
    # 提取关键分数
    total_score = critique.get("total_score", 0)
    decision = critique.get("decision", "REVISE")
    
    # 提取LOCK C分数
    lock_analysis = critique.get("lock_analysis", {})
    c_score = lock_analysis.get("C", {}).get("score", 0) if lock_analysis else 0
    
    # 配置阈值
    pass_score = config.get("pass_score", 80)
    min_c_score = config.get("min_c_score", 7)
    max_revisions = config.get("max_revisions", 3)
    human_review_score = config.get("human_review_score", 70)
    
    # 决策逻辑
    if decision == "APPROVED" or (total_score >= pass_score and c_score >= min_c_score):
        print(f"✅ 审核通过! (总分: {total_score}, C分: {c_score})")
        return "end"
    
    if revision_count >= max_revisions:
        print(f"⚠️ 达到最大修改次数 ({max_revisions})，需要人工介入")
        return "human"
    
    if decision == "REWRITE":
        print(f"❌ 质量过低 ({total_score})，需要人工介入")
        return "human"
    
    if decision == "HUMAN_REVIEW" or total_score >= human_review_score:
        print(f"⚠️ 分数 {total_score} 建议人工审阅")
        return "human"
    
    # 继续修改循环
    print(f"🔄 分数 {total_score} 未达标，退回 Writer 修改 (第 {revision_count}/{max_revisions} 次)...")
    return "continue"


# ============================================================
# 图构建 (Graph Construction)
# ============================================================

def create_writing_graph(config: WorkflowConfig = DEFAULT_CONFIG) -> StateGraph:
    """
    创建写作工作流图
    
    Delegates to NovelAdapter for graph construction.
    """
    from src.workflow.adapters import AdapterRegistry, DomainType
    
    # Create adapter and get graph
    adapter = AdapterRegistry.create_adapter(DomainType.NOVEL.value, config)
    if not adapter:
        raise ValueError("Failed to create NovelAdapter")

    return adapter.create_graph()


def compile_graph(config: WorkflowConfig = DEFAULT_CONFIG, use_memory: bool = True):
    """
    编译工作流图
    
    Args:
        config: 工作流配置
        use_memory: 是否使用内存检查点
        
    Returns:
        编译后的应用
    """
    workflow = create_writing_graph(config)
    
    if use_memory:
        memory = MemorySaver()
        return workflow.compile(checkpointer=memory)
    
    return workflow.compile()


# ============================================================
# 辅助函数
# ============================================================

def _get_llm():
    """获取LLM实例"""
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    # 优先使用 Gemini
    google_key = os.getenv("GOOGLE_API_KEY")
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
    
    # 备选 OpenAI
    openai_key = os.getenv("OPENAI_API_KEY")
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
    
    raise RuntimeError("无法初始化LLM，请设置 GOOGLE_API_KEY 或 OPENAI_API_KEY")


# ============================================================
# 便捷函数
# ============================================================

async def run_writing_session(
    user_idea: str,
    genre: str = "悬疑",
    target_chapters: int = 30,
    config: WorkflowConfig = DEFAULT_CONFIG,
    verbose: bool = True
) -> WritingState:
    """
    运行完整写作会话
    
    Args:
        user_idea: 用户的故事灵感
        genre: 故事类型
        target_chapters: 目标章节数
        config: 工作流配置
        verbose: 是否输出详细日志
        
    Returns:
        最终状态
    """
    
    # 创建初始状态
    initial_state = create_initial_state(
        user_idea=user_idea,
        genre=genre,
        target_chapters=target_chapters
    )
    
    # 编译图
    app = compile_graph(config, use_memory=False)
    
    # 运行
    if verbose:
        print("\n" + "="*60)
        print("🚀 开始写作会话")
        print("="*60)
        print(f"💡 灵感: {user_idea[:100]}...")
        print(f"📚 类型: {genre}")
        print(f"📖 目标章节: {target_chapters}")
    
    # 流式执行
    final_state = None
    async for output in app.astream(initial_state):
        for node_name, node_output in output.items():
            if verbose:
                print(f"\n[Node: {node_name}] 完成")
            final_state = {**initial_state, **node_output} if final_state is None else {**final_state, **node_output}
    
    return final_state


# Default compiled app for import
try:
    app = compile_graph()
except Exception as e:
    # Handle cases where LLM keys are missing during import time
    print(f"Warning: Could not compile default graph on import: {e}")
    app = None
