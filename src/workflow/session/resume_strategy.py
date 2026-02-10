"""
断点续传策略 (Resume Strategy)

实现三种断点续传模式:
- NATIVE: 原生会话恢复 (使用 CLI --resume 参数)
- PROMPT_CONCAT: 提示词拼接 (历史上下文拼接到新提示)
- HYBRID: 混合模式 (优先 native，失败回退 concat)

移植自 Claude-Code-Workflow (CCW)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional, List, Callable, Dict, Any
import json
import logging

logger = logging.getLogger(__name__)


# ============================================================
# 枚举定义
# ============================================================

class ResumeMode(Enum):
    """断点续传模式"""
    NATIVE = "native"              # 原生会话恢复
    PROMPT_CONCAT = "prompt-concat"  # 提示词拼接
    HYBRID = "hybrid"              # 混合模式
    DISABLED = "disabled"          # 禁用续传


class ContextFormat(Enum):
    """上下文格式"""
    PLAIN = "plain"    # 纯文本
    YAML = "yaml"      # YAML 格式
    JSON = "json"      # JSON 格式


# ============================================================
# 数据类定义
# ============================================================

@dataclass
class ConversationTurn:
    """对话轮次"""
    role: str                          # user | assistant | system
    content: str
    timestamp: Optional[datetime] = None
    tool_calls: Optional[List[Dict]] = None
    metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "tool_calls": self.tool_calls,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ConversationTurn":
        """从字典创建"""
        ts = data.get("timestamp")
        return cls(
            role=data["role"],
            content=data["content"],
            timestamp=datetime.fromisoformat(ts) if ts else None,
            tool_calls=data.get("tool_calls"),
            metadata=data.get("metadata"),
        )


@dataclass
class SessionContext:
    """会话上下文 - 断点续传时恢复的完整上下文"""
    session_id: str
    history: List[ConversationTurn] = field(default_factory=list)
    last_state: Optional[Dict[str, Any]] = None
    resumed_at: Optional[datetime] = None
    resume_mode: ResumeMode = ResumeMode.NATIVE
    checkpoint_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "session_id": self.session_id,
            "history": [t.to_dict() for t in self.history],
            "last_state": self.last_state,
            "resumed_at": self.resumed_at.isoformat() if self.resumed_at else None,
            "resume_mode": self.resume_mode.value,
            "checkpoint_id": self.checkpoint_id,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "SessionContext":
        """从字典创建"""
        resumed = data.get("resumed_at")
        return cls(
            session_id=data["session_id"],
            history=[ConversationTurn.from_dict(t) for t in data.get("history", [])],
            last_state=data.get("last_state"),
            resumed_at=datetime.fromisoformat(resumed) if resumed else None,
            resume_mode=ResumeMode(data.get("resume_mode", "native")),
            checkpoint_id=data.get("checkpoint_id"),
            metadata=data.get("metadata"),
        )


@dataclass
class ResumeDecision:
    """续传决策结果"""
    strategy: ResumeMode
    native_session_id: Optional[str] = None
    is_latest: bool = True
    context_turns: Optional[List[ConversationTurn]] = None
    primary_conversation_id: Optional[str] = None
    context_format: ContextFormat = ContextFormat.YAML
    fallback_strategy: Optional[ResumeMode] = None
    reason: Optional[str] = None


@dataclass
class CheckpointState:
    """检查点状态"""
    checkpoint_id: str
    session_id: str
    created_at: datetime
    workflow_step: str
    state_data: Dict[str, Any]
    history_snapshot: List[ConversationTurn]

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "checkpoint_id": self.checkpoint_id,
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat(),
            "workflow_step": self.workflow_step,
            "state_data": self.state_data,
            "history_snapshot": [t.to_dict() for t in self.history_snapshot],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "CheckpointState":
        """从字典创建"""
        return cls(
            checkpoint_id=data["checkpoint_id"],
            session_id=data["session_id"],
            created_at=datetime.fromisoformat(data["created_at"]),
            workflow_step=data["workflow_step"],
            state_data=data["state_data"],
            history_snapshot=[
                ConversationTurn.from_dict(t)
                for t in data.get("history_snapshot", [])
            ],
        )


# ============================================================
# 抽象基类
# ============================================================

class ResumeStrategy(ABC):
    """
    断点续传策略抽象基类

    所有具体策略必须实现:
    - can_resume: 检查是否可以续传
    - resume: 执行续传，返回会话上下文
    - save_checkpoint: 保存检查点
    """

    def __init__(self, base_path: Path = Path(".writing/sessions")):
        self.base_path = Path(base_path)
        self.checkpoints_path = self.base_path / ".checkpoints"
        self.checkpoints_path.mkdir(parents=True, exist_ok=True)

    @abstractmethod
    def can_resume(self, session_id: str) -> bool:
        """
        检查指定会话是否可以续传

        Args:
            session_id: 会话 ID

        Returns:
            是否可以续传
        """
        pass

    @abstractmethod
    def resume(self, session_id: str) -> SessionContext:
        """
        执行续传，恢复会话上下文

        Args:
            session_id: 会话 ID

        Returns:
            恢复的会话上下文
        """
        pass

    @abstractmethod
    def save_checkpoint(self, session_id: str, state: Dict[str, Any]) -> str:
        """
        保存检查点

        Args:
            session_id: 会话 ID
            state: 当前状态

        Returns:
            检查点 ID
        """
        pass

    def get_checkpoint_path(self, session_id: str) -> Path:
        """获取检查点文件路径"""
        return self.checkpoints_path / f"{session_id}.json"

    def list_checkpoints(self, session_id: str) -> List[CheckpointState]:
        """列出会话的所有检查点"""
        checkpoint_file = self.get_checkpoint_path(session_id)
        if not checkpoint_file.exists():
            return []

        try:
            data = json.loads(checkpoint_file.read_text(encoding="utf-8"))
            checkpoints = data.get("checkpoints", [])
            return [CheckpointState.from_dict(cp) for cp in checkpoints]
        except Exception as e:
            logger.warning(f"Failed to load checkpoints for {session_id}: {e}")
            return []

    def get_latest_checkpoint(self, session_id: str) -> Optional[CheckpointState]:
        """获取最新检查点"""
        checkpoints = self.list_checkpoints(session_id)
        if not checkpoints:
            return None
        # 检查点按写入顺序保存，直接取最后一个可避免同时间戳并列导致的误判
        return checkpoints[-1]


# ============================================================
# 具体策略实现
# ============================================================

class NativeResumeStrategy(ResumeStrategy):
    """
    原生会话恢复策略

    使用 CLI 的 --resume 参数直接恢复会话，
    适用于支持原生续传的工具 (Claude, Gemini)
    """

    # 支持原生续传的工具列表
    NATIVE_SUPPORTED_TOOLS = {"claude", "gemini", "codex"}

    def __init__(
        self,
        base_path: Path = Path(".writing/sessions"),
        tool: str = "gemini"
    ):
        super().__init__(base_path)
        self.tool = tool
        self.session_mapping: Dict[str, str] = {}  # session_id -> native_id
        self._load_mapping()

    def _load_mapping(self):
        """加载会话 ID 映射"""
        mapping_file = self.base_path / ".native_mapping.json"
        if mapping_file.exists():
            try:
                self.session_mapping = json.loads(
                    mapping_file.read_text(encoding="utf-8")
                )
            except Exception as e:
                logger.warning(f"Failed to load native mapping: {e}")

    def _save_mapping(self):
        """保存会话 ID 映射"""
        mapping_file = self.base_path / ".native_mapping.json"
        mapping_file.parent.mkdir(parents=True, exist_ok=True)
        mapping_file.write_text(
            json.dumps(self.session_mapping, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

    def register_native_session(self, session_id: str, native_id: str):
        """注册原生会话 ID 映射"""
        self.session_mapping[session_id] = native_id
        self._save_mapping()

    def get_native_session_id(self, session_id: str) -> Optional[str]:
        """获取原生会话 ID"""
        return self.session_mapping.get(session_id)

    def supports_native(self) -> bool:
        """检查当前工具是否支持原生续传"""
        return self.tool.lower() in self.NATIVE_SUPPORTED_TOOLS

    def can_resume(self, session_id: str) -> bool:
        """检查是否可以使用原生续传"""
        if not self.supports_native():
            return False

        native_id = self.get_native_session_id(session_id)
        if not native_id:
            return False

        # 检查检查点是否存在
        checkpoint = self.get_latest_checkpoint(session_id)
        return checkpoint is not None

    def resume(self, session_id: str) -> SessionContext:
        """执行原生续传"""
        if not self.can_resume(session_id):
            raise ValueError(f"Cannot resume session {session_id} with native strategy")

        checkpoint = self.get_latest_checkpoint(session_id)
        native_id = self.get_native_session_id(session_id)

        return SessionContext(
            session_id=session_id,
            history=checkpoint.history_snapshot if checkpoint else [],
            last_state=checkpoint.state_data if checkpoint else None,
            resumed_at=datetime.now(),
            resume_mode=ResumeMode.NATIVE,
            checkpoint_id=checkpoint.checkpoint_id if checkpoint else None,
            metadata={
                "native_session_id": native_id,
                "tool": self.tool,
                "resume_command": f"--resume {native_id}",
            },
        )

    def save_checkpoint(self, session_id: str, state: Dict[str, Any]) -> str:
        """保存检查点"""
        checkpoint_id = f"cp-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

        checkpoint = CheckpointState(
            checkpoint_id=checkpoint_id,
            session_id=session_id,
            created_at=datetime.now(),
            workflow_step=state.get("current_step", "unknown"),
            state_data=state,
            history_snapshot=state.get("history", []),
        )

        # 加载现有检查点
        checkpoint_file = self.get_checkpoint_path(session_id)
        existing = {"checkpoints": []}
        if checkpoint_file.exists():
            try:
                existing = json.loads(checkpoint_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        # 添加新检查点
        existing["checkpoints"].append(checkpoint.to_dict())

        # 只保留最近 10 个检查点
        existing["checkpoints"] = existing["checkpoints"][-10:]

        # 保存
        checkpoint_file.write_text(
            json.dumps(existing, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

        return checkpoint_id


class PromptConcatStrategy(ResumeStrategy):
    """
    提示词拼接策略

    将历史对话拼接到新提示的前缀，
    适用于不支持原生续传的场景或跨工具续传
    """

    def __init__(
        self,
        base_path: Path = Path(".writing/sessions"),
        default_format: ContextFormat = ContextFormat.YAML,
        max_history_turns: int = 20,
    ):
        super().__init__(base_path)
        self.default_format = default_format
        self.max_history_turns = max_history_turns

    def can_resume(self, session_id: str) -> bool:
        """检查是否可以使用 prompt-concat 续传"""
        checkpoint = self.get_latest_checkpoint(session_id)
        return checkpoint is not None

    def resume(self, session_id: str) -> SessionContext:
        """执行 prompt-concat 续传"""
        checkpoint = self.get_latest_checkpoint(session_id)
        if not checkpoint:
            raise ValueError(f"No checkpoint found for session {session_id}")

        # 限制历史轮次
        history = checkpoint.history_snapshot[-self.max_history_turns:]

        return SessionContext(
            session_id=session_id,
            history=history,
            last_state=checkpoint.state_data,
            resumed_at=datetime.now(),
            resume_mode=ResumeMode.PROMPT_CONCAT,
            checkpoint_id=checkpoint.checkpoint_id,
            metadata={
                "format": self.default_format.value,
                "history_count": len(history),
                "truncated": len(checkpoint.history_snapshot) > self.max_history_turns,
            },
        )

    def save_checkpoint(self, session_id: str, state: Dict[str, Any]) -> str:
        """保存检查点"""
        checkpoint_id = f"cp-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

        # 从 state 中提取历史
        history_data = state.get("history", [])
        history = []
        for item in history_data:
            if isinstance(item, ConversationTurn):
                history.append(item)
            elif isinstance(item, dict):
                history.append(ConversationTurn.from_dict(item))

        checkpoint = CheckpointState(
            checkpoint_id=checkpoint_id,
            session_id=session_id,
            created_at=datetime.now(),
            workflow_step=state.get("current_step", "unknown"),
            state_data=state,
            history_snapshot=history,
        )

        # 加载并更新检查点文件
        checkpoint_file = self.get_checkpoint_path(session_id)
        existing = {"checkpoints": []}
        if checkpoint_file.exists():
            try:
                existing = json.loads(checkpoint_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        existing["checkpoints"].append(checkpoint.to_dict())
        existing["checkpoints"] = existing["checkpoints"][-10:]

        checkpoint_file.write_text(
            json.dumps(existing, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

        return checkpoint_id

    def build_context_prefix(
        self,
        context: SessionContext,
        format: Optional[ContextFormat] = None,
    ) -> str:
        """
        构建上下文前缀

        Args:
            context: 会话上下文
            format: 输出格式 (默认使用策略配置)

        Returns:
            格式化的上下文前缀字符串
        """
        fmt = format or self.default_format

        if fmt == ContextFormat.PLAIN:
            return self._build_plain_prefix(context)
        elif fmt == ContextFormat.YAML:
            return self._build_yaml_prefix(context)
        else:
            return self._build_json_prefix(context)

    def _build_plain_prefix(self, context: SessionContext) -> str:
        """构建纯文本格式前缀"""
        lines = ["=== PREVIOUS CONVERSATION ===\n"]

        for turn in context.history:
            role_label = turn.role.upper()
            lines.append(f"[{role_label}]:")
            lines.append(turn.content)
            lines.append("")

        lines.append("=== CONTINUATION ===\n")
        return "\n".join(lines)

    def _build_yaml_prefix(self, context: SessionContext) -> str:
        """构建 YAML 格式前缀"""
        import yaml

        history_data = []
        for turn in context.history:
            entry = {"role": turn.role, "content": turn.content}
            if turn.timestamp:
                entry["timestamp"] = turn.timestamp.isoformat()
            history_data.append(entry)

        prefix_data = {
            "previous_conversation": {
                "session_id": context.session_id,
                "resumed_from": context.checkpoint_id,
                "turns": history_data,
            }
        }

        yaml_str = yaml.dump(
            prefix_data,
            allow_unicode=True,
            default_flow_style=False,
            sort_keys=False
        )

        return f"---\n{yaml_str}---\n\n"

    def _build_json_prefix(self, context: SessionContext) -> str:
        """构建 JSON 格式前缀"""
        history_data = []
        for turn in context.history:
            entry = {"role": turn.role, "content": turn.content}
            if turn.timestamp:
                entry["timestamp"] = turn.timestamp.isoformat()
            history_data.append(entry)

        prefix_data = {
            "previous_conversation": {
                "session_id": context.session_id,
                "resumed_from": context.checkpoint_id,
                "turns": history_data,
            }
        }

        json_str = json.dumps(prefix_data, ensure_ascii=False, indent=2)
        return f"```json\n{json_str}\n```\n\n"


class HybridStrategy(ResumeStrategy):
    """
    混合续传策略

    优先使用原生续传，失败时自动回退到 prompt-concat
    支持多会话合并场景
    """

    def __init__(
        self,
        base_path: Path = Path(".writing/sessions"),
        tool: str = "gemini",
        fallback_format: ContextFormat = ContextFormat.YAML,
    ):
        super().__init__(base_path)
        self.tool = tool
        self.fallback_format = fallback_format

        # 初始化子策略
        self.native_strategy = NativeResumeStrategy(base_path, tool)
        self.concat_strategy = PromptConcatStrategy(
            base_path,
            default_format=fallback_format
        )

    def can_resume(self, session_id: str) -> bool:
        """检查是否可以续传 (native 或 concat)"""
        return (
            self.native_strategy.can_resume(session_id) or
            self.concat_strategy.can_resume(session_id)
        )

    def resume(self, session_id: str) -> SessionContext:
        """
        执行混合续传

        优先尝试 native，失败回退 concat
        """
        # 优先尝试 native
        if self.native_strategy.can_resume(session_id):
            try:
                context = self.native_strategy.resume(session_id)
                logger.info(f"Resumed session {session_id} with native strategy")
                return context
            except Exception as e:
                logger.warning(
                    f"Native resume failed for {session_id}, falling back to concat: {e}"
                )

        # 回退到 concat
        if self.concat_strategy.can_resume(session_id):
            context = self.concat_strategy.resume(session_id)
            context.metadata = context.metadata or {}
            context.metadata["fallback_used"] = True
            context.metadata["original_mode"] = ResumeMode.NATIVE.value
            logger.info(f"Resumed session {session_id} with concat fallback")
            return context

        raise ValueError(f"Cannot resume session {session_id} with any strategy")

    def save_checkpoint(self, session_id: str, state: Dict[str, Any]) -> str:
        """保存检查点 (同时保存到两个策略)"""
        # 使用 concat 策略保存 (更通用)
        return self.concat_strategy.save_checkpoint(session_id, state)

    def merge_sessions(
        self,
        session_ids: List[str],
        target_session_id: Optional[str] = None,
    ) -> SessionContext:
        """
        合并多个会话的上下文

        Args:
            session_ids: 要合并的会话 ID 列表
            target_session_id: 目标会话 ID (可选)

        Returns:
            合并后的会话上下文
        """
        if not session_ids:
            raise ValueError("No sessions to merge")

        merged_history: List[ConversationTurn] = []
        merged_state: Dict[str, Any] = {}

        for sid in session_ids:
            checkpoint = self.get_latest_checkpoint(sid)
            if checkpoint:
                merged_history.extend(checkpoint.history_snapshot)
                merged_state.update(checkpoint.state_data)

        # 按时间排序
        merged_history.sort(
            key=lambda x: x.timestamp or datetime.min
        )

        target_id = target_session_id or f"merged-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

        return SessionContext(
            session_id=target_id,
            history=merged_history,
            last_state=merged_state,
            resumed_at=datetime.now(),
            resume_mode=ResumeMode.HYBRID,
            metadata={
                "merged_from": session_ids,
                "merge_count": len(session_ids),
            },
        )


class PromptConcatResumeStrategy(PromptConcatStrategy):
    """兼容旧命名：PromptConcatResumeStrategy。"""
    pass


class HybridResumeStrategy(HybridStrategy):
    """兼容旧命名：HybridResumeStrategy。"""
    pass


# ============================================================
# 策略决定器
# ============================================================

class ResumeStrategyResolver:
    """
    断点续传策略解析器

    根据场景自动决定最优续传策略
    """

    def __init__(self, base_path: Path = Path(".writing/sessions")):
        self.base_path = Path(base_path)

    def determine_strategy(
        self,
        tool: str,
        resume_ids: List[str],
        custom_id: Optional[str] = None,
        get_native_session_id: Optional[Callable[[str], Optional[str]]] = None,
        get_conversation_tool: Optional[Callable[[str], Optional[str]]] = None,
    ) -> ResumeDecision:
        """
        决定最优续传策略

        场景类型:
        - 单追加: resume_ids=[id], 继续同一会话 -> native
        - Fork: 从某点分叉 (提供 custom_id) -> prompt-concat
        - 多合并: resume_ids=[id1, id2] -> hybrid
        - 跨工具: 从 Claude 切换到 Gemini -> prompt-concat

        Args:
            tool: 当前使用的工具
            resume_ids: 要恢复的会话 ID 列表
            custom_id: 自定义新会话 ID (Fork 场景)
            get_native_session_id: 获取原生会话 ID 的回调
            get_conversation_tool: 获取会话原始工具的回调

        Returns:
            续传决策
        """
        if not resume_ids:
            return ResumeDecision(
                strategy=ResumeMode.DISABLED,
                reason="No resume IDs provided",
            )

        # 检查工具是否支持原生续传
        supports_native = tool.lower() in NativeResumeStrategy.NATIVE_SUPPORTED_TOOLS

        # 场景 1: 单追加 (无 custom_id)
        if len(resume_ids) == 1 and not custom_id:
            session_id = resume_ids[0]

            # 检查是否跨工具
            if get_conversation_tool:
                original_tool = get_conversation_tool(session_id)
                if original_tool and original_tool.lower() != tool.lower():
                    return ResumeDecision(
                        strategy=ResumeMode.PROMPT_CONCAT,
                        context_format=ContextFormat.YAML,
                        reason=f"Cross-tool resume: {original_tool} -> {tool}",
                    )

            # 检查原生续传
            if supports_native:
                native_id = None
                if get_native_session_id:
                    native_id = get_native_session_id(session_id)

                if native_id:
                    return ResumeDecision(
                        strategy=ResumeMode.NATIVE,
                        native_session_id=native_id,
                        is_latest=True,
                        reason="Single session append with native support",
                    )

            # 回退到 prompt-concat
            return ResumeDecision(
                strategy=ResumeMode.PROMPT_CONCAT,
                context_format=ContextFormat.YAML,
                fallback_strategy=ResumeMode.NATIVE if supports_native else None,
                reason="Native ID not found, using prompt-concat",
            )

        # 场景 2: Fork (提供 custom_id)
        if custom_id:
            return ResumeDecision(
                strategy=ResumeMode.PROMPT_CONCAT,
                primary_conversation_id=resume_ids[0],
                context_format=ContextFormat.YAML,
                reason=f"Fork scenario: creating new session {custom_id}",
            )

        # 场景 3: 多会话合并
        if len(resume_ids) > 1:
            return ResumeDecision(
                strategy=ResumeMode.HYBRID,
                primary_conversation_id=resume_ids[0],
                context_format=ContextFormat.YAML,
                reason=f"Multi-session merge: {len(resume_ids)} sessions",
            )

        # 默认
        return ResumeDecision(
            strategy=ResumeMode.PROMPT_CONCAT,
            context_format=ContextFormat.YAML,
            reason="Default fallback",
        )


# ============================================================
# 便捷函数
# ============================================================

def determine_resume_strategy(
    tool: str,
    resume_ids: List[str],
    custom_id: Optional[str] = None,
    get_native_session_id: Optional[Callable[[str], Optional[str]]] = None,
    get_conversation_tool: Optional[Callable[[str], Optional[str]]] = None,
) -> ResumeDecision:
    """
    决定最优恢复策略 (便捷函数)

    Args:
        tool: 当前工具
        resume_ids: 要恢复的会话 ID
        custom_id: 自定义新会话 ID
        get_native_session_id: 获取原生会话 ID 的回调
        get_conversation_tool: 获取会话原始工具的回调

    Returns:
        ResumeDecision 决策结果
    """
    resolver = ResumeStrategyResolver()
    return resolver.determine_strategy(
        tool=tool,
        resume_ids=resume_ids,
        custom_id=custom_id,
        get_native_session_id=get_native_session_id,
        get_conversation_tool=get_conversation_tool,
    )


def build_context_prefix(
    context_turns: List[ConversationTurn],
    format: str = "yaml",
) -> str:
    """
    构建上下文前缀 (便捷函数)

    Args:
        context_turns: 对话历史
        format: 输出格式 (plain | yaml | json)

    Returns:
        格式化的上下文前缀字符串
    """
    fmt = ContextFormat(format)
    strategy = PromptConcatStrategy(default_format=fmt)

    context = SessionContext(
        session_id="temp",
        history=context_turns,
        resumed_at=datetime.now(),
    )

    return strategy.build_context_prefix(context, fmt)


def create_strategy(
    mode: ResumeMode,
    base_path: Path = Path(".writing/sessions"),
    tool: str = "gemini",
    **kwargs,
) -> ResumeStrategy:
    """
    创建续传策略实例 (工厂函数)

    Args:
        mode: 续传模式
        base_path: 基础路径
        tool: 工具名称
        **kwargs: 额外参数

    Returns:
        ResumeStrategy 实例
    """
    if mode == ResumeMode.NATIVE:
        return NativeResumeStrategy(base_path, tool)
    elif mode == ResumeMode.PROMPT_CONCAT:
        return PromptConcatStrategy(
            base_path,
            default_format=kwargs.get("format", ContextFormat.YAML),
            max_history_turns=kwargs.get("max_history_turns", 20),
        )
    elif mode == ResumeMode.HYBRID:
        return HybridStrategy(base_path, tool)
    else:
        raise ValueError(f"Unsupported resume mode: {mode}")


# ============================================================
# 模块导出
# ============================================================

__all__ = [
    # 枚举
    "ResumeMode",
    "ContextFormat",
    # 数据类
    "ConversationTurn",
    "SessionContext",
    "ResumeDecision",
    "CheckpointState",
    # 抽象基类
    "ResumeStrategy",
    # 具体策略
    "NativeResumeStrategy",
    "PromptConcatStrategy",
    "HybridStrategy",
    # 策略解析器
    "ResumeStrategyResolver",
    # 便捷函数
    "determine_resume_strategy",
    "build_context_prefix",
    "create_strategy",
]
