from typing import Any, Dict, Optional, List
from enum import Enum
import textwrap
from src.workflow.levels.types import WorkflowLevel, to_workflow_label
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.runnables import RunnableLambda, Runnable
from .base import BaseAgent
from .skill_router import SkillRouter, TaskType, SkillRecommendation

class TaskAnalysis(BaseModel):
    """Structured analysis of the user's task request."""
    reasoning: str = Field(description="Reasoning for the workflow level selection")
    workflow_level: WorkflowLevel = Field(description="The determined workflow level")


class SceneType(Enum):
    """Scene types for skill matching."""
    OPENING = "opening"
    DIALOGUE = "dialogue"
    ACTION = "action"
    CLIMAX = "climax"
    ENDING = "ending"
    TRANSITION = "transition"
    WORLDBUILDING = "worldbuilding"
    CHARACTER_FOCUS = "character_focus"
    SUSPENSE = "suspense"


class TaskAssignment(BaseModel):
    """A single task assigned to an agent."""
    task_id: str = Field(description="Unique task identifier")
    agent_type: str = Field(description="Target agent: architect/writer/critic")
    scene_type: SceneType = Field(description="Scene type for skill matching")
    instruction: str = Field(description="Specific instruction for the agent")
    skills: List[str] = Field(default_factory=list, description="Matched skill IDs")
    context: Dict[str, Any] = Field(default_factory=dict, description="Additional context")
    depends_on: List[str] = Field(default_factory=list, description="Task IDs this depends on")


class TaskDecomposition(BaseModel):
    """LLM output for task decomposition."""
    scene_type: str = Field(description="Detected scene type")
    subtasks: List[str] = Field(description="List of subtask descriptions")
    agent_sequence: List[str] = Field(description="Ordered list of agents to invoke")


class CommanderOutput(BaseModel):
    """Final output from Commander Agent."""
    workflow_level: WorkflowLevel
    task_assignments: List[TaskAssignment]
    total_steps: int
    estimated_tokens: int = 0

class CommanderAgent(BaseAgent):
    """
    Commander Agent responsible for routing task to appropriate workflows (L1-L5).

    Uses LLM analysis to determine the complexity of the user's request,
    falling back to keyword heuristics if the analysis fails.
    """

    # Scene type to skill mapping
    SCENE_SKILL_MAP = {
        SceneType.OPENING: ["opening-craft", "tension-scene", "character-forge"],
        SceneType.DIALOGUE: ["dialogue-system", "psychology-craft", "show-dont-tell"],
        SceneType.ACTION: ["action-craft", "tension-scene", "pov-system"],
        SceneType.CLIMAX: ["conflict-escalation", "tension-arc", "emotion-arc"],
        SceneType.ENDING: ["ending-craft", "foreshadowing-craft", "emotion-arc"],
        SceneType.TRANSITION: ["transition-craft", "timeline-craft"],
        SceneType.WORLDBUILDING: ["worldview-craft", "setting-craft", "environment-craft"],
        SceneType.CHARACTER_FOCUS: ["character-forge", "four-selves", "psychology-craft"],
        SceneType.SUSPENSE: ["suspense-craft", "foreshadowing-craft", "misdirection-twist"],
    }

    def __init__(self, llm: 'Runnable', name: str = "Commander", config: Optional[Dict[str, Any]] = None):
        """
        Initialize the CommanderAgent.

        Args:
            llm: The Language Model instance to use for analysis.
            name: The name of the agent.
            config: Optional configuration dictionary.
        """
        super().__init__(name, config)
        self.llm = llm
        self.skill_router = SkillRouter()

    def route(self, task_description: str) -> WorkflowLevel:
        """
        Analyzes the task complexity and returns the appropriate workflow level.
        
        Args:
            task_description: The user's request.
            
        Returns:
            WorkflowLevel: The determined workflow level.
        """
        parser = PydanticOutputParser(pydantic_object=TaskAnalysis)

        # Define the 6-Field Prompt components
        purpose = "Analyze the user's request to determine the appropriate workflow level."
        task = "Classify the request into one of the defined workflow levels."
        mode = "analysis"
        context = f"User Request: '{task_description}'"
        expected = "A structured analysis including reasoning and the selected workflow level."

        # Use dedent to ensure clean prompt formatting without extra indentation
        rules = textwrap.dedent("""
            Use the following definitions for classification:
            - L1_RAPID: Quick fixes, typo corrections, grammar polish, small edits.
            - L2_LITE: Short passages, lightweight revisions, single scene expansions.
            - L3_STANDARD: Writing full chapters, scenes, or substantial content generation.
            - L4_BRAINSTORM: Multi-angle ideation, conflict design, intensive brainstorming.
            - L5_COORDINATOR: Long-form planning, multi-stage coordination, full project outlines.
        """).strip()
        
        prompt_str = self.construct_prompt(
            purpose=purpose,
            task=task,
            mode=mode,
            context=context,
            expected=expected,
            rules=rules
        )
        
        prompt = ChatPromptTemplate.from_template(
            prompt_str + "\n\n{format_instructions}"
        )

        llm_runnable = self.llm
        if not isinstance(self.llm, Runnable):
            llm_runnable = RunnableLambda(lambda x: self.llm.invoke(x))

        chain = prompt | llm_runnable | parser

        try:
            result = chain.invoke({
                "format_instructions": parser.get_format_instructions()
            })

            self.log_activity(f"Routing '{task_description}' to {result.workflow_level} (Reason: {result.reasoning})")
            return result.workflow_level
            
        except Exception as e:
            self.log_activity(f"LLM routing failed: {e}. Falling back to heuristics.", level="WARNING")
            # Fallback to heuristics
            task_lower = task_description.lower()

            if any(kw in task_lower for kw in ["typo", "fix", "polish", "correct", "grammar", "修复", "错别字", "纠正", "语法"]):
                self.log_activity("Fallback: routing to L1_RAPID based on keywords.", level="INFO")
                return WorkflowLevel.L1_RAPID

            if any(kw in task_lower for kw in ["paragraph", "short", "snippet", "段落", "片段", "短文"]):
                self.log_activity("Fallback: routing to L2_LITE based on keywords.", level="INFO")
                return WorkflowLevel.L2_LITE

            if any(kw in task_lower for kw in ["brainstorm", "idea", "concept", "world", "character", "setting", "story", "plot", "outline", "arc", "头脑风暴", "构思", "世界观", "设定", "角色", "性格", "设计", "体系", "大纲", "剧情", "情节", "规划", "计划"]):
                self.log_activity("Fallback: routing to L5_BRAINSTORM based on keywords.", level="INFO")
                return WorkflowLevel.L5_BRAINSTORM

            if any(kw in task_lower for kw in ["project", "roadmap", "full", "novel", "全书", "项目"]):
                self.log_activity("Fallback: routing to L5_COORDINATOR based on keywords.", level="INFO")
                return WorkflowLevel.L5_COORDINATOR

            self.log_activity("Fallback: default routing to L3_STANDARD.", level="INFO")
            return WorkflowLevel.L3_STANDARD

    def run(self, input_data: Any) -> Any:
        # Placeholder for main execution logic
        pass

    def detect_scene_type(self, task_description: str) -> SceneType:
        """
        Detect the scene type from task description using keyword matching.

        Args:
            task_description: The user's request.

        Returns:
            SceneType: The detected scene type.
        """
        task_lower = task_description.lower()

        scene_keywords = {
            SceneType.OPENING: ["开头", "开篇", "开场", "引子", "序章", "opening", "prologue"],
            SceneType.DIALOGUE: ["对话", "对白", "交谈", "争论", "dialogue", "conversation"],
            SceneType.ACTION: ["动作", "战斗", "追逐", "打斗", "action", "fight", "chase"],
            SceneType.CLIMAX: ["高潮", "决战", "对决", "转折", "climax", "showdown"],
            SceneType.ENDING: ["结尾", "结局", "尾声", "收尾", "ending", "finale"],
            SceneType.TRANSITION: ["过渡", "转场", "衔接", "transition"],
            SceneType.WORLDBUILDING: ["世界观", "设定", "背景", "环境", "worldbuilding", "setting"],
            SceneType.CHARACTER_FOCUS: ["角色", "人物", "性格", "内心", "character"],
            SceneType.SUSPENSE: ["悬念", "悬疑", "伏笔", "暗示", "suspense", "mystery"],
        }

        for scene_type, keywords in scene_keywords.items():
            if any(kw in task_lower for kw in keywords):
                return scene_type

        # Default to dialogue as most common
        return SceneType.DIALOGUE

    def dispatch_skills(self, scene_type: SceneType) -> List[str]:
        """
        Get skills for a given scene type.

        Args:
            scene_type: The scene type.

        Returns:
            List of skill IDs matched to this scene type.
        """
        skills = self.SCENE_SKILL_MAP.get(scene_type, [])
        self.log_activity(f"Dispatched {len(skills)} skills for {scene_type.value}: {skills}")
        return skills

    def dispatch_tasks(
        self,
        task_description: str,
        level: WorkflowLevel
    ) -> List[TaskAssignment]:
        """
        Decompose a task into subtasks assigned to agents.

        Args:
            task_description: The user's request.
            level: The workflow level.

        Returns:
            List of task assignments for agents.
        """
        scene_type = self.detect_scene_type(task_description)
        skills = self.dispatch_skills(scene_type)

        assignments = []

        if level == WorkflowLevel.L1_RAPID:
            # L1: Only Writer for quick fixes
            assignments.append(TaskAssignment(
                task_id="task-001",
                agent_type="writer",
                scene_type=scene_type,
                instruction=f"Quick polish: {task_description}",
                skills=skills[:2],  # Use top 2 skills
                context={"level": "L1", "max_tokens": 500},
                depends_on=[],
            ))

        elif level == WorkflowLevel.L2_LITE:
            # L2: Lightweight writer flow
            assignments.append(TaskAssignment(
                task_id="task-001",
                agent_type="writer",
                scene_type=scene_type,
                instruction=f"Lightweight draft: {task_description}",
                skills=skills,
                context={"level": "L2", "target_words": 800},
                depends_on=[],
            ))

        elif level == WorkflowLevel.L3_STANDARD:
            # L3: Architect -> Writer -> Critic
            assignments.append(TaskAssignment(
                task_id="task-001",
                agent_type="architect",
                scene_type=scene_type,
                instruction=f"Design scene structure with LOCK validation: {task_description}",
                skills=["22-steps-outline", "pyramid-structure"],
                context={"level": "L3"},
                depends_on=[],
            ))
            assignments.append(TaskAssignment(
                task_id="task-002",
                agent_type="writer",
                scene_type=scene_type,
                instruction=f"Write scene following architect's structure: {task_description}",
                skills=skills,
                context={"level": "L3", "target_words": 2000},
                depends_on=["task-001"],
            ))
            assignments.append(TaskAssignment(
                task_id="task-003",
                agent_type="critic",
                scene_type=scene_type,
                instruction="Evaluate the written content using 8-dimension LOCK matrix",
                skills=["script-doctor", "self-knowledge-eval"],
                context={"level": "L3"},
                depends_on=["task-002"],
            ))

        elif level == WorkflowLevel.L4_BRAINSTORM or level == WorkflowLevel.L5_BRAINSTORM:
            # Brainstorm flow
            level_label = "L4"
            if level == WorkflowLevel.L5_BRAINSTORM:
                level_label = "L5"
            assignments.append(TaskAssignment(
                task_id="task-001",
                agent_type="worldbuilding",
                scene_type=SceneType.WORLDBUILDING,
                instruction=f"Brainstorm world context: {task_description}",
                skills=["worldview-craft", "setting-craft"],
                context={"level": level_label},
                depends_on=[],
            ))
            assignments.append(TaskAssignment(
                task_id="task-002",
                agent_type="character",
                scene_type=SceneType.CHARACTER_FOCUS,
                instruction=f"Brainstorm character context: {task_description}",
                skills=["character-forge", "four-selves"],
                context={"level": level_label},
                depends_on=[],
            ))
            assignments.append(TaskAssignment(
                task_id="task-003",
                agent_type="architect",
                scene_type=scene_type,
                instruction=f"Synthesize multi-angle ideas: {task_description}",
                skills=["22-steps-outline", "pyramid-structure"],
                context={"level": level_label},
                depends_on=["task-001", "task-002"],
            ))
            assignments.append(TaskAssignment(
                task_id="task-004",
                agent_type="writer",
                scene_type=scene_type,
                instruction=f"Write based on brainstorm synthesis: {task_description}",
                skills=skills,
                context={"level": level_label, "target_words": 2500},
                depends_on=["task-003"],
            ))
            assignments.append(TaskAssignment(
                task_id="task-005",
                agent_type="critic",
                scene_type=scene_type,
                instruction="Evaluate brainstorm output with 8-dimension LOCK matrix",
                skills=["script-doctor", "self-knowledge-eval"],
                context={"level": level_label},
                depends_on=["task-004"],
            ))

        elif level == WorkflowLevel.L5_COORDINATOR:
            # L5: Full pipeline with context agents
            assignments.append(TaskAssignment(
                task_id="task-001",
                agent_type="worldbuilding",
                scene_type=SceneType.WORLDBUILDING,
                instruction=f"Gather world context: {task_description}",
                skills=["worldview-craft", "setting-craft"],
                context={"level": "L5"},
                depends_on=[],
            ))
            assignments.append(TaskAssignment(
                task_id="task-002",
                agent_type="character",
                scene_type=SceneType.CHARACTER_FOCUS,
                instruction=f"Gather character context: {task_description}",
                skills=["character-forge", "four-selves"],
                context={"level": "L5"},
                depends_on=[],
            ))
            assignments.append(TaskAssignment(
                task_id="task-003",
                agent_type="architect",
                scene_type=scene_type,
                instruction=f"Design structure with full context: {task_description}",
                skills=["22-steps-outline", "pyramid-structure"],
                context={"level": "L5"},
                depends_on=["task-001", "task-002"],
            ))
            assignments.append(TaskAssignment(
                task_id="task-004",
                agent_type="writer",
                scene_type=scene_type,
                instruction=f"Write with coordinator depth: {task_description}",
                skills=skills,
                context={"level": "L5", "target_words": 3000},
                depends_on=["task-003"],
            ))
            assignments.append(TaskAssignment(
                task_id="task-005",
                agent_type="critic",
                scene_type=scene_type,
                instruction="Full 8-dimension evaluation with LOCK analysis",
                skills=["script-doctor", "self-knowledge-eval", "deus-ex-machina"],
                context={"level": "L5"},
                depends_on=["task-004"],
            ))

        self.log_activity(f"Dispatched {len(assignments)} tasks for {to_workflow_label(level)}")
        return assignments

    def integrate_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Integrate results from multiple agents into final output.

        Args:
            results: List of agent outputs.

        Returns:
            Integrated final output.
        """
        final_output = {
            "status": "completed",
            "content": "",
            "metadata": {
                "agents_invoked": [],
                "total_tokens": 0,
                "quality_score": 0,
            },
        }

        for result in results:
            agent_type = result.get("agent_type", "unknown")
            final_output["metadata"]["agents_invoked"].append(agent_type)
            final_output["metadata"]["total_tokens"] += result.get("tokens_used", 0)

            if agent_type == "writer":
                final_output["content"] = result.get("content", "")
            elif agent_type == "critic":
                final_output["metadata"]["quality_score"] = result.get("score", 0)
                final_output["metadata"]["decision"] = result.get("decision", "UNKNOWN")

        self.log_activity(f"Integrated results from {len(results)} agents")
        return final_output

    async def execute(self, task_description: str) -> CommanderOutput:
        """
        Full execution pipeline: route -> dispatch -> (execute agents) -> integrate.

        Args:
            task_description: The user's request.

        Returns:
            CommanderOutput with workflow level and task assignments.
        """
        # Step 1: Route to workflow level
        level = self.route(task_description)

        # Step 2: Dispatch tasks
        assignments = self.dispatch_tasks(task_description, level)

        # Step 3: Return plan (actual execution done by workflow engine)
        output = CommanderOutput(
            workflow_level=level,
            task_assignments=assignments,
            total_steps=len(assignments),
            estimated_tokens=sum(
                a.context.get("max_tokens", 1000) for a in assignments
            ),
        )

        self.log_activity(f"Commander execution complete: {to_workflow_label(level)}, {len(assignments)} tasks")
        return output
