"""
L5 协调者模式 (Coordinator)

智能编排工作流：需求分析、命令链推荐、最小执行单元、状态持久化。
适用于：完整小说创作、复杂修订、多模块协作。
"""

import json
import uuid
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from enum import Enum

from .base_level import BaseLevel, LevelRegistry
from ..base_state import BaseState
from ..session.session_manager import SessionManager, ContentType
from .level2_lite import Level2Lite
from .level3_standard import Level3Standard
from .level4_brainstorm import Level4Brainstorm
from ...memory.citation_manager import get_citation_manager
from ...memory.memory_manager import get_memory_manager
from ...search.smart_search import SmartSearch
from ...search.vector_search import VectorSearch
from ...memory.distillation_manager import DistillationManager, DistillationTemplate

logger = logging.getLogger(__name__)


# ============================================================
# 数据类型定义
# ============================================================

class CommandType(Enum):
    """命令类型"""
    ANALYZE = "analyze"      # 分析类命令
    PLAN = "plan"            # 规划类命令
    EXECUTE = "execute"      # 执行类命令
    VERIFY = "verify"        # 验证类命令
    REVISE = "revise"        # 修订类命令


class ExecutionStatus(Enum):
    """执行状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class Command:
    """单个命令"""
    command_id: str
    command_type: CommandType
    name: str
    description: str
    agent: str                              # 执行该命令的 Agent
    parameters: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "command_id": self.command_id,
            "command_type": self.command_type.value,
            "name": self.name,
            "description": self.description,
            "agent": self.agent,
            "parameters": self.parameters,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "Command":
        return cls(
            command_id=data["command_id"],
            command_type=CommandType(data["command_type"]),
            name=data["name"],
            description=data["description"],
            agent=data["agent"],
            parameters=data.get("parameters", {}),
        )


@dataclass
class CommandChain:
    """
    命令链

    定义一组有依赖关系的命令及其执行顺序。
    """
    chain_id: str
    name: str
    description: str
    commands: List[Command] = field(default_factory=list)
    dependencies: Dict[str, List[str]] = field(default_factory=dict)  # command_id -> [依赖的command_id列表]
    execution_order: List[str] = field(default_factory=list)          # 拓扑排序后的执行顺序
    estimated_duration: int = 0                                        # 预估执行时长(秒)

    def add_command(self, command: Command, depends_on: List[str] = None) -> None:
        """添加命令到链中"""
        self.commands.append(command)
        self.dependencies[command.command_id] = depends_on or []
        self._update_execution_order()

    def _update_execution_order(self) -> None:
        """更新执行顺序 (拓扑排序)"""
        # 简单拓扑排序
        visited = set()
        order = []

        def visit(cmd_id: str):
            if cmd_id in visited:
                return
            visited.add(cmd_id)
            for dep in self.dependencies.get(cmd_id, []):
                visit(dep)
            order.append(cmd_id)

        for cmd in self.commands:
            visit(cmd.command_id)

        self.execution_order = order

    def get_command(self, command_id: str) -> Optional[Command]:
        """获取命令"""
        for cmd in self.commands:
            if cmd.command_id == command_id:
                return cmd
        return None

    def to_dict(self) -> Dict:
        return {
            "chain_id": self.chain_id,
            "name": self.name,
            "description": self.description,
            "commands": [cmd.to_dict() for cmd in self.commands],
            "dependencies": self.dependencies,
            "execution_order": self.execution_order,
            "estimated_duration": self.estimated_duration,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "CommandChain":
        chain = cls(
            chain_id=data["chain_id"],
            name=data["name"],
            description=data["description"],
        )
        chain.commands = [Command.from_dict(cmd) for cmd in data.get("commands", [])]
        chain.dependencies = data.get("dependencies", {})
        chain.execution_order = data.get("execution_order", [])
        chain.estimated_duration = data.get("estimated_duration", 0)
        return chain


@dataclass
class ExecutionUnit:
    """
    最小执行单元

    封装单个命令的执行状态和结果。
    """
    unit_id: str
    command: Command
    state: ExecutionStatus = ExecutionStatus.PENDING
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3

    def start(self) -> None:
        """开始执行"""
        self.state = ExecutionStatus.RUNNING
        self.started_at = datetime.now().isoformat()

    def complete(self, result: Dict[str, Any]) -> None:
        """完成执行"""
        self.state = ExecutionStatus.COMPLETED
        self.result = result
        self.completed_at = datetime.now().isoformat()

    def fail(self, error: str) -> None:
        """执行失败"""
        self.state = ExecutionStatus.FAILED
        self.error = error
        self.completed_at = datetime.now().isoformat()

    def can_retry(self) -> bool:
        """是否可以重试"""
        return self.retry_count < self.max_retries

    def to_dict(self) -> Dict:
        return {
            "unit_id": self.unit_id,
            "command": self.command.to_dict(),
            "state": self.state.value,
            "result": self.result,
            "error": self.error,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "ExecutionUnit":
        return cls(
            unit_id=data["unit_id"],
            command=Command.from_dict(data["command"]),
            state=ExecutionStatus(data["state"]),
            result=data.get("result"),
            error=data.get("error"),
            started_at=data.get("started_at"),
            completed_at=data.get("completed_at"),
            retry_count=data.get("retry_count", 0),
            max_retries=data.get("max_retries", 3),
        )


@dataclass
class RequirementAnalysis:
    """需求分析结果"""
    task_type: str                          # 任务类型
    complexity: int                         # 复杂度 (0-100)
    estimated_steps: int                    # 预估步骤数
    required_agents: List[str]              # 需要的 Agent
    suggested_chain: str                    # 建议的命令链名称
    constraints: List[str] = field(default_factory=list)
    risks: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict) -> "RequirementAnalysis":
        return cls(**data)


@dataclass
class CoordinatorState:
    """协调者状态 (用于持久化)"""
    session_id: str
    created_at: str
    updated_at: str

    # 需求分析
    requirement_analysis: Optional[RequirementAnalysis] = None

    # 命令链
    command_chain: Optional[CommandChain] = None

    # 执行单元
    execution_units: List[ExecutionUnit] = field(default_factory=list)
    current_unit_index: int = 0

    # 状态
    phase: str = "init"  # init | analyzing | planning | executing | completed | failed
    overall_progress: float = 0.0

    # 结果
    final_result: Optional[Dict] = None
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "session_id": self.session_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "requirement_analysis": self.requirement_analysis.to_dict() if self.requirement_analysis else None,
            "command_chain": self.command_chain.to_dict() if self.command_chain else None,
            "execution_units": [unit.to_dict() for unit in self.execution_units],
            "current_unit_index": self.current_unit_index,
            "phase": self.phase,
            "overall_progress": self.overall_progress,
            "final_result": self.final_result,
            "errors": self.errors,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "CoordinatorState":
        state = cls(
            session_id=data["session_id"],
            created_at=data["created_at"],
            updated_at=data["updated_at"],
        )

        if data.get("requirement_analysis"):
            state.requirement_analysis = RequirementAnalysis.from_dict(data["requirement_analysis"])

        if data.get("command_chain"):
            state.command_chain = CommandChain.from_dict(data["command_chain"])

        state.execution_units = [ExecutionUnit.from_dict(u) for u in data.get("execution_units", [])]
        state.current_unit_index = data.get("current_unit_index", 0)
        state.phase = data.get("phase", "init")
        state.overall_progress = data.get("overall_progress", 0.0)
        state.final_result = data.get("final_result")
        state.errors = data.get("errors", [])

        return state


# ============================================================
# 预定义命令链模板
# ============================================================

CHAIN_TEMPLATES: Dict[str, CommandChain] = {
    "novel_creation": CommandChain(
        chain_id="tpl_novel_creation",
        name="完整小说创作",
        description="从构思到完成的完整小说创作流程",
        commands=[
            Command("cmd_1", CommandType.ANALYZE, "需求理解", "理解创作需求", "coordinator"),
            Command("cmd_2", CommandType.PLAN, "世界观构建", "构建小说世界观", "architect"),
            Command("cmd_3", CommandType.PLAN, "角色设计", "设计主要角色", "architect"),
            Command("cmd_4", CommandType.PLAN, "大纲规划", "规划整体大纲", "architect"),
            Command("cmd_5", CommandType.EXECUTE, "章节撰写", "撰写各章节内容", "writer"),
            Command("cmd_6", CommandType.VERIFY, "内容审核", "审核内容质量", "critic"),
            Command("cmd_7", CommandType.REVISE, "修订完善", "根据反馈修订", "writer"),
        ],
        dependencies={
            "cmd_1": [],
            "cmd_2": ["cmd_1"],
            "cmd_3": ["cmd_1"],
            "cmd_4": ["cmd_2", "cmd_3"],
            "cmd_5": ["cmd_4"],
            "cmd_6": ["cmd_5"],
            "cmd_7": ["cmd_6"],
        },
        execution_order=["cmd_1", "cmd_2", "cmd_3", "cmd_4", "cmd_5", "cmd_6", "cmd_7"],
    ),

    "chapter_revision": CommandChain(
        chain_id="tpl_chapter_revision",
        name="章节修订",
        description="对现有章节进行深度修订",
        commands=[
            Command("cmd_1", CommandType.ANALYZE, "问题分析", "分析现有问题", "critic"),
            Command("cmd_2", CommandType.PLAN, "修订计划", "制定修订计划", "architect"),
            Command("cmd_3", CommandType.EXECUTE, "执行修订", "执行修订内容", "writer"),
            Command("cmd_4", CommandType.VERIFY, "质量验证", "验证修订质量", "critic"),
        ],
        dependencies={
            "cmd_1": [],
            "cmd_2": ["cmd_1"],
            "cmd_3": ["cmd_2"],
            "cmd_4": ["cmd_3"],
        },
        execution_order=["cmd_1", "cmd_2", "cmd_3", "cmd_4"],
    ),

    "brainstorm_synthesis": CommandChain(
        chain_id="tpl_brainstorm_synthesis",
        name="头脑风暴综合",
        description="多角度头脑风暴后的综合整理",
        commands=[
            Command("cmd_1", CommandType.ANALYZE, "观点收集", "收集多角度观点", "coordinator"),
            Command("cmd_2", CommandType.ANALYZE, "冲突识别", "识别观点冲突", "devil_advocate"),
            Command("cmd_3", CommandType.PLAN, "综合方案", "制定综合方案", "architect"),
            Command("cmd_4", CommandType.EXECUTE, "方案实施", "实施综合方案", "writer"),
            Command("cmd_5", CommandType.VERIFY, "效果评估", "评估实施效果", "critic"),
        ],
        dependencies={
            "cmd_1": [],
            "cmd_2": ["cmd_1"],
            "cmd_3": ["cmd_2"],
            "cmd_4": ["cmd_3"],
            "cmd_5": ["cmd_4"],
        },
        execution_order=["cmd_1", "cmd_2", "cmd_3", "cmd_4", "cmd_5"],
    ),
}


# ============================================================
# Level5 协调者工作流
# ============================================================

@LevelRegistry.register(5)
class Level5Coordinator(BaseLevel):
    """
    L5 协调者模式

    特点:
    - 智能需求分析
    - 命令链推荐与编排
    - 最小执行单元管理
    - 完整状态持久化
    - 断点续传支持

    命令链:
    analyze_requirements -> recommend_chain -> execute_chain -> persist_state
    """

    level = 5
    name = "coordinator"
    description = "协调者模式 - 智能编排、状态持久化"

    # 持久化目录
    DEFAULT_PERSIST_DIR = ".niko-studio/coordinator"

    def __init__(self, config: Optional[Dict] = None):
        super().__init__(config)
        self.persist_dir = Path(
            self.config.get("persist_dir", self.DEFAULT_PERSIST_DIR)
        )
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self._coordinator_state: Optional[CoordinatorState] = None

    def execute(self, state: BaseState, **kwargs) -> BaseState:
        """
        执行协调者工作流

        流程:
        1. 需求分析 (analyze_requirements)
        2. 命令链推荐 (recommend_chain)
        3. 执行命令链 (execute_chain)
        4. 状态持久化 (persist_state)
        """
        config = self.get_default_config()
        config.update(self.config or {})

        # 检查是否有可恢复的会话
        session_id = state.get("session_id", str(uuid.uuid4()))
        state["session_id"] = session_id
        try:
            SessionManager().init(session_id, session_type="coordinator", domain=state.get("domain", "novel"))
        except Exception as exc:
            state["warnings"] = state.get("warnings", []) + [f"SessionManager 初始化失败: {exc}"]

        resume_state = self._try_resume(session_id)

        if resume_state:
            self._coordinator_state = resume_state
            state["resumed"] = True
        else:
            # 初始化协调者状态
            now = datetime.now().isoformat()
            self._coordinator_state = CoordinatorState(
                session_id=session_id,
                created_at=now,
                updated_at=now,
            )

        try:
            # Phase 1: 需求分析
            if self._coordinator_state.phase in ["init", "analyzing"]:
                self._coordinator_state.phase = "analyzing"
                state = self._analyze_requirements_phase(state)
                self.persist_state(self._coordinator_state)

            # Phase 2: 命令链推荐
            if self._coordinator_state.phase == "analyzing":
                self._coordinator_state.phase = "planning"
                state = self._recommend_chain_phase(state)
                self.persist_state(self._coordinator_state)

            # Phase 3: 执行命令链
            if self._coordinator_state.phase == "planning":
                self._coordinator_state.phase = "executing"
                state = self._execute_chain_phase(state)
                self.persist_state(self._coordinator_state)

            # Phase 4: 完成
            if self._coordinator_state.phase == "executing":
                if self._all_units_completed():
                    self._coordinator_state.phase = "completed"
                    state["decision"] = "APPROVED"
                else:
                    state["decision"] = "HUMAN_REVIEW"
                    state["requires_human_intervention"] = True

            # 更新最终状态
            self._coordinator_state.updated_at = datetime.now().isoformat()
            self.persist_state(self._coordinator_state)

        except Exception as e:
            self._coordinator_state.phase = "failed"
            self._coordinator_state.errors.append(str(e))
            state["errors"] = state.get("errors", []) + [f"协调者执行失败: {e}"]
            state["decision"] = "FAILED"
            self.persist_state(self._coordinator_state)

        return state

    def get_required_agents(self) -> List[str]:
        return ["coordinator", "architect", "writer", "critic"]

    def get_default_config(self) -> Dict:
        return {
            "max_revisions": 10,
            "pass_score": 90,
            "verbose": True,
            "persist_state": True,
            "checkpoint_enabled": True,
            "parallel_execution": True,
            "max_parallel_tasks": 8,
        }

    # ========================================
    # 核心方法
    # ========================================

    def analyze_requirements(self, task: Dict[str, Any]) -> RequirementAnalysis:
        """
        分析需求

        Args:
            task: 任务信息，包含:
                - user_request: 用户请求
                - context: 上下文
                - constraints: 约束条件

        Returns:
            RequirementAnalysis: 需求分析结果
        """
        user_request = task.get("user_request", "")
        context = task.get("context", "")

        # 分析任务类型
        task_type = self._detect_task_type(user_request)

        # 估算复杂度
        complexity = self._estimate_complexity(user_request, context)

        # 确定需要的 Agent
        required_agents = self._determine_required_agents(task_type, complexity)

        # 推荐命令链
        suggested_chain = self._suggest_chain_template(task_type, complexity)

        # 估算步骤数
        estimated_steps = len(CHAIN_TEMPLATES.get(suggested_chain, CHAIN_TEMPLATES["chapter_revision"]).commands)

        # 识别约束和风险
        constraints = self._extract_constraints(user_request)
        risks = self._assess_risks(task_type, complexity)

        return RequirementAnalysis(
            task_type=task_type,
            complexity=complexity,
            estimated_steps=estimated_steps,
            required_agents=required_agents,
            suggested_chain=suggested_chain,
            constraints=constraints,
            risks=risks,
        )

    def recommend_chain(self, requirements: RequirementAnalysis) -> CommandChain:
        """
        推荐命令链

        Args:
            requirements: 需求分析结果

        Returns:
            CommandChain: 推荐的命令链
        """
        template_name = requirements.suggested_chain

        if template_name in CHAIN_TEMPLATES:
            # 复制模板并生成新 ID
            template = CHAIN_TEMPLATES[template_name]
            chain = CommandChain(
                chain_id=f"chain_{uuid.uuid4().hex[:8]}",
                name=template.name,
                description=template.description,
            )

            # 复制命令并更新参数
            for cmd in template.commands:
                new_cmd = Command(
                    command_id=f"cmd_{uuid.uuid4().hex[:8]}",
                    command_type=cmd.command_type,
                    name=cmd.name,
                    description=cmd.description,
                    agent=cmd.agent,
                    parameters=cmd.parameters.copy(),
                )
                chain.commands.append(new_cmd)

            # 重建依赖关系
            id_mapping = {old.command_id: new.command_id
                         for old, new in zip(template.commands, chain.commands)}

            for old_id, deps in template.dependencies.items():
                new_id = id_mapping.get(old_id)
                if new_id:
                    chain.dependencies[new_id] = [id_mapping.get(d, d) for d in deps]

            chain._update_execution_order()
            return chain

        # 默认返回章节修订链
        return self._create_default_chain()

    def execute_chain(self, chain: CommandChain, state: BaseState) -> BaseState:
        """
        执行命令链

        Args:
            chain: 命令链
            state: 工作流状态

        Returns:
            BaseState: 更新后的状态
        """
        # 创建执行单元
        units = []
        for cmd_id in chain.execution_order:
            cmd = chain.get_command(cmd_id)
            if cmd:
                unit = ExecutionUnit(
                    unit_id=f"unit_{uuid.uuid4().hex[:8]}",
                    command=cmd,
                )
                units.append(unit)

        self._coordinator_state.execution_units = units

        # 执行每个单元
        total_units = len(units)
        for i, unit in enumerate(units):
            self._coordinator_state.current_unit_index = i
            self._coordinator_state.overall_progress = (i / total_units) * 100

            # 检查依赖是否完成
            deps = chain.dependencies.get(unit.command.command_id, [])
            deps_completed = self._check_dependencies_completed(deps, units)

            if not deps_completed:
                unit.state = ExecutionStatus.SKIPPED
                state["warnings"] = state.get("warnings", []) + [
                    f"跳过单元 {unit.unit_id}: 依赖未完成"
                ]
                continue

            # 执行单元
            state = self._execute_unit(unit, state)

            # 持久化检查点
            self.persist_state(self._coordinator_state)

            # 失败处理
            if unit.state == ExecutionStatus.FAILED:
                if unit.can_retry():
                    unit.retry_count += 1
                    state = self._execute_unit(unit, state)
                else:
                    state["errors"] = state.get("errors", []) + [
                        f"单元执行失败: {unit.error}"
                    ]

        # 更新进度
        self._coordinator_state.overall_progress = 100.0

        return state

    def persist_state(self, coordinator_state: CoordinatorState) -> str:
        """
        持久化状态到 JSON 文件

        Args:
            coordinator_state: 协调者状态

        Returns:
            str: 状态 ID (session_id)
        """
        file_path = self.persist_dir / f"{coordinator_state.session_id}.json"

        coordinator_state.updated_at = datetime.now().isoformat()
        payload = coordinator_state.to_dict()

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

        try:
            SessionManager().write(
                coordinator_state.session_id,
                ContentType.STATE,
                json.dumps(payload, ensure_ascii=False, indent=2),
            )
        except Exception as exc:
            logger.warning("SessionManager 状态持久化失败: %s", exc)

        return coordinator_state.session_id

    def load_state(self, session_id: str) -> Optional[CoordinatorState]:
        """
        加载持久化状态

        Args:
            session_id: 会话 ID

        Returns:
            CoordinatorState or None
        """
        try:
            payload = SessionManager().read(session_id, ContentType.STATE)
            if payload:
                data = json.loads(payload)
                return CoordinatorState.from_dict(data)
        except Exception as exc:
            logger.warning("SessionManager 状态恢复失败: %s", exc)

        file_path = self.persist_dir / f"{session_id}.json"

        if not file_path.exists():
            return None

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return CoordinatorState.from_dict(data)
        except Exception:
            return None

    # ========================================
    # 内部方法
    # ========================================

    def _analyze_requirements_phase(self, state: BaseState) -> BaseState:
        """需求分析阶段"""
        task = {
            "user_request": state.get("user_request", ""),
            "context": state.get("context", ""),
        }

        analysis = self.analyze_requirements(task)
        self._coordinator_state.requirement_analysis = analysis

        state["requirement_analysis"] = analysis.to_dict()
        return state

    def _recommend_chain_phase(self, state: BaseState) -> BaseState:
        """命令链推荐阶段"""
        if not self._coordinator_state.requirement_analysis:
            state["errors"] = state.get("errors", []) + ["需求分析未完成"]
            return state

        chain = self.recommend_chain(self._coordinator_state.requirement_analysis)
        self._coordinator_state.command_chain = chain

        state["command_chain"] = chain.to_dict()
        return state

    def _execute_chain_phase(self, state: BaseState) -> BaseState:
        """执行命令链阶段"""
        if not self._coordinator_state.command_chain:
            state["errors"] = state.get("errors", []) + ["命令链未生成"]
            return state

        return self.execute_chain(self._coordinator_state.command_chain, state)

    def _execute_unit(self, unit: ExecutionUnit, state: BaseState) -> BaseState:
        """执行单个执行单元"""
        unit.start()

        try:
            # 根据命令类型执行
            cmd = unit.command
            result = {}

            if cmd.command_type == CommandType.ANALYZE:
                result = self._execute_analyze(cmd, state)
            elif cmd.command_type == CommandType.PLAN:
                result = self._execute_plan(cmd, state)
            elif cmd.command_type == CommandType.EXECUTE:
                result = self._execute_write(cmd, state)
            elif cmd.command_type == CommandType.VERIFY:
                result = self._execute_verify(cmd, state)
            elif cmd.command_type == CommandType.REVISE:
                result = self._execute_revise(cmd, state)

            unit.complete(result)

            # 更新状态
            if "content" in result:
                state["draft_content"] = result["content"]
                state["final_output"] = result["content"]
            if "score" in result:
                state["score"] = result["score"]
            if "feedback" in result:
                state["feedback_context"] = result["feedback"]
            if "decision" in result:
                state["decision"] = result["decision"]
            if "plan" in result:
                state["implementation_plan"] = result["plan"]
            if "analysis" in result:
                metadata = state.get("metadata")
                if not isinstance(metadata, dict):
                    metadata = {}
                    state["metadata"] = metadata
                metadata["analysis"] = result["analysis"]

        except Exception as e:
            unit.fail(str(e))
            state["errors"] = state.get("errors", []) + [f"执行单元 {unit.unit_id} 失败: {e}"]

        return state

    def _execute_analyze(self, cmd: Command, state: BaseState) -> Dict:
        """执行分析命令"""
        query = state.get("user_request", "") or cmd.description or cmd.name

        search_results: List[Any] = []
        warnings = state.get("warnings", [])

        # 主检索：SmartSearch
        try:
            smart_search = SmartSearch(db_path=str(Path(".writing") / "vector.db"))
            search_results = smart_search.search(query=query, top_k=5)
        except Exception as exc:
            warnings.append(f"SmartSearch 检索失败: {exc}")
            # 回退检索：VectorSearch
            try:
                vector_search = VectorSearch(db_path=str(Path(".writing") / "vector.db"))
                search_results = vector_search.search(query=query, top_k=5)
            except Exception as fallback_exc:
                warnings.append(f"VectorSearch 回退失败: {fallback_exc}")
                search_results = []

        state["warnings"] = warnings

        # 统一写入 context（尽量可读）
        if search_results:
            lines: List[str] = []
            for idx, item in enumerate(search_results[:5], start=1):
                if hasattr(item, "to_dict"):
                    item_dict = item.to_dict()
                elif isinstance(item, dict):
                    item_dict = item
                else:
                    item_dict = {"content": str(item)}
                snippet = str(item_dict.get("content", ""))[:280]
                lines.append(f"[{idx}] {snippet}")
            state["context"] = "\n".join(lines)

        # 引用生成（失败降级为 warning）
        citation_ids: List[str] = []
        try:
            citation_manager = get_citation_manager()
            for item in search_results[:5]:
                transient = citation_manager.create_transient_citation(source=item)
                persisted = citation_manager.persist_citation(transient.citation_id)
                if persisted:
                    citation_ids.append(persisted.citation_id)
        except Exception as exc:
            state["warnings"] = state.get("warnings", []) + [f"Citation 处理失败: {exc}"]

        metadata = state.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}
            state["metadata"] = metadata
        if citation_ids:
            metadata["citations"] = citation_ids

        return {"analysis": search_results, "status": "completed"}

    def _execute_plan(self, cmd: Command, state: BaseState) -> Dict:
        """执行规划命令"""
        planner_state = dict(state)
        try:
            planner = Level3Standard(config=self.config)
            planner_state = planner._plan_phase(planner_state)
            plan = planner_state.get("implementation_plan", {})
        except Exception as exc:
            state["warnings"] = state.get("warnings", []) + [f"L3 规划阶段失败: {exc}"]
            plan = {}

        state["implementation_plan"] = plan
        return {"plan": plan, "status": "completed"}

    def _select_execution_branch(self, cmd: Command) -> str:
        """选择执行分支：standard | brainstorm | lite"""
        workflow_branch = str(cmd.parameters.get("workflow_branch", "")).strip().lower()
        if workflow_branch == "lite":
            return "lite"
        if workflow_branch == "brainstorm":
            return "brainstorm"

        requirement = self._coordinator_state.requirement_analysis if self._coordinator_state else None
        if requirement and requirement.task_type == "brainstorm_synthesis":
            return "brainstorm"

        return "standard"

    def _execute_write(self, cmd: Command, state: BaseState) -> Dict:
        """执行写作命令"""
        branch = self._select_execution_branch(cmd)
        next_state = dict(state)

        if branch == "lite":
            try:
                lite = Level2Lite(config=self.config)
                next_state = lite._execute_lite(next_state)
            except Exception as exc:
                state["warnings"] = state.get("warnings", []) + [f"L2 执行失败: {exc}"]
        elif branch == "brainstorm":
            try:
                brainstorm = Level4Brainstorm(config=self.config)
                next_state = brainstorm.execute(next_state)
            except Exception as exc:
                state["warnings"] = state.get("warnings", []) + [f"L4 执行失败: {exc}"]
        else:
            try:
                standard = Level3Standard(config=self.config)
                next_state = standard._execute_phase(next_state)
            except Exception as exc:
                state["warnings"] = state.get("warnings", []) + [f"L3 执行失败: {exc}"]

        content = (
            next_state.get("draft_content")
            or next_state.get("final_output")
            or state.get("draft_content", "")
        )

        # 蒸馏 + 记忆（失败降级）
        if content:
            try:
                distill_mgr = DistillationManager()
                distill_result = distill_mgr.distill([content], DistillationTemplate.SUMMARY)
                distill_result = {"entities": [], "relations": [], "content": distill_result.content}
                state["distillation_result"] = distill_result
            except Exception as exc:
                state["warnings"] = state.get("warnings", []) + [f"Distill 失败: {exc}"]

            try:
                get_memory_manager().add(
                    content=content[:2000],
                    source="coordinator",
                    topics=["coordinator", "l5"],
                    metadata={"command_id": cmd.command_id, "phase": cmd.command_type.value},
                )
            except Exception as exc:
                state["warnings"] = state.get("warnings", []) + [f"Memory 写入失败: {exc}"]

        return {"content": content, "status": "completed"}

    def _execute_verify(self, cmd: Command, state: BaseState) -> Dict:
        """执行验证命令"""
        branch = self._select_execution_branch(cmd)
        next_state = dict(state)

        if branch == "lite":
            try:
                lite = Level2Lite(config=self.config)
                next_state = lite._verify_lite(next_state)
            except Exception as exc:
                state["warnings"] = state.get("warnings", []) + [f"L2 验证失败: {exc}"]
        else:
            try:
                standard = Level3Standard(config=self.config)
                next_state = standard._critic_phase(next_state)
            except Exception as exc:
                state["warnings"] = state.get("warnings", []) + [f"L3 验证失败: {exc}"]

        score = float(next_state.get("score", state.get("score", 0.0)))
        feedback = str(next_state.get("feedback_context", ""))
        decision = str(next_state.get("decision", "REVISE"))

        metadata = state.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}
            state["metadata"] = metadata
        citations = metadata.get("citations", []) if isinstance(metadata.get("citations"), list) else []
        if citations:
            feedback = (feedback + "\n\n引用摘要: " + ", ".join(citations[:5])).strip()

        return {
            "score": score,
            "feedback": feedback,
            "decision": decision,
            "status": "completed",
        }

    def _execute_revise(self, cmd: Command, state: BaseState) -> Dict:
        """执行修订命令"""
        revise_state = dict(state)
        revise_state["context"] = (
            (revise_state.get("context") or "")
            + "\n\n[REVISION_FEEDBACK]\n"
            + str(revise_state.get("feedback_context", ""))
        ).strip()

        result = self._execute_write(cmd, revise_state)
        return {"content": result.get("content", ""), "status": "completed"}

    def _try_resume(self, session_id: str) -> Optional[CoordinatorState]:
        """尝试恢复会话"""
        state = self.load_state(session_id)
        if state and state.phase not in ["completed", "failed"]:
            return state
        return None

    def _all_units_completed(self) -> bool:
        """检查所有单元是否完成"""
        for unit in self._coordinator_state.execution_units:
            if unit.state not in [ExecutionStatus.COMPLETED, ExecutionStatus.SKIPPED]:
                return False
        return True

    def _check_dependencies_completed(self, dep_ids: List[str], units: List[ExecutionUnit]) -> bool:
        """检查依赖是否完成"""
        for unit in units:
            if unit.command.command_id in dep_ids:
                if unit.state != ExecutionStatus.COMPLETED:
                    return False
        return True

    def _detect_task_type(self, text: str) -> str:
        """检测任务类型"""
        text_lower = text.lower()

        if any(kw in text_lower for kw in ["小说", "创作", "写作", "长篇"]):
            return "novel_creation"
        elif any(kw in text_lower for kw in ["修订", "修改", "改写", "重写"]):
            return "chapter_revision"
        elif any(kw in text_lower for kw in ["头脑风暴", "讨论", "多角度"]):
            return "brainstorm_synthesis"
        else:
            return "chapter_revision"

    def _estimate_complexity(self, request: str, context: str) -> int:
        """估算复杂度"""
        complexity = 60  # L5 基准

        # 文本长度
        total_len = len(request) + len(context)
        if total_len > 2000:
            complexity += 20
        elif total_len > 500:
            complexity += 10

        # 关键词
        complex_kws = ["完整", "详细", "深入", "全面", "系统", "多章节"]
        for kw in complex_kws:
            if kw in request:
                complexity += 5

        return min(100, complexity)

    def _determine_required_agents(self, task_type: str, complexity: int) -> List[str]:
        """确定需要的 Agent"""
        base_agents = ["coordinator", "architect", "writer", "critic"]

        if complexity > 80:
            base_agents.extend(["researcher", "devil_advocate"])

        if task_type == "brainstorm_synthesis":
            base_agents.extend(["optimist", "realist"])

        return list(set(base_agents))

    def _suggest_chain_template(self, task_type: str, complexity: int) -> str:
        """建议命令链模板"""
        if task_type in CHAIN_TEMPLATES:
            return task_type
        return "chapter_revision"

    def _extract_constraints(self, text: str) -> List[str]:
        """提取约束条件"""
        constraints = []

        constraint_patterns = [
            ("字数", "字数限制"),
            ("不要", "排除条件"),
            ("必须", "必要条件"),
            ("风格", "风格约束"),
        ]

        for pattern, label in constraint_patterns:
            if pattern in text:
                constraints.append(label)

        return constraints

    def _assess_risks(self, task_type: str, complexity: int) -> List[str]:
        """评估风险"""
        risks = []

        if complexity > 85:
            risks.append("高复杂度任务可能需要多次迭代")

        if task_type == "novel_creation":
            risks.append("长篇创作需要保持一致性")

        return risks

    def _create_default_chain(self) -> CommandChain:
        """创建默认命令链"""
        return CommandChain(
            chain_id=f"chain_{uuid.uuid4().hex[:8]}",
            name="默认执行链",
            description="基本执行流程",
            commands=[
                Command(f"cmd_{uuid.uuid4().hex[:8]}", CommandType.ANALYZE, "分析", "分析任务", "coordinator"),
                Command(f"cmd_{uuid.uuid4().hex[:8]}", CommandType.EXECUTE, "执行", "执行任务", "writer"),
                Command(f"cmd_{uuid.uuid4().hex[:8]}", CommandType.VERIFY, "验证", "验证结果", "critic"),
            ],
        )
