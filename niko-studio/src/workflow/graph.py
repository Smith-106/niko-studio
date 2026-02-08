"""
写作工作流图 (State Graph)

基于 LangGraph 构建的 Agentic Loop.
目前作为 facade，将逻辑委托给 Domain Adapters (如 NovelAdapter).

Entry Points:
- compile_graph: 编译工作流应用
- run_writing_session: 运行一次性会话
- add_distillation_node: 添加蒸馏节点到图中
- DistillationNode: 知识蒸馏节点类
"""

from typing import Dict, Any, Optional, List, Literal
from dataclasses import dataclass, field
from enum import Enum
from langgraph.graph import StateGraph
from langgraph.checkpoint.memory import MemorySaver

from src.workflow.state import (
    WritingState,
    WorkflowConfig,
    DEFAULT_CONFIG,
    create_initial_state
)


# ============================================================
# Distillation Types (蒸馏类型定义)
# ============================================================

class DistillationTemplate(Enum):
    """蒸馏模板类型"""
    ENTITY_EXTRACTION = "entity_extraction"      # 实体提取
    RELATION_EXTRACTION = "relation_extraction"  # 关系提取
    EVENT_EXTRACTION = "event_extraction"        # 事件提取
    SUMMARY = "summary"                          # 摘要生成
    CHARACTER_ARC = "character_arc"              # 角色弧线
    PLOT_STRUCTURE = "plot_structure"            # 情节结构
    FULL = "full"                                # 完整蒸馏 (所有模板)

    @classmethod
    def from_string(cls, name: str) -> "DistillationTemplate":
        """从字符串解析模板类型"""
        mapping = {
            "entity": cls.ENTITY_EXTRACTION,
            "entities": cls.ENTITY_EXTRACTION,
            "relation": cls.RELATION_EXTRACTION,
            "relations": cls.RELATION_EXTRACTION,
            "event": cls.EVENT_EXTRACTION,
            "events": cls.EVENT_EXTRACTION,
            "summary": cls.SUMMARY,
            "character": cls.CHARACTER_ARC,
            "character_arc": cls.CHARACTER_ARC,
            "plot": cls.PLOT_STRUCTURE,
            "plot_structure": cls.PLOT_STRUCTURE,
            "full": cls.FULL,
            "all": cls.FULL,
        }
        return mapping.get(name.lower(), cls.FULL)


@dataclass
class DistillationState:
    """
    蒸馏状态

    存储蒸馏过程的输入、配置和结果。
    """
    # 输入源
    sources: List[str] = field(default_factory=list)

    # 蒸馏模板
    template: DistillationTemplate = DistillationTemplate.FULL

    # 蒸馏结果
    result: Dict[str, Any] = field(default_factory=dict)

    # 元数据
    scene_id: str = ""
    chapter_num: int = 0
    is_completed: bool = False
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "sources": self.sources,
            "template": self.template.value,
            "result": self.result,
            "scene_id": self.scene_id,
            "chapter_num": self.chapter_num,
            "is_completed": self.is_completed,
            "error": self.error,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DistillationState":
        """从字典创建"""
        return cls(
            sources=data.get("sources", []),
            template=DistillationTemplate.from_string(data.get("template", "full")),
            result=data.get("result", {}),
            scene_id=data.get("scene_id", ""),
            chapter_num=data.get("chapter_num", 0),
            is_completed=data.get("is_completed", False),
            error=data.get("error"),
        )


# ============================================================
# Distillation Node Class (知识蒸馏节点类)
# ============================================================

class DistillationNode:
    """
    知识蒸馏节点

    在 Writer 完成草稿后，提取结构化知识:
    - 实体 (角色、地点、物品)
    - 关系 (人物关系、空间关系)
    - 事件 (时间线事件)

    支持多种蒸馏模板，提取的知识写入 KnowledgeLayer。
    """

    def __init__(
        self,
        template: DistillationTemplate = DistillationTemplate.FULL,
        knowledge_layer: Any = None,
        distill_service: Any = None,
    ):
        """
        初始化蒸馏节点

        Args:
            template: 蒸馏模板类型
            knowledge_layer: 知识层实例 (可选)
            distill_service: 蒸馏服务实例 (可选)
        """
        self.template = template
        self._knowledge_layer = knowledge_layer
        self._distill_service = distill_service

    @property
    def knowledge_layer(self):
        """延迟加载知识层"""
        if self._knowledge_layer is None:
            from src.services.knowledge_layer import AgentKnowledgeLayer
            self._knowledge_layer = AgentKnowledgeLayer()
        return self._knowledge_layer

    @property
    def distill_service(self):
        """延迟加载蒸馏服务 (使用统一的 DistillationManager)"""
        if self._distill_service is None:
            from src.memory.distillation_manager import DistillationManager
            self._distill_service = DistillationManager()
        return self._distill_service

    def process(self, state: WritingState) -> WritingState:
        """
        执行知识蒸馏

        Args:
            state: 工作流状态

        Returns:
            更新后的状态
        """
        draft_content = state.get("draft_content", "")
        if not draft_content:
            return state

        # 创建蒸馏状态
        distill_state = DistillationState(
            sources=[draft_content],
            template=self.template,
            scene_id=state.get("current_scene", {}).get("scene_id", ""),
            chapter_num=state.get("current_chapter", 0),
        )

        try:
            # 根据模板执行蒸馏
            result = self._execute_distillation(draft_content, self.template)

            # 写入知识层
            self.distill_service.apply_to_graph(self.knowledge_layer, result)

            # 更新蒸馏状态
            distill_state.result = result
            distill_state.is_completed = True

            # 更新工作流状态
            state["distillation_result"] = {
                "entities_count": len(result.get("entities", [])),
                "relations_count": len(result.get("relations", [])),
                "events_count": len(result.get("events", [])),
                "entities": result.get("entities", []),
                "relations": result.get("relations", []),
                "events": result.get("events", []),
                "template": self.template.value,
                "scene_id": distill_state.scene_id,
            }
            state["distillation_state"] = distill_state.to_dict()

        except Exception as e:
            # 蒸馏失败不阻塞主流程
            distill_state.error = str(e)
            state["errors"] = state.get("errors", []) + [f"Distillation warning: {e}"]
            state["distillation_state"] = distill_state.to_dict()

        return state

    def _execute_distillation(
        self,
        content: str,
        template: DistillationTemplate
    ) -> Dict[str, Any]:
        """
        根据模板执行蒸馏

        Args:
            content: 待蒸馏内容
            template: 蒸馏模板

        Returns:
            蒸馏结果
        """
        result = {"entities": [], "relations": [], "events": []}

        if template == DistillationTemplate.ENTITY_EXTRACTION:
            data = self.distill_service.distill_chapter(content)
            result["entities"] = data.get("entities", [])

        elif template == DistillationTemplate.RELATION_EXTRACTION:
            data = self.distill_service.distill_chapter(content)
            result["relations"] = data.get("relations", [])

        elif template == DistillationTemplate.EVENT_EXTRACTION:
            # 事件提取 (扩展 DistillService 可支持)
            data = self.distill_service.distill_chapter(content)
            result["events"] = data.get("events", [])

        elif template == DistillationTemplate.SUMMARY:
            # 摘要生成
            data = self.distill_service.distill_chapter(content)
            result["summary"] = data.get("summary", "")

        elif template == DistillationTemplate.CHARACTER_ARC:
            # 角色弧线提取
            data = self.distill_service.distill_chapter(content)
            result["character_arcs"] = data.get("character_arcs", [])
            result["entities"] = [e for e in data.get("entities", []) if e.get("type") == "Character"]

        elif template == DistillationTemplate.PLOT_STRUCTURE:
            # 情节结构提取
            data = self.distill_service.distill_chapter(content)
            result["plot_points"] = data.get("plot_points", [])
            result["events"] = data.get("events", [])

        else:  # FULL
            # 完整蒸馏
            data = self.distill_service.distill_chapter(content)
            result["entities"] = data.get("entities", [])
            result["relations"] = data.get("relations", [])
            result["events"] = data.get("events", [])

        return result

    def __call__(self, state: WritingState) -> WritingState:
        """使节点可作为函数调用"""
        return self.process(state)


# ============================================================
# Distillation Node Functions (蒸馏节点函数)
# ============================================================

def distillation_node(state: WritingState) -> WritingState:
    """
    知识蒸馏节点 (函数形式)

    在 Writer 完成草稿后，提取结构化知识:
    - 实体 (角色、地点、物品)
    - 关系 (人物关系、空间关系)
    - 事件 (时间线事件)

    提取的知识会写入 KnowledgeLayer，供后续章节使用。
    """
    node = DistillationNode(template=DistillationTemplate.FULL)
    return node.process(state)


def should_distill(state: WritingState) -> bool:
    """判断是否需要执行蒸馏"""
    # 有草稿内容且未蒸馏过
    has_draft = bool(state.get("draft_content"))
    not_distilled = "distillation_result" not in state

    # 配置允许蒸馏
    config = state.get("config", {})
    distill_enabled = config.get("enable_distillation", True)

    return has_draft and not_distilled and distill_enabled


def route_after_distillation(state: WritingState) -> Literal["critic", "finalize"]:
    """蒸馏后的路由决策"""
    # 蒸馏完成后继续到 Critic
    distill_state = state.get("distillation_state", {})

    if distill_state.get("error"):
        # 蒸馏有错误，但不阻塞流程
        pass

    # 默认继续到 Critic
    return "critic"


def add_distillation_node(
    graph: StateGraph,
    after_node: str = "writer",
    template: DistillationTemplate = DistillationTemplate.FULL,
    conditional: bool = True,
) -> StateGraph:
    """
    向工作流图添加蒸馏节点

    Args:
        graph: StateGraph 实例
        after_node: 在哪个节点之后添加蒸馏节点
        template: 蒸馏模板类型
        conditional: 是否使用条件边 (根据 should_distill 判断)

    Returns:
        更新后的 StateGraph
    """
    # 创建蒸馏节点
    node = DistillationNode(template=template)

    # 添加蒸馏节点
    graph.add_node("distillation", node)

    if conditional:
        # 添加条件边: after_node -> distillation | next_node
        def route_to_distill(state: WritingState) -> str:
            if should_distill(state):
                return "distillation"
            return "critic"  # 跳过蒸馏直接到 Critic

        graph.add_conditional_edges(
            after_node,
            route_to_distill,
            {
                "distillation": "distillation",
                "critic": "critic",
            }
        )
    else:
        # 直接添加边
        graph.add_edge(after_node, "distillation")

    return graph


def create_distillation_node(
    template: str = "full",
    knowledge_layer: Any = None,
) -> DistillationNode:
    """
    创建蒸馏节点的工厂函数

    Args:
        template: 模板名称 (entity/relation/event/summary/character_arc/plot_structure/full)
        knowledge_layer: 知识层实例 (可选)

    Returns:
        DistillationNode 实例
    """
    template_enum = DistillationTemplate.from_string(template)
    return DistillationNode(
        template=template_enum,
        knowledge_layer=knowledge_layer,
    )


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
