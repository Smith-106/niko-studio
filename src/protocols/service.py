"""
Service Protocol

Defines the protocol for service layer implementations.
Supports structural subtyping with runtime checking.
"""

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class ServiceProtocol(Protocol):
    """Service 抽象接口

    定义 Service 层的核心能力，包括初始化、关闭和健康检查。
    所有 Service 必须实现此接口以支持结构性子类型。
    """

    @property
    def name(self) -> str:
        """Service 名称"""
        ...

    async def initialize(self, **kwargs) -> None:
        """初始化 Service

        Args:
            **kwargs: 初始化参数

        Raises:
            InitializationError: 初始化失败
        """
        ...

    async def shutdown(self) -> None:
        """关闭 Service

        执行清理操作，释放资源。
        """
        ...

    async def health_check(self) -> bool:
        """检查 Service 健康状态

        Returns:
            True 表示健康，False 表示不可用
        """
        ...

    def get_status(self) -> dict[str, Any]:
        """获取 Service 状态

        Returns:
            包含状态信息的字典
        """
        ...
