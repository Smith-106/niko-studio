"""
Memory 模块接口契约

定义 Memory、Citation、Distillation 三个核心服务的接口规范。
"""

from typing import Protocol, List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
from datetime import datetime


# ============================================================
# 数据类型定义
# ============================================================

@dataclass
class Message:
    """消息结构"""
    role: str  # "user" | "assistant" | "system"
    content: str
    timestamp: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class AddOptions:
    """添加记忆的选项"""
    namespace: str = "default"
    tags: Optional[List[str]] = None
    importance: float = 0.5  # 0.0-1.0
    ttl: Optional[int] = None  # 秒，None 表示永久


@dataclass
class SearchOptions:
    """搜索选项"""
    namespace: str = "default"
    limit: int = 10
    threshold: float = 0.7  # 相似度阈值
    include_metadata: bool = True
    time_range: Optional[tuple[datetime, datetime]] = None


@dataclass
class SearchResult:
    """搜索结果"""
    id: str
    content: str
    score: float  # 相似度分数
    metadata: Dict[str, Any]
    source: str  # 来源标识
    chunk_index: Optional[int] = None


@dataclass
class TransientCitation:
    """临时引用（未持久化）"""
    source: SearchResult
    excerpt: str
    context_before: str
    context_after: str
    created_at: datetime


@dataclass
class PersistedCitation:
    """持久化引用"""
    id: str
    source_id: str
    excerpt: str
    sha256_hash: str  # 内容校验哈希
    created_at: datetime
    verified: bool = False


@dataclass
class Memory:
    """记忆实体"""
    id: str
    content: str
    embedding: Optional[List[float]] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DistillationType(Enum):
    """蒸馏类型"""
    SUMMARY = "summary"
    INSIGHT = "insight"
    FACT = "fact"
    DECISION = "decision"
    QUESTION = "question"
    ACTION = "action"


# ============================================================
# 接口定义
# ============================================================

class IMemoryService(Protocol):
    """
    记忆服务接口
    
    负责记忆的增删改查和向量搜索。
    
    Usage:
        memory_service.add(messages, AddOptions(namespace="writing"))
        results = memory_service.search("角色设定", SearchOptions(limit=5))
    """
    
    def add(self, messages: List[Message], options: AddOptions) -> str:
        """
        添加消息到记忆存储
        
        Args:
            messages: 消息列表
            options: 添加选项
            
        Returns:
            记忆 ID
        """
        ...
    
    def search(self, query: str, options: SearchOptions) -> List[SearchResult]:
        """
        向量搜索
        
        Args:
            query: 查询文本
            options: 搜索选项
            
        Returns:
            搜索结果列表，按相似度降序
        """
        ...
    
    def hybrid_search(self, query: str) -> List[SearchResult]:
        """
        混合搜索（向量 + 关键词 + 图谱）
        
        使用 RRF (Reciprocal Rank Fusion) 融合多路召回结果。
        
        Args:
            query: 查询文本
            
        Returns:
            融合后的搜索结果
        """
        ...
    
    def add_history(self, session_id: str, messages: List[Message]) -> None:
        """
        添加会话历史
        
        Args:
            session_id: 会话 ID
            messages: 消息列表
        """
        ...
    
    def get(self, memory_id: str) -> Optional[Memory]:
        """
        获取单条记忆
        
        Args:
            memory_id: 记忆 ID
            
        Returns:
            记忆实体，不存在返回 None
        """
        ...
    
    def delete(self, memory_id: str) -> bool:
        """
        删除记忆
        
        Args:
            memory_id: 记忆 ID
            
        Returns:
            是否删除成功
        """
        ...


class ICitationService(Protocol):
    """
    引用服务接口
    
    负责创建、持久化和验证引用。
    使用 SHA256 哈希确保引用内容完整性。
    
    Usage:
        transient = citation_service.create_transient_citation(search_result)
        persisted = citation_service.make_citation(transient)
        is_valid = citation_service.verify_citation(persisted.id)
    """
    
    def create_transient_citation(self, source: SearchResult) -> TransientCitation:
        """
        创建临时引用
        
        从搜索结果创建临时引用，包含上下文。
        
        Args:
            source: 搜索结果
            
        Returns:
            临时引用对象
        """
        ...
    
    def make_citation(self, citation: TransientCitation) -> PersistedCitation:
        """
        持久化引用
        
        将临时引用持久化，生成 SHA256 校验哈希。
        
        Args:
            citation: 临时引用
            
        Returns:
            持久化引用对象
        """
        ...
    
    def verify_citation(self, citation_id: str) -> bool:
        """
        验证引用完整性
        
        通过 SHA256 哈希验证引用内容未被篡改。
        
        Args:
            citation_id: 引用 ID
            
        Returns:
            验证是否通过
        """
        ...
    
    def get_citation(self, citation_id: str) -> Optional[PersistedCitation]:
        """
        获取引用
        
        Args:
            citation_id: 引用 ID
            
        Returns:
            引用对象，不存在返回 None
        """
        ...
    
    def list_citations(self, source_id: str) -> List[PersistedCitation]:
        """
        列出来源的所有引用
        
        Args:
            source_id: 来源 ID
            
        Returns:
            引用列表
        """
        ...


class IDistillationService(Protocol):
    """
    蒸馏服务接口
    
    负责从对话中提取结构化知识。
    支持 6 种蒸馏模板：summary, insight, fact, decision, question, action。
    
    Usage:
        prompt = distill_service.get_distillation_prompt("insight")
        memory = distill_service.create_memory_from_distillation(content, "insight")
    """
    
    def get_distillation_prompt(self, prompt_type: str) -> str:
        """
        获取蒸馏提示词模板
        
        Args:
            prompt_type: 蒸馏类型 (summary|insight|fact|decision|question|action)
            
        Returns:
            提示词模板字符串
        """
        ...
    
    def create_memory_from_distillation(
        self, 
        content: str, 
        prompt_type: str
    ) -> Memory:
        """
        从蒸馏结果创建记忆
        
        Args:
            content: 蒸馏内容
            prompt_type: 蒸馏类型
            
        Returns:
            记忆实体
        """
        ...
    
    def distill(
        self, 
        messages: List[Message], 
        distillation_type: DistillationType
    ) -> str:
        """
        执行蒸馏
        
        Args:
            messages: 待蒸馏的消息列表
            distillation_type: 蒸馏类型
            
        Returns:
            蒸馏结果文本
        """
        ...
    
    def batch_distill(
        self, 
        messages: List[Message]
    ) -> Dict[DistillationType, str]:
        """
        批量蒸馏（所有类型）
        
        Args:
            messages: 待蒸馏的消息列表
            
        Returns:
            各类型蒸馏结果字典
        """
        ...
