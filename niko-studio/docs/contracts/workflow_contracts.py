"""
Workflow 模块接口契约

定义 Workflow、Session 两个核心服务的接口规范。
"""

from typing import Protocol, List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


# ============================================================
# 数据类型定义
# ============================================================

class WorkflowLevel(Enum):
    """工作流层级"""
    L1_QUICK = "L1"      # 快速响应
    L2_LITE = "L2"       # 轻量处理
    L3_STANDARD = "L3"   # 标准流程
    L4_BRAINSTORM = "L4" # 头脑风暴
    L5_COORDINATOR = "L5" # 协调器


class TaskStatus(Enum):
    """任务状态"""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ResumeStrategy(Enum):
    """断点续传策略"""
    CONTINUE = "continue"      # 继续执行
    RESTART = "restart"        # 重新开始
    SKIP_FAILED = "skip_failed" # 跳过失败步骤


@dataclass
class Task:
    """任务结构"""
    id: str
    title: str
    description: str
    status: TaskStatus = TaskStatus.PENDING
    level: Optional[WorkflowLevel] = None
    priority: int = 0  # 0-10, 10 最高
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class Result:
    """执行结果"""
    success: bool
    output: Any
    error: Optional[str] = None
    duration_ms: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Content:
    """会话内容"""
    type: str  # "message" | "artifact" | "state"
    data: Any
    timestamp: Optional[datetime] = None


@dataclass
class Session:
    """会话结构"""
    id: str
    status: str  # "active" | "paused" | "archived"
    contents: List[Content] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    checkpoint: Optional[str] = None  # 断点位置


@dataclass
class WorkflowState:
    """工作流状态"""
    current_level: WorkflowLevel
    current_step: int
    total_steps: int
    context: Dict[str, Any] = field(default_factory=dict)


# ============================================================
# 接口定义
# ============================================================

class IWorkflowService(Protocol):
    """
    工作流服务接口
    
    负责任务路由和执行。
    支持 L1-L5 五级工作流，L1/L2 手动选择，L3-L5 动态路由。
    
    Usage:
        level = workflow_service.route_to_level(task)
        result = workflow_service.execute_level(level, task)
    """
    
    def route_to_level(self, task: Task) -> WorkflowLevel:
        """
        路由任务到合适的工作流层级
        
        根据任务复杂度、优先级等因素决定执行层级。
        L1/L2 可手动指定，L3-L5 动态路由。
        
        Args:
            task: 任务对象
            
        Returns:
            工作流层级
        """
        ...
    
    def execute_level(self, level: WorkflowLevel, task: Task) -> Result:
        """
        执行指定层级的工作流
        
        Args:
            level: 工作流层级
            task: 任务对象
            
        Returns:
            执行结果
        """
        ...
    
    def get_state(self, task_id: str) -> Optional[WorkflowState]:
        """
        获取工作流状态
        
        Args:
            task_id: 任务 ID
            
        Returns:
            工作流状态，不存在返回 None
        """
        ...
    
    def pause(self, task_id: str) -> bool:
        """
        暂停工作流
        
        Args:
            task_id: 任务 ID
            
        Returns:
            是否暂停成功
        """
        ...
    
    def resume(
        self, 
        task_id: str, 
        strategy: ResumeStrategy = ResumeStrategy.CONTINUE
    ) -> Result:
        """
        恢复工作流
        
        Args:
            task_id: 任务 ID
            strategy: 恢复策略
            
        Returns:
            执行结果
        """
        ...
    
    def cancel(self, task_id: str) -> bool:
        """
        取消工作流
        
        Args:
            task_id: 任务 ID
            
        Returns:
            是否取消成功
        """
        ...


class ISessionService(Protocol):
    """
    会话服务接口
    
    负责会话的生命周期管理。
    支持断点续传和会话归档。
    
    Usage:
        session = session_service.init("session-001")
        session_service.write("session-001", content)
        session = session_service.read("session-001")
        session_service.archive("session-001")
    """
    
    def init(self, session_id: str) -> Session:
        """
        初始化会话
        
        创建新会话或恢复已暂停的会话。
        
        Args:
            session_id: 会话 ID
            
        Returns:
            会话对象
        """
        ...
    
    def read(self, session_id: str) -> Session:
        """
        读取会话
        
        Args:
            session_id: 会话 ID
            
        Returns:
            会话对象
            
        Raises:
            SessionNotFoundError: 会话不存在
        """
        ...
    
    def write(self, session_id: str, content: Content) -> None:
        """
        写入会话内容
        
        Args:
            session_id: 会话 ID
            content: 内容对象
        """
        ...
    
    def archive(self, session_id: str) -> None:
        """
        归档会话
        
        将会话状态设为 archived，释放资源。
        
        Args:
            session_id: 会话 ID
        """
        ...
    
    def set_checkpoint(self, session_id: str, checkpoint: str) -> None:
        """
        设置断点
        
        Args:
            session_id: 会话 ID
            checkpoint: 断点标识
        """
        ...
    
    def get_checkpoint(self, session_id: str) -> Optional[str]:
        """
        获取断点
        
        Args:
            session_id: 会话 ID
            
        Returns:
            断点标识，无断点返回 None
        """
        ...
    
    def list_sessions(
        self, 
        status: Optional[str] = None
    ) -> List[Session]:
        """
        列出会话
        
        Args:
            status: 可选状态过滤
            
        Returns:
            会话列表
        """
        ...
    
    def delete(self, session_id: str) -> bool:
        """
        删除会话
        
        Args:
            session_id: 会话 ID
            
        Returns:
            是否删除成功
        """
        ...
